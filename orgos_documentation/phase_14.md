# Phase 14: Performance Audit

A technical breakdown of the system's performance characteristics and bottlenecks.

## Expensive Renders
- **The Global `<App>` State:** The `<App>` component holds the entire `workflows` array. Every time an SSE event is received (which happens frequently as agents think), the entire React component tree re-renders. 
- **Fix:** Implement `React.memo` on subcomponents like `<WorkflowCard>` so they only re-render if their specific workflow object changes.

## Network Waterfalls
- **Sequential Agents:** The PM and Finance agents execute sequentially. The orchestrator waits for PM to finish before starting Finance.
- **Opportunity:** Since the PM and Finance agents don't strictly depend on each other's direct outputs (they both only need the employee details), they could be executed in parallel using `Promise.all()`, cutting the total processing time in half (saving ~10-15 seconds).

## Bundle Size
- **Frontend:** The Vite build process natively tree-shakes dependencies, keeping the frontend extremely lightweight.
- **Backend Leakage:** A critical audit check must ensure that heavy backend libraries (like `googleapis` or `@notionhq/client`) are never accidentally imported into the React frontend, which would bloat the client-side bundle immensely.

## Memory Considerations
- **In-Memory Leaks:** Workflows are stored in a JavaScript `Map`. Once a workflow is marked as `COMPLETED` and written to Notion, it technically stays in the `Map` forever. 
- **Fix:** Implement a garbage collection routine or LRU cache to evict completed workflows from the orchestrator's memory after 24 hours.
