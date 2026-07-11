## 2026-07-11T18:14:02Z
Implement Milestones 2 and 3 of the GitHub integration scope.

Objectives:
1. Create `server/src/services/github.ts` implementing `githubService` using native global `fetch`.
   - Read env vars: `GITHUB_PAT`, `GITHUB_ORG`, `GITHUB_REPO`, and `MOCK_GITHUB` (fallback to mock mode if `MOCK_GITHUB === 'true'` or `GITHUB_PAT` is not defined).
   - Implement `verifyUsername(username: string): Promise<number>` (returns user ID or throws).
   - Implement `inviteToOrg(userId: number): Promise<void>`.
   - Implement `createOnboardingIssue(employeeName: string, githubUsername: string): Promise<{ number: number }>`.
   - Return realistic mock responses in mock mode.
2. In `server/src/notion/index.ts`, export a service object wrapper:
   ```typescript
   export const notionService = {
     createDecision,
     createAuditLog,
     createOnboardingRecord,
     getNotionData
   };
   ```
3. Update the Engineering Agent workflow in `server/src/orchestrator/index.ts` under the `ENGINEERING_SETUP` block:
   - Stream the exact progress sequence using `logStep`:
     * "Engineering Agent initialized."
     * "Checking GitHub username..."
     * (Verify username using `githubService`)
     * "✓ Username exists."
     * "Preparing organization invitation..."
     * (Invite to organization using `githubService`)
     * "✓ Invitation sent."
     * "Creating onboarding issue..."
     * (Create onboarding issue using `githubService` with the specified checklist. Implement failure recovery: retry once on failure, if still fails, log the failure and mark as partial success in Notion, but continue the workflow).
     * "✓ Issue #[ID] created." (if successful)
     * "Updating Notion..."
     * (Log the actions/outcomes using `notionService` to the Audit Log database with timestamps, agent name "Engineering", status, and reasoning)
     * "✓ Organizational memory updated."
   - Run the final `runAgentThought` for `EngineeringAgent` incorporating the action summaries.
   - Transition to `PENDING_ENG_APPROVAL` (or `FAILED` if username verification fails).
4. Run all server unit tests (`npm test` or `npx vitest` in the server directory) to ensure everything passes and the compilation is clean. Do not break any existing test assertions.

Write your handoff report to `.agents/worker_backend_m2/handoff.md` and complete your task.
