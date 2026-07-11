# Phase 18: Complete Execution Timeline

This timeline traces the exact sequence of events from starting the development server to the final completion of a workflow.

## Startup
1. **Developer:** Executes `npm run dev` in the terminal.
2. **Backend:** Express server initializes, binds to port 3001, and establishes the `/api/events` route.
3. **Frontend:** Vite dev server initializes, compiles React, and binds to port 5173.
4. **Browser:** Opens `http://localhost:5173`.
5. **Mount:** React mounts the `<App>` component.
6. **SSE Connection:** `<App>` establishes an `EventSource` connection to `http://localhost:3001/api/events`. The backend registers the client.

## Workflow Execution
7. **User Action:** Fills out the onboarding form and clicks "Submit".
8. **HTTP POST:** Client sends payload to `POST /api/onboard`.
9. **Orchestrator:** Creates a new `WorkflowState` object with a UUID. State is set to `INIT`.
10. **Event Emission:** Orchestrator emits `STATE_CHANGED`. The backend SSE route pushes this JSON to the browser.
11. **UI Update:** React re-renders, displaying the new workflow in the pipeline.
12. **Agent Trigger:** The Orchestrator automatically advances the state to `PM_PHASE` and invokes the PM Agent.
13. **LLM Call 1:** PM Agent queries Gemini 2.5 Flash. Takes ~5 seconds.
14. **Agent Trigger:** Orchestrator advances state to `FINANCE_PHASE` and invokes the Finance Agent.
15. **LLM Call 2:** Finance Agent queries Gemini. Takes ~5 seconds.
16. **Pause:** Orchestrator sets state to `WAITING_FINANCE_APPROVAL`. Execution pauses.

## Human Intervention
17. **User Action:** User clicks the green "Approve Budget" button in the UI.
18. **HTTP POST:** Client sends payload to `POST /api/approve/:id`.
19. **Resumption:** Orchestrator advances state to `ENGINEERING_PHASE`.
20. **Service Calls:** Engineering Agent executes hardcoded logic:
    - Calls Google Calendar API to schedule an event.
    - Calls Gmail API to send the welcome email.
    - Calls GitHub API to invite the user.
    - Calls GitHub API to create an issue.
21. **Pause:** Orchestrator sets state to `WAITING_ENGINEERING_APPROVAL`.

## Finalization
22. **User Action:** User clicks "Sign Off".
23. **Persistence:** The Orchestrator calls the `notion.writeRecord()` function.
24. **API Call:** The Notion API receives the massive JSON payload representing the entire workflow history and writes it to the databases.
25. **Completion:** State is set to `COMPLETED`. SSE pushes the final update. The UI moves the workflow card to the "History" column.
