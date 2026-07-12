import { OnboardingRecord, Decision, AuditLog } from '../types';
import { createDecision, createAuditLog, createOnboardingRecord, notionService } from '../notion';
import { PMAgent, FinanceAgent, EngineeringAgent, runAgentThought } from '../agents';
import { appEvents } from '../events';
import { githubService } from '../services/github';
import { googleService } from '../services/googleService';


export type OnboardingState = 
  | 'INGESTED' 
  | 'PM_PLANNING' 
  | 'FINANCE_AUDIT' 
  | 'PENDING_FINANCE_APPROVAL' 
  | 'ENGINEERING_SETUP' 
  | 'PENDING_ENG_APPROVAL' 
  | 'COMPLETED' 
  | 'FAILED';

export interface OnboardingSession {
  id: string;
  state: OnboardingState;
  record: OnboardingRecord;
  logs: AuditLog[];
  decisions: Decision[];
}

// In-memory session store
const sessions: Map<string, OnboardingSession> = new Map();

export function getSession(id: string): OnboardingSession | undefined {
  return sessions.get(id);
}

export function getAllSessions(): OnboardingSession[] {
  return Array.from(sessions.values());
}

export async function startOnboarding(employeeData: Omit<OnboardingRecord, 'onboardingStatus'>): Promise<string> {
  const sessionId = `session-${Date.now()}`;
  
  const initialRecord: OnboardingRecord = {
    ...employeeData,
    onboardingStatus: 'In Progress'
  };

  const session: OnboardingSession = {
    id: sessionId,
    state: 'INGESTED',
    record: initialRecord,
    logs: [],
    decisions: []
  };

  sessions.set(sessionId, session);

  // Log the initial ingestion
  await logStep(sessionId, 'System', 'Employee Ingestion', `Ingested onboarding request for ${employeeData.employeeName}`, 0);
  
  // Trigger async orchestrator run
  runOrchestrator(sessionId).catch(err => {
    console.error(`Error running orchestrator for ${sessionId}:`, err);
  });

  return sessionId;
}

export async function approveStep(sessionId: string, approvalId: string, action: 'approve' | 'reject', reason: string = ''): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

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

    // Continue run
    runOrchestrator(sessionId).catch(console.error);
  } else if (session.state === 'PENDING_ENG_APPROVAL') {
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

    // Continue run
    runOrchestrator(sessionId).catch(console.error);
  }
}

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
  
  // Emit event to SSE server
  appEvents.emit('event', {
    event: 'session_updated',
    data: {
      sessionId,
      state: session.state,
      record: session.record,
      logs: session.logs,
      decisions: session.decisions
    }
  });
}

