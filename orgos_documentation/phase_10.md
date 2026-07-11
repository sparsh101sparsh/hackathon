# Phase 10: Human-in-the-Loop Gatekeepers & Resolutions

## Overview
While AI agents handle the bulk of the research, drafting, and setup, OrgOS implements two critical "Human-in-the-Loop" (HITL) gatekeepers to verify decisions:
1. **Finance Budget Approval**: Prevents automated fund allocation.
2. **Engineering Release Sign-off**: Verifies account provisioning before final completion.

When the state machine reaches these gates, it pauses execution (entering an intermediary wait state) and waits for a human user to submit an approval action through an API endpoint.

---

## Key Source Files
- `org-os-notion/server/src/orchestrator/index.ts` (State flow control and database registration)
- `org-os-notion/server/src/index.ts` (API routes and validation controllers)

---

## Wait State Architecture & Registration
When the orchestrator transitions to a wait state, it halts automatic progression and yields control. The session remains in memory in the paused state (`PENDING_FINANCE_APPROVAL` or `PENDING_ENG_APPROVAL`).

```typescript
// Finance Audit Wait State
session.state = 'PENDING_FINANCE_APPROVAL';
await logStep(sessionId, 'System', 'Human Approval Required', 'Waiting for human approval on finance budget.', 0);
return; // Halts automatic runOrchestrator recursion

// Engineering Setup Wait State
session.state = 'PENDING_ENG_APPROVAL';
await logStep(sessionId, 'System', 'Engineering Release Sign-Off Required', 'Waiting for engineering release sign-off before finalizing onboarding.', 0);
return; // Halts automatic runOrchestrator recursion
```

---

## The Manual Resolution Endpoint
To resume a paused session, managers submit a POST request to the `/api/approve` endpoint.

### Endpoint Setup and Payload Parameters
- **Endpoint**: `POST /api/approve`
- **Request Body Payload**:
```typescript
interface ApprovalPayload {
  sessionId: string;      // Target onboarding session ID (Required)
  action: 'approve' | 'reject'; // The human decision (Required)
  approvalId?: string;    // Custom identifier, defaults to 'default' (Optional)
  reason?: string;        // Reasoning text supplied by the reviewer (Optional)
}
```

### Express Controller Validation Rules
The Express route performs immediate validation checks on the payload to prevent malformed submissions:
```typescript
app.post('/api/approve', async (req, res) => {
  const { approvalId, action, reason, sessionId } = req.body;

  if (!sessionId || !action) {
    return res.status(400).json({ error: 'sessionId and action are required' });
  }

  try {
    await approveStep(sessionId, approvalId || 'default', action, reason);
    broadcastEvent('approval_resolved', { sessionId, action });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error resolving approval:', error);
    return res.status(500).json({ error: error.message });
  }
});
```

---

## Step Approval Logic & Decisions DB Inserts
When `/api/approve` successfully validates a request, it calls the `approveStep()` controller inside the orchestrator:

### 1. Finance Gate Resolution (`PENDING_FINANCE_APPROVAL`)
- **Decisions DB Insertion**: Records a new decision page into the Notion Decisions database (or local JSON mock file).
- **If Approved**:
  - Sets state to `ENGINEERING_SETUP`.
  - Logs `Finance Approved` to audit logs.
- **If Rejected**:
  - Sets state to `FAILED`.
  - Sets employee record `onboardingStatus` to `Failed`.
  - Logs `Finance Rejected` and terminates the workflow.
- **Resume Execution**: Automatically invokes `runOrchestrator(sessionId)` to resume setup.

```typescript
if (session.state === 'PENDING_FINANCE_APPROVAL') {
  const decision: Decision = {
    decisionName: `Finance Approval - ${session.record.employeeName}`,
    goalId: sessionId,
    agent: 'Finance',
    decisionStatus: action === 'approve' ? 'Approved' : 'Rejected',
    timestamp: new Date().toISOString(),
    reasoning: reason || `Human manager reviewed and ${action}d.`
  };
  
  await createDecision(decision);
  session.decisions.push(decision);

  if (action === 'approve') {
    session.state = 'ENGINEERING_SETUP';
    await logStep(sessionId, 'Finance', 'Finance Approved', 'Finance checks passed and approved by human.', 0);
  } else {
    session.state = 'FAILED';
    session.record.onboardingStatus = 'Failed';
    await createOnboardingRecord(session.record);
    await logStep(sessionId, 'Finance', 'Finance Rejected', 'Finance checks rejected by human. Onboarding failed.', 0);
  }

  // Restart orchestrator
  runOrchestrator(sessionId).catch(console.error);
}
```

### 2. Engineering Gate Resolution (`PENDING_ENG_APPROVAL`)
- **Decisions DB Insertion**: Inserts an engineering release decision into the database.
- **If Approved**:
  - Sets state to `COMPLETED`.
  - Sets employee record `onboardingStatus` to `Complete`.
  - Logs `Engineering Approved` and completes the onboarding process.
- **If Rejected**:
  - Sets state to `FAILED`.
  - Sets employee record `onboardingStatus` to `Failed`.
  - Logs `Engineering Rejected`.
- **Resume Execution**: Invokes `runOrchestrator(sessionId)`.

```typescript
else if (session.state === 'PENDING_ENG_APPROVAL') {
  const decision: Decision = {
    decisionName: `Engineering Approval - ${session.record.employeeName}`,
    goalId: sessionId,
    agent: 'Engineering',
    decisionStatus: action === 'approve' ? 'Approved' : 'Rejected',
    timestamp: new Date().toISOString(),
    reasoning: reason || `Engineering release reviewed and ${action}d.`
  };

  await createDecision(decision);
  session.decisions.push(decision);

  if (action === 'approve') {
    session.state = 'COMPLETED';
    session.record.onboardingStatus = 'Complete';
    await createOnboardingRecord(session.record);
    await logStep(sessionId, 'Engineering', 'Engineering Approved', 'Engineering setup passed and approved by human. Onboarding complete.', 0);
  } else {
    session.state = 'FAILED';
    session.record.onboardingStatus = 'Failed';
    await createOnboardingRecord(session.record);
    await logStep(sessionId, 'Engineering', 'Engineering Rejected', 'Engineering setup rejected by human. Onboarding failed.', 0);
  }

  // Restart orchestrator
  runOrchestrator(sessionId).catch(console.error);
}
```

---

## HITL Resolution Flowchart
```
                [Workflow Enters Pause State]
                             │
                             ▼
                [State Map Flagged Pending]
                 - PENDING_FINANCE_APPROVAL
                 - PENDING_ENG_APPROVAL
                             │
                             ▼
                 [Yield Orchestrator Loop]
                             │
                             ▼
               [Human Submits Resolution API]
                    - POST /api/approve
                    - payload validation
                             │
                             ▼
                 [Create Decisions Entry]
                   - Insert to Notion/Mock DB
                             │
            ┌────────────────┴────────────────┐
     Action: Approve                   Action: Reject
            │                                 │
            ▼                                 ▼
   [Advance State Flag]               [Mark State FAILED]
  - ENGINEERING_SETUP or             - onboardingStatus = 'Failed'
    COMPLETED                         - createOnboardingRecord()
            │                                 │
            ▼                                 ▼
   [Restart Orchestrator]              [Terminate Flow]
  - runOrchestrator(sessionId)
```
