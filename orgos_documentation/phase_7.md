# Phase 7: Multi-Agent Model Layer & Prompt Engineering

## Overview
OrgOS utilizes an AI agent team to automate employee onboarding. Each agent acts as a specialized department persona with distinct roles, system prompts, and operational rules. The Orchestrator calls these agents sequentially, constructing customized user prompts dynamically with target context before invoking the LLM.

---

## Key Source Files
- `org-os-notion/server/src/agents/index.ts` (Agent definitions and agent thought runner)

---

## Agent System Prompt Configurations
Each agent is represented by the `Agent` interface, which defines its name, role description, and system prompt.

```typescript
export interface Agent {
  name: 'PM' | 'Finance' | 'Engineering';
  role: string;
  systemPrompt: string;
}
```

The system prompts establish the persona constraints, behavioral boundaries, and expectations for output format.

### 1. Product Manager (PM) Agent
- **Identity Name**: `PM`
- **Department Role**: `Product Manager Agent`
- **System Prompt**:
  `"You are the Product Manager Agent in OrgOS. You gather onboarding details, compile employee profiles, and specify roles and responsibilities."`

### 2. Finance Agent
- **Identity Name**: `Finance`
- **Department Role**: `Finance Agent`
- **System Prompt**:
  `"You are the Finance Agent in OrgOS. You audit compensation, budgets, equipment procurement costs, and request human-in-the-loop sign-off."`

### 3. Engineering Agent
- **Identity Name**: `Engineering`
- **Department Role**: `Engineering Agent`
- **System Prompt**:
  `"You are the Engineering Agent in OrgOS. You handle technical setup like GitHub account provisioning, system access, and credentials generation."`

---

## Dynamic Prompt Construction & Context Injection
Prompts are not static; the Orchestrator injects current onboarding session data into the user prompt dynamically. This bridges the gap between state data and the LLM's understanding.

### Context Injection Parameters

#### A. Product Manager Spec Generation Prompt
- **Context Injected**: Employee name, Role, Department.
- **Construction Template**:
  ```typescript
  `Create onboarding spec, decide role-specific tasks, and generate checklist for ${session.record.employeeName} (${session.record.role} in ${session.record.department})`
  ```

#### B. Engineering Accounts Provisioning Summary Prompt
- **Context Injected**: Employee name, GitHub username, GitHub invitation status, issue creation status, calendar scheduling results.
- **Construction Template**:
  ```typescript
  `Onboarding engineering setup for ${session.record.employeeName} (GitHub: ${session.record.githubUsername}) completed.
  Summary of actions:
  - Verified GitHub username (User ID: ${userId}).
  - Sent organization invitation.
  ${issueNum ? `- Created onboarding issue #${issueNum}.` : `- Failed to create onboarding issue (partial success).`}
  
  Generate the final engineering setup summary, credentials confirmation, and deployment tasks.`
  ```

---

## Agent Invocation Flow
The system instructions are appended to the user-injected task prompt inside the `runAgentThought` engine before sending the request to the generative language endpoint.

```typescript
const requestBody = {
  contents: [{
    parts: [{
      text: `System instructions: ${agent.systemPrompt}\n\nTask: ${prompt}`
    }]
  }]
};
```

---

## Agent Response & Output Expectations

To ensure seamless downstream execution, the agents are prompted to structure their text responses with clear markdown sections:

### 1. Product Manager Output Expectation
- Onboarding plan header
- Role & Department specification
- Week 1 checklist (company orientation, team leads, sprint reviews, workspace setup)
- 30-day targets
- Measurable success markers (e.g. PR merged in 2 weeks)

### 2. Finance Output Expectation
- Budget verification report
- Salary comparisons against departmental limits
- Standard equipment and workspace costs ($3,500 limit)
- Total first-year cost projections
- Recommendation for final manual approval

### 3. Engineering Output Expectation
- Account provision status (GitHub organization invite details)
- Access permissions checklist (Google Workspace, Chat, password vaults, staging environments)
- Credentials confirmation status
- Manual verification and deployment sign-off checklist

---

## Agent Execution State Flowchart
```
  [Orchestrator Session State]
               │
               ▼
   [Select Agent & Gather State]
               │
               ▼
[Format Dynamic Prompt with Session Data]
               │
               ▼
   [Prepend Agent System Prompt]
               │
               ▼
    [Invoke runAgentThought()]
               │
               ▼
  [Validate & Save Response to DB]
```