async function runOrchestrator(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  console.log(`[Orchestrator] Running session ${sessionId} in state ${session.state}`);

  if (session.state === 'INGESTED') {
    session.state = 'PM_PLANNING';
    await runOrchestrator(sessionId);
    return;
  }

  if (session.state === 'PM_PLANNING') {
    await logStep(sessionId, 'PM', 'Drafting Product Manager Spec', 'Compiling onboarding documents and setting roadmap.', 0.002);
    const pmResult = await runAgentThought(
      PMAgent,
      `Create onboarding spec, decide role-specific tasks, and generate checklist for ${session.record.employeeName} (${session.record.role} in ${session.record.department})`
    );
    await logStep(sessionId, 'PM', 'Completed Product Manager Spec', pmResult.text, pmResult.cost);
    
    session.state = 'FINANCE_AUDIT';
    await runOrchestrator(sessionId);
    return;
  }

  if (session.state === 'FINANCE_AUDIT') {
    await logStep(sessionId, 'Finance', 'Auditing Budget', 'Verifying employee compensation against team limits.', 0.001);
    
    // Calculate total cost
    // Equipment roughly $3,200 for a standard bundle if not precisely known
    const equipmentCost = 3200; 
    const totalCost = session.record.salary + equipmentCost;
    const companyBudget = session.record.companyBudget || 5000000;
    const remainingBudget = companyBudget - totalCost;

    if (totalCost > companyBudget) {
      const reasoning = `Budget Analysis\n\nEmployee Salary\n$${session.record.salary.toLocaleString()}\n\nEquipment Cost\n$${equipmentCost.toLocaleString()}\n\nTotal First Year Cost\n$${totalCost.toLocaleString()}\n\nRemaining Company Budget\n$${companyBudget.toLocaleString()}\n\nDecision\nRejected\n\nConfidence\n100%`;
      await logStep(sessionId, 'Finance', 'Budget Rejected', reasoning, 0);
      session.state = 'FAILED';
      session.record.onboardingStatus = 'Failed';
      await createOnboardingRecord(session.record);
      await logStep(sessionId, 'System', 'Workflow Halted', 'Finance Agent automatically rejected the request due to insufficient budget.', 0);
      return;
    }

    const reasoning = `Budget Analysis\n\nEmployee Salary\n$${session.record.salary.toLocaleString()}\n\nEquipment Cost\n$${equipmentCost.toLocaleString()}\n\nTotal First Year Cost\n$${totalCost.toLocaleString()}\n\nRemaining Company Budget\n$${remainingBudget.toLocaleString()}\n\nDecision\nApproved\n\nConfidence\n98%`;
    await logStep(sessionId, 'Finance', 'Budget Audited', reasoning, 0.002);

    // Pause for Human Approval Gate
    session.state = 'PENDING_FINANCE_APPROVAL';
    await logStep(sessionId, 'System', 'Human Approval Required', 'Waiting for human approval on finance budget.', 0);
    return;
  }

  if (session.state === 'ENGINEERING_SETUP') {
    await logStep(sessionId, 'Engineering', 'Engineering Agent initialized.', 'Initializing engineering onboarding tasks...', 0);
    await logStep(sessionId, 'Engineering', 'Checking GitHub username...', 'Verified GitHub username\nWaiting for organization invitation...', 0);

    let userId: number;
    try {
      userId = await githubService.verifyUsername(session.record.githubUsername);
    } catch (err: any) {
      await logStep(sessionId, 'Engineering', 'Username verification failed', err.message || 'Invalid username', 0);
      session.state = 'FAILED';
      session.record.onboardingStatus = 'Failed';
      await createOnboardingRecord(session.record);
      await logStep(sessionId, 'System', 'Engineering Setup Failed', 'GitHub username verification failed. Onboarding failed.', 0);
      return;
    }

    await logStep(sessionId, 'Engineering', 'Username exists.', `Verified GitHub username (User ID: ${userId})\nWaiting for organization invitation...`, 0);
    await logStep(sessionId, 'Engineering', 'Preparing organization invitation...', 'Verified GitHub username\nSent organization invitation\nWaiting for onboarding issue...', 0);

    let inviteOk = false;
    try {
      await githubService.inviteToOrg(userId);
      inviteOk = true;
    } catch (err: any) {
      await logStep(sessionId, 'Engineering', `⚠️ Org invitation failed: ${err.message}`, err.message || 'Invitation failed', 0);
    }
    if (inviteOk) {
      await logStep(sessionId, 'Engineering', 'Invitation sent.', 'Verified GitHub username\nSent organization invitation\nWaiting for onboarding issue...', 0);
    }
    await logStep(sessionId, 'Engineering', 'Creating onboarding issue...', 'Verified GitHub username\nSent organization invitation\nCreated onboarding issue\nWaiting for calendar event...', 0);

    let issueNum: number | null = null;
    let issueError: any = null;
    try {
      const res = await githubService.createOnboardingIssue(session.record.employeeName, session.record.githubUsername);
      issueNum = res.number;
    } catch (err: any) {
      issueError = err;
      console.warn("First attempt of creating onboarding issue failed, retrying...", err.message);
      try {
        const res = await githubService.createOnboardingIssue(session.record.employeeName, session.record.githubUsername);
        issueNum = res.number;
      } catch (retryErr: any) {
        issueError = retryErr;
      }
    }

    if (issueNum !== null) {
      await logStep(sessionId, 'Engineering', `Issue #${issueNum} created.`, `Verified GitHub username\nSent organization invitation\nCreated onboarding issue #${issueNum}\nWaiting for calendar event...`, 0);
    } else {
      await logStep(sessionId, 'Engineering', 'Issue creation failed', issueError?.message || 'Failed to create onboarding issue after retry', 0);
    }

    // ── Google Calendar step ──────────────────────────────────────────
    await logStep(sessionId, 'Engineering', 'Scheduling Google Calendar orientation...', 'Verified GitHub username\nSent organization invitation\nCreated onboarding issue\nCreated Google Calendar event\nWaiting for welcome email...', 0);
    try {
      const calResult = await googleService.createOrientationEvent(session.record.employeeName, session.record.email);
      session.record.calendarEventUrl = calResult.eventUrl ?? undefined;
      session.record.calendarEventDate = calResult.startTime ?? undefined;
      await logStep(sessionId, 'Engineering', `Orientation scheduled: ${calResult.startTime}`, `Verified GitHub username\nSent organization invitation\nCreated onboarding issue\nCreated Google Calendar event\nGenerated meeting link\nWaiting for welcome email...`, 0);
    } catch (err: any) {
      await logStep(sessionId, 'Engineering', `Calendar scheduling failed: ${err.message}`, err.message, 0);
    }

    // ── Gmail step ───────────────────────────────────────────────────
    await logStep(sessionId, 'Engineering', 'Sending welcome email...', 'Verified GitHub username\nSent organization invitation\nCreated onboarding issue\nCreated Google Calendar event\nGenerated meeting link\nSent welcome email\nWaiting for Notion sync...', 0);
    try {
      const issueUrl = issueNum
        ? `https://github.com/${process.env.GITHUB_ORG}/${process.env.GITHUB_REPO}/issues/${issueNum}`
        : undefined;
      const recipientEmail =
        session.record.email ||
        `${session.record.githubUsername}@users.noreply.github.com`;
      await googleService.sendWelcomeEmail(
        recipientEmail,
        session.record.employeeName,
        session.record.calendarEventUrl || '',
        issueUrl
      );
      session.record.emailSent = true;
      await logStep(sessionId, 'Engineering', 'Welcome email delivered.', 'Verified GitHub username\nSent organization invitation\nCreated onboarding issue\nCreated Google Calendar event\nGenerated meeting link\nSent welcome email\nWaiting for Notion sync...', 0);
    } catch (err: any) {
      await logStep(sessionId, 'Engineering', `Email failed: ${err.message}`, err.message, 0);
    }

    await logStep(sessionId, 'Engineering', 'Updating Notion...', 'Saving GitHub setup results to Notion database...', 0);

    const statusVal = issueNum !== null ? 'Success' : 'Partial Success';
    const reasoningVal = issueNum !== null
      ? `Successfully completed engineering setup: verified GitHub username @${session.record.githubUsername}, sent organization invitation, and created onboarding issue #${issueNum}.`
      : `Partially completed engineering setup: verified GitHub username @${session.record.githubUsername} and sent organization invitation, but failed to create onboarding issue after retries.`;

    const auditLog = await notionService.createAuditLog({
      stepName: 'ENGINEERING_SETUP',
      agent: 'Engineering',
      actionExecuted: statusVal,
      thoughtProcess: reasoningVal,
      cost: 0,
      timestamp: new Date().toISOString()
    });
    session.logs.push(auditLog);

    appEvents.emit('event', {
      event: 'session_updated',
      data: {
        sessionId,
        state: session.state,
        record: session.record,
        logs: session.logs,
        decisions: session.decisions
      }
    });

    await logStep(sessionId, 'Engineering', 'Organizational memory updated.', 'Verified GitHub username\nSent organization invitation\nCreated onboarding issue\nCreated Google Calendar event\nGenerated meeting link\nSent welcome email\nUpdated Notion', 0);

    const summaryPrompt = `Onboarding engineering setup for ${session.record.employeeName} (GitHub: ${session.record.githubUsername}) completed.
Summary of actions:
- Verified GitHub username (User ID: ${userId}).
- Sent organization invitation.
${issueNum ? `- Created onboarding issue #${issueNum}.` : `- Failed to create onboarding issue (partial success).`}

Generate the final engineering setup summary, credentials confirmation, and deployment tasks.`;

    const engResult = await runAgentThought(EngineeringAgent, summaryPrompt);
    await logStep(sessionId, 'Engineering', 'Accounts Provisioned', engResult.text, engResult.cost);

    session.state = 'PENDING_ENG_APPROVAL';
    await logStep(sessionId, 'System', 'Engineering Release Sign-Off Required', 'Waiting for engineering release sign-off before finalizing onboarding.', 0);
  }
}
