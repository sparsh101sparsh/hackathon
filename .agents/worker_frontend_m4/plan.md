# Plan - Implement Milestone 4

## Steps

1. **Calculate two new metrics in `client/src/App.tsx`**:
   - `pendingInvitesCount`: Count of logs in `notionAuditLogs` where `actionExecuted` contains `"✓ Invitation sent."`
   - `issuesCreatedCount`: Count of logs in `notionAuditLogs` where `actionExecuted` matches `/✓ Issue #/`
   - Redefine `gitHubActionCount` as the sum of `pendingInvitesCount` and `issuesCreatedCount`.

2. **Add two new cards in the `stats-row` dashboard grid in `client/src/App.tsx`**:
   - Card 1: "Pending Invites", value: `pendingInvitesCount`, subtext: "sent"
   - Card 2: "Issues Created", value: `issuesCreatedCount`, subtext: "checklists"
   - Ensure the new cards match the existing `stat-card` markup and structure.

3. **Update `.stats-row` grid layout in `client/src/index.css`**:
   - Change `grid-template-columns: repeat(6, 1fr);` to `grid-template-columns: repeat(8, 1fr);` (since we now have 8 cards: 6 existing + 2 new).
   - Alternatively, use `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));`.
   - Update media queries:
     - `@media (max-width: 1180px)`: Let's adjust this grid layout (e.g., handling 8 cards, maybe repeat(4, 1fr) or auto-fit).
     - `@media (max-width: 800px)`: Make sure it degrades to 1fr or 2fr depending on screen width.

4. **Verify TypeScript compilation and frontend build**:
   - Run `npm run build:client` from the root directory `/Users/iamsparsh00321/Desktop/cognitivehackathon/org-os-notion` to ensure everything compiles and builds without any errors.

5. **Write handoff report**:
   - Create the handoff report in `.agents/worker_frontend_m4/handoff.md`.
