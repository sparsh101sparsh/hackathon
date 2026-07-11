# Phase 9: In-Memory Orchestrator and Workflow State Machine

## Overview
The Orchestrator acts as the central coordinator in OrgOS. It executes an asynchronous, event-driven state machine that transitions employee onboarding sessions through validation, planning, financial analysis, manual approvals, and technical setup. The orchestrator records every operation to the audit database and broadcasts real-time status updates using Server-Sent Events (SSE).

---

## Key Source Files
- `org-os-notion/server/src/orchestrator/index.ts` (State machine definition and session worker)
- `org-os-notion/server/src/index.ts` (SSE server broadcast configuration)

---

## State Machine Definition & State Transitions
The workflow progresses through distinct states representing the operational stages:

```typescript
export type OnboardingState = 
  | 'INGESTED' 
  | 'PM_PLANNING' 
  | 'FINANCE_AUDIT' 
  | 'PENDING_FINANCE_APPROVAL' 
  | 'ENGINEERING_SETUP' 
  | 'PENDING_ENG_APPROVAL' 
  | 'COMPLETED' 
  | 'FAILED';
```

### State Cycle & Transition Rules

```
       [Start]
          │
          ▼
     (INGESTED) ───► Ingest request, initialize state variables
          │
          ▼
   (PM_PLANNING) ───► PM Agent generates roadmap & checklist
          │
          ▼
  (FINANCE_AUDIT) ──► Finance Agent checks budget vs headcount limits
          │
          ├───► Total Cost > Budget ───► (FAILED)
          │
          └───► Within Budget ─────────► (PENDING_FINANCE_APPROVAL)
                                                      │
                                               [Human Review]
                                                      │
                                          ┌───────────┴───────────┐
                                      Approved                 Rejected
                                          │                       │
                                          ▼                       ▼
                                 (ENGINEERING_SETUP)          (FAILED)
                                          │
                                   [Verify GitHub]
                                   [Invite to Org]
                                   [Create Issue]
                                 [Schedule Calendar]
                                 [Send Gmail Welcome]
                                          │
                                          ▼
                               (PENDING_ENG_APPROVAL)
                                          │
                                   [Human Review]
                                          │
                                          ├───────────┬───────────┘
                                      Approved     Rejected
                                          │                       │
                                          ▼                       ▼
                                     (COMPLETED)              (FAILED)
```

---

## In-Memory Session Storage
Onboarding sessions are maintained in an active, in-memory Map:
```typescript
const sessions: Map<string, OnboardingSession> = new Map();
```

Each session is encapsulated within the `OnboardingSession` interface, tracking state, raw records, logs, and approvals:
```typescript
export interface OnboardingSession {
  id: string;
  state: OnboardingState;
  record: OnboardingRecord;
  logs: AuditLog[];
  decisions: Decision[];
}
```

---

## Orchestrator Execution Steps & Core Logic

### 1. Ingestion (`INGESTED`)
When a request is posted to `/api/onboarding`, the system generates a unique session ID (`session-${Date.now()}`), sets the initial state to `INGESTED`, and kicks off the background orchestrator loop:
```typescript
const sessionId = `session-${Date.now()}`;
const session = { id: sessionId, state: 'INGESTED', record: initialRecord, logs: [], decisions: [] };
sessions.set(sessionId, session);
await logStep(sessionId, 'System', 'Employee Ingestion', `Ingested onboarding request for ${name}`, 0);
runOrchestrator(sessionId);
```

### 2. Product Planning (`PM_PLANNING`)
The PM Agent is invoked to design an onboarding checklist. Once completed, the cost and the generated roadmap are stored in the session log, and the state advances:
```typescript
session.state = 'PM_PLANNING';
const pmResult = await runAgentThought(PMAgent, `Create onboarding spec...`);
await logStep(sessionId, 'PM', 'Completed Product Manager Spec', pmResult.text, pmResult.cost);
session.state = 'FINANCE_AUDIT';
await runOrchestrator(sessionId);
```

### 3. Financial Auditing (`FINANCE_AUDIT`)
The Finance Agent verifies costs. A standard equipment charge of `$3,200` is combined with the salary.
- **Budget Threshold Check**: If `salary + 3200` exceeds `companyBudget` (defaulting to `$5,000,000`), the onboarding is automatically rejected.
- **Approval Transition**: If the checks pass, it transitions to `PENDING_FINANCE_APPROVAL` and pauses for human verification.
```typescript
const equipmentCost = 3200;
const totalCost = session.record.salary + equipmentCost;
const companyBudget = session.record.companyBudget || 5000000;

if (totalCost > companyBudget) {
  session.state = 'FAILED';
  session.record.onboardingStatus = 'Failed';
  await createOnboardingRecord(session.record);
  return;
}
session.state = 'PENDING_FINANCE_APPROVAL';
```

### 4. Technical Provisioning (`ENGINEERING_SETUP`)
When the manager approves the budget, the orchestrator triggers engineering steps:
- **GitHub Verification**: Invokes `githubService.verifyUsername()` to fetch the user ID.
- **GitHub Invitation**: Sends an organization invite using `githubService.inviteToOrg()`.
- **GitHub Issue Creation**: Generates an onboarding task list issue. If it fails, the script retries once.
- **Google Calendar Scheduling**: Creates an orientation event using `googleService.createOrientationEvent()`.
- **Welcome Email**: Uses Gmail API to send the details and links directly to the user.
- **Notion Sync**: Updates the audit database.
- **State Transition**: Moves to `PENDING_ENG_APPROVAL` and pauses.

### 5. Final Engineering Release Sign-Off
Transitions to `COMPLETED` or `FAILED` based on human engineering approval.

---

## Log Updates & Cost Tracking
Every step transitions the local session data and invokes `logStep()`, which persists logs to Notion (or mock DB) and triggers real-time events.

### Step Log Persistence
The `logStep` function:
1. Instantiates a clean `AuditLog` structure.
2. Persists the log via `createAuditLog()`.
3. Adds the log to the session's in-memory array.
4. Calculates and accumulates token cost metrics.
5. Emits an event via Node's event emitter (`appEvents.emit`).

```typescript
async function logStep(sessionId: string, agent: 'System' | 'PM' | 'Finance' | 'Engineering', action: string, thought: string, cost: number) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const auditLog: AuditLog = {
    stepName: session.state,
    agent,
    actionExecuted: action,
    thoughtProcess: thought,
    cost,
    timestamp: new Date().toISOString()
  };

  await createAuditLog(auditLog);
  session.logs.push(auditLog);

  appEvents.emit('event', {
    event: 'session_updated',
    data: { sessionId, state: session.state, record: session.record, logs: session.logs, decisions: session.decisions }
  });
}
```
If SSE clients are connected, the app listener receives the event and sends a Server-Sent Event stream packet containing the updated session state, ensuring real-time UI synchronizations.
