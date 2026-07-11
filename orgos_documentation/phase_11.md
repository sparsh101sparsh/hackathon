# Phase 11: Auditor Agent - Secrets Detection Audits

## 1. Overview and Scope
The **Auditor Agent** is an independent, automated governance utility built into the OrgOS monorepo. Its primary mandate under Phase 11 is **Credentials Leakage Prevention (Secrets Detection)**. By analyzing the source code statically before builds or deployments, the Auditor ensures that no production credentials, API tokens, or integration secrets are hardcoded in the codebase. 

The scope of Phase 11 includes:
- Recursively traversing the source files (`.ts` and `.js` extensions), excluding node modules, build targets, and hidden directories.
- Executing regex audits matching known key patterns for Notion, Google Cloud/AI, and OpenAI services.
- Excluding comment lines, placeholder strings, and valid environment variable reference structures (`process.env`).
- Reporting violations precisely by file path and line number, returning a non-zero exit status to prevent integration pipelines from succeeding if leaks are found.

---

## 2. Key Source File
- **Path**: `org-os-notion/server/src/auditor/index.ts`
- **Language**: TypeScript (Node.js)

---

## 3. Technical Content and Implementation Details

### A. Directory Traversal Logic (`walkDir`)
To scan the codebase, the auditor employs a synchronous, recursive file-system crawler (`walkDir`). It filters out directories that could contain bulky or generated assets (such as `node_modules`, `dist`, or `.git`).

#### Function Signature
```typescript
function walkDir(dir: string, ext: string): string[]
```

#### Code Snippet
```typescript
function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
      results.push(...walkDir(fullPath, ext));
    } else if (entry.isFile() && fullPath.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}
```

### B. Secrets Detection Regex Patterns
The auditor uses defined regular expressions designed to match typical structures of keys from services utilized by OrgOS:

| Service / Key Type | Regular Expression | Description |
| :--- | :--- | :--- |
| **Notion Integration Token** | `/ntn_[A-Za-z0-9]{40,}/` | Matches the modern Notion integration token prefix followed by 40+ alphanumeric characters. |
| **Google AI / Gemini API Key** | `/AIzaSy[A-Za-z0-9_-]{30,}/` | Matches the Google API key prefix followed by 30+ characters, common in Cloud Console and Gemini API. |
| **Notion Legacy Secret** | `/secret_[A-Za-z0-9]{30,}/` | Matches legacy Notion secrets. |
| **OpenAI API Key** | `/sk-[A-Za-z0-9]{40,}/` | Matches OpenAI secret API keys starting with the `sk-` prefix. |

#### Code Snippet
```typescript
const PATTERNS_HARDCODED_KEY = [
  /ntn_[A-Za-z0-9]{40,}/,        // Notion integration token
  /AIzaSy[A-Za-z0-9_-]{30,}/,    // Google AI / Gemini API key
  /secret_[A-Za-z0-9]{30,}/,     // Notion legacy secret
  /sk-[A-Za-z0-9]{40,}/,         // OpenAI key
];
```

### C. Filtering Out Comments and Environment References
A naive regex match would trigger false positives on comments, placeholder templates (e.g., `.env.example`), or code referencing environment variables. The auditor addresses this via two filters:
1. **Comment Line Skip Filter**: Lines starting with comment tokens `//`, `*`, or `#` (after trimming whitespace) are ignored.
2. **Environment Access Validation**: If the matching token is accessed via `process.env` or resides within a configuration template assignment (like `NOTION_INTEGRATION_TOKEN=secret_xxx`), it is bypassed.

#### Code Snippet (Audit Engine Logic)
```typescript
function auditHardcodedKeys(): AuditResult {
  const files = [
    ...walkDir(SRC_ROOT, '.ts'),
    ...walkDir(SRC_ROOT, '.js'),
  ].filter(f => !f.includes('.env') && !f.includes('.example'));

  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      // Skip comment lines
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) return;
      for (const pattern of PATTERNS_HARDCODED_KEY) {
        if (pattern.test(line)) {
          // Check it's not being read from env or a safe placeholder
          if (!line.includes('process.env') && !line.includes('NOTION_INTEGRATION_TOKEN=secret_xxx')) {
            violations.push(`  ${path.relative(SRC_ROOT, file)}:${i + 1} → ${line.trim().substring(0, 80)}`);
          }
        }
      }
    });
  }

  return {
    check: 'No Hardcoded API Keys',
    passed: violations.length === 0,
    detail: violations.length === 0
      ? 'All API keys are sourced from process.env. No hardcoded secrets found in source.'
      : `VIOLATIONS:\n${violations.join('\n')}`,
  };
}
```

---

## 4. Operational Flowchart

```
[Start Scan]
     │
     ▼
[walkDir: Traverse SRC_ROOT]
     │
     ├─► Exclude node_modules, dist, hidden files
     │
     ▼
[Filter File List]
     │
     ├─► Exclude .env and .example files
     │
     ▼
For Each File: Read Content UTF-8
     │
     ▼
For Each Line (1-indexed):
     │
     ├──[Is Comment? (startsWith '//', '*', '#')] ──► YES ──► Skip Line
     │
     ├── NO
     │
     ▼
   [Matches any PATTERNS_HARDCODED_KEY?] ──► NO ──► Continue
     │
     ├── YES
     │
     ▼
   [Contains 'process.env' or safe placeholder?] ──► YES ──► Skip/Bypass
     │
     ├── NO
     │
     ▼
   [Record Violation] -> Track File Path, Line Number, Snippet
     │
     ▼
[Compile AuditResult]
     │
     ├── violations.length == 0  ──► Return Passed (true)
     └── violations.length > 0   ──► Return Failed (false)
```

---

## 5. Execution Interface & Output Structure
The check returns a structured `AuditResult` interface:
```typescript
interface AuditResult {
  check: string;
  passed: boolean;
  detail: string;
}
```

- When **successful**, the terminal prints:
  `✅ No Hardcoded API Keys`
  `   All API keys are sourced from process.env. No hardcoded secrets found in source.`
- When **failed**, the terminal outputs details of each violation and exits with `1`:
  `❌ No Hardcoded API Keys`
  `   VIOLATIONS:`
  `     services/googleService.ts:15 → const key = "AIzaSy..."`
