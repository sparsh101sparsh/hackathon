# Phase 6: Notion Integration - Local Thread-Safe Mock Database

## Overview
The local database simulation in OrgOS acts as a drop-in replacement for the Notion API. It uses local JSON files within the `.mock-notion-db` directory to store and track onboarding records, audit logs, and decisions. To maintain consistency under concurrent loads and prevent file corruption during parallel operations, it implements a custom file-based spin-lock mechanism and atomic file writing (write-then-rename), combined with automatic self-healing logic.

---

## Key Source Files
- `org-os-notion/server/src/notion/index.ts` (Core database driver and property mappers)
- `org-os-notion/server/src/notion/robustness.test.ts` (Robustness and concurrency stress tests)

---

## Data Architecture & Structures
The mock database creates three separate JSON files inside the `../../.mock-notion-db` directory relative to the source directory:
1. `decisions.json` — Stores human/agent onboarding decisions.
2. `auditLogs.json` — Stores execution step logs, thoughts, and token costs.
3. `onboardingRecords.json` — Stores the state of employees onboarding.

Each JSON file maintains a root object structure:
```json
{
  "name": "DatabaseName",
  "records": []
}
```

### Type Definitions
```typescript
export interface Decision {
  id?: string;
  decisionName: string;
  goalId: string;
  agent: 'PM' | 'Finance' | 'Engineering';
  decisionStatus: 'Approved' | 'Rejected' | 'Pending';
  timestamp: string;
  reasoning: string;
}

export interface AuditLog {
  id?: string;
  logId?: string;
  stepName: string;
  agent: 'System' | 'PM' | 'Finance' | 'Engineering';
  actionExecuted: string;
  thoughtProcess: string;
  cost: number;
  timestamp: string;
}

export interface OnboardingRecord {
  id?: string;
  employeeName: string;
  role: string;
  department: 'Product' | 'Finance' | 'Engineering' | 'Sales';
  salary: number;
  equipmentList: string;
  githubUsername: string;
  email?: string;
  companyBudget?: number;
  onboardingStatus: 'In Progress' | 'Complete' | 'Failed';
  calendarEventUrl?: string;
  calendarEventDate?: string;
  emailSent?: boolean;
}
```

---

## Key Functions & Signatures

### 1. `ensureMockFile(filename: string, defaultStructure: any): void`
Checks if the target mock database folder and files exist. If not, it recursively creates the folder and writes the default database structure.
```typescript
function ensureMockFile(filename: string, defaultStructure: any) {
  if (!fs.existsSync(mockDbDir)) {
    fs.mkdirSync(mockDbDir, { recursive: true });
  }
  const filePath = path.join(mockDbDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultStructure, null, 2), 'utf8');
  }
}
```

### 2. `getMockRecords(filename: string, defaultStructure: any): any[]`
Reads and returns records from the designated JSON file. It includes self-healing parse guards.
```typescript
function getMockRecords(filename: string, defaultStructure: any): any[]
```

### 3. `writeMockRecord<T>(filename: string, defaultStructure: any, record: T, validate: (data: any) => data is T, idPrefix: string): Promise<T>`
Acquires a process lock, validates the record payload format, reads the existing records, appends the new record with an auto-generated unique ID, performs an atomic write, and cleans up the lock.
```typescript
async function writeMockRecord<T>(
  filename: string,
  defaultStructure: { name: string; records: any[] },
  record: T,
  validate: (data: any) => data is T,
  idPrefix: string
): Promise<T>
```

---

## Core Technical Implementations

### A. Thread-Safe Spin-Lock Mechanism
Since Node.js is single-threaded, file-locking is crucial for multi-process workloads (e.g. concurrent testing, multiple API requests). The mock driver uses lockfiles:
- **Lockfile Path**: `${filePath}.lock`
- **Atomic Creation**: Uses `fs.openSync(lockfilePath, 'wx')`. The `'wx'` flag opens the file for writing but throws an `EEXIST` error if the file already exists.
- **Spin-Retry with Backoff**: If `EEXIST` is caught, the process sleeps for a randomized interval (`10 + Math.random() * 20` ms) and retries.
- **Timeout**: The process spins up to a maximum of 10,000 ms (10 seconds) before throwing a timeout error.

