# Phase 3: Core Shared Data Models and Type Definitions

## 1. Interface Schemas
The backend uses TypeScript interfaces to enforce structure across data models, ensuring consistent JSON schemas in both local mock modes and Notion API queries. These models are defined in `server/src/types.ts`.

### Decision
Captures human approvals or agent-determined approvals/rejections at checkpoints.
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
```

### AuditLog
Maintains step-by-step logs of actions executed, LLM thoughts, and token pricing costs for tracking.
```typescript
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
```

### OnboardingRecord
Contains the primary record for onboarding employees, including integration results.
```typescript
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

## 2. Properties Validation Logic
To ensure data integrity, `server/src/notion/index.ts` implements runtime validation guards:

```typescript
export function validateDecision(data: any): data is Decision {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid Decision: must be an object');
  const allowedKeys = new Set(['id', 'decisionName', 'goalId', 'agent', 'decisionStatus', 'timestamp', 'reasoning']);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) throw new Error(`Invalid property in Decision: ${key}`);
  }
  if (typeof data.decisionName !== 'string') throw new Error('decisionName must be a string');
  if (typeof data.goalId !== 'string') throw new Error('goalId must be a string');
  if (data.agent !== 'PM' && data.agent !== 'Finance' && data.agent !== 'Engineering') throw new Error('Invalid agent in Decision');
  if (data.decisionStatus !== 'Approved' && data.decisionStatus !== 'Rejected' && data.decisionStatus !== 'Pending') throw new Error('Invalid decisionStatus');
  if (typeof data.timestamp !== 'string') throw new Error('timestamp must be a string');
  if (typeof data.reasoning !== 'string') throw new Error('reasoning must be a string');
  return true;
}
```

### Validation Guard Summary
* **Whitelist Property Checks**: Iterates over keys using a `Set` of allowed properties. If an extra property is present, it throws an error immediately to prevent database contamination.
* **Strict Enum Values**:
  * `Decision.agent` is limited to `'PM' | 'Finance' | 'Engineering'`.
  * `Decision.decisionStatus` is limited to `'Approved' | 'Rejected' | 'Pending'`.
  * `AuditLog.agent` is limited to `'System' | 'PM' | 'Finance' | 'Engineering'`.
  * `OnboardingRecord.department` is limited to `'Product' | 'Finance' | 'Engineering' | 'Sales'`.
  * `OnboardingRecord.onboardingStatus` is limited to `'In Progress' | 'Complete' | 'Failed'`.
* **Type Assertions**: Validates `salary` and `cost` as numbers, and `emailSent` as boolean.

---

## 3. State Naming Schemas
The in-memory state machine in `server/src/orchestrator/index.ts` transitions through the following states, mapped by the type `OnboardingState`:

```typescript
export type OnboardingState = 
  | 'INGESTED'                   // Request received by server
  | 'PM_PLANNING'                // PM agent is compiling spec & roadmap
  | 'FINANCE_AUDIT'              // Finance agent is evaluating budget cost limits
  | 'PENDING_FINANCE_APPROVAL'   // Paused: awaiting manager approval for the budget
  | 'ENGINEERING_SETUP'          // Active provisioning: GitHub, Google, Gmail
  | 'PENDING_ENG_APPROVAL'       // Paused: awaiting final engineering sign-off
  | 'COMPLETED'                  // Workflow finished successfully
  | 'FAILED';                    // Workflow terminated (budget rejected or setup error)
```

---

## 4. Extension Parameters
The `OnboardingRecord` interface features extension parameters to support external integrations:
1. **Google Calendar Properties**:
   * `calendarEventUrl?: string`: Link to the Google Calendar orientation invite.
   * `calendarEventDate?: string`: Start date and time of orientation.
2. **Gmail Delivery Property**:
   * `emailSent?: boolean`: Tracks if the onboarding email was successfully sent via Gmail.
3. **Optional Parameters**:
   * `email?: string`: Targeted employee email address.
   * `companyBudget?: number`: Custom budget cap (defaults to `$5,000,000` if not set).