```typescript
let acquired = false;
const startTime = Date.now();

while (Date.now() - startTime < 10000) {
  try {
    const fd = fs.openSync(lockfilePath, 'wx');
    fs.closeSync(fd);
    acquired = true;
    break;
  } catch (e: any) {
    if (e.code === 'EEXIST') {
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 20));
    } else {
      throw e;
    }
  }
}
```

### B. Atomic Rename (Write-then-Rename)
Writing directly to the target database file can result in file corruption if the server crashes mid-write. To guarantee write-atomicity:
1. Serialize the updated state into memory.
2. Write to a temporary file: `${filePath}.tmp`.
3. Atomically rename the temporary file to the final destination using `fs.renameSync()`. The operating system guarantees that rename operations are atomic.

```typescript
const tempPath = filePath + '.tmp';
fs.writeFileSync(tempPath, JSON.stringify(content, null, 2), 'utf8');
fs.renameSync(tempPath, filePath);
```

### C. Self-Healing JSON Corruption Recovery
If a JSON parsing failure occurs during reads or writes (e.g. from manual user edits or partial failures), the driver catches the syntax error and logs a warning. Instead of failing the entire system, it resets the database structure to a clean default state.
```typescript
try {
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8').trim();
    if (fileContent) {
      content = JSON.parse(fileContent);
    }
  }
} catch (err) {
  console.warn(`[Mock Notion] JSON corruption detected in ${filename}, self-healing...`);
}

if (!content || typeof content !== 'object' || !Array.isArray(content.records)) {
  content = { name: defaultStructure.name, records: [] };
}
```

### D. Notion Database Property Mappers
When the application switches to `REAL` mode (`process.env.MOCK_NOTION === 'false'`), it queries the Notion API which returns a complex nested JSON structure for page properties. The codebase uses specialized helper mappers to cast these properties back to clean internal primitive structures:

| Notion Property Type | Extraction Function | Implementation |
| :--- | :--- | :--- |
| `title` | `titleText(property)` | Loops through `title` array, joins and trims `plain_text`. |
| `rich_text` | `richText(property)` | Loops through `rich_text` array, joins and trims `plain_text`. |
| `select` | `selectName(property)` | Safely extracts `select.name`. |
| `date` | `dateStart(property)` | Returns `date.start` or defaults to current ISO string. |
| `number` | `numberValue(property)`| Validates type and returns numeric value or 0. |

Example Mapper implementations:
```typescript
function titleText(property: any): string {
  return property?.title?.map((item: any) => item?.plain_text || '').join('').trim() || '';
}

function richText(property: any): string {
  return property?.rich_text?.map((item: any) => item?.plain_text || '').join('').trim() || '';
}

function selectName(property: any): string {
  return property?.select?.name || '';
}
```

---

## Thread Locking and Atomic Write Flow
```
[Start Write Request]
         │
         ▼
[Loop: Check Lockfile]
    - Open with 'wx' flag
    - Success? -> Lock Acquired
    - Fail (EEXIST)? -> Backoff (10-30ms) & Retry
    - Timeout > 10s? -> Throw Error
         │
         ▼
[Read Existing JSON]
    - Parse JSON
    - Corruption? -> Self-Heal (Reset to default)
         │
         ▼
[Append Record]
    - Assign UUID if missing
         │
         ▼
[Atomic Write]
    - Write to .json.tmp
    - fs.renameSync(.json.tmp -> .json)
         │
         ▼
[Release Lock]
    - Delete .lock file
         │
         ▼
[End Write Request]
```
