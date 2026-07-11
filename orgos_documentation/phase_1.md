# Phase 1: Architecture Overview and System Design

## 1. Multi-Agent System Topology
OrgOS is built as an autonomous, multi-agent enterprise operating system. The core design is AI-native, employing three specialized agents that execute business workflows sequentially, managed by a centralized, in-memory state machine.

### Agent Roster and Specializations
1. **Product Manager (PM) Agent**: Responsible for gathering employee details, compiling profiles, defining roles, and generating week-1 onboarding roadmaps and task checklists.
2. **Finance Agent**: Responsible for auditing employee compensation, verifying equipment procurement limits, evaluating team/company budgets, and recommending approval/rejection.
3. **Engineering Agent**: Responsible for technical provisioning, including verifying GitHub accounts, inviting users to organizations, creating issues, scheduling orientations, and sending welcome messages.

### Rationale for In-Memory Agent Chat
Agent communication and reasoning execution occur entirely **in-memory** through direct function calls, passing state contexts, and invoking LLM prompts (via Gemini Flash with fallback strategies). Agent chatter (scratchpads, raw logs, multi-step thoughts) is kept off durable storage and never written to Notion. This ensures low-latency execution, avoids polluting corporate databases with transient brainstorming, and adheres to data privacy principles.

---

## 2. Single-Direction Data Flow
Workflow execution in OrgOS follows a strict, unidirectional sequence. There are no circular dependencies or uncontrolled loops. The process flows state-by-state, checking human gate checkpoints at crucial points:

```
[Ingestion Request]
       │
       ▼
 ┌───────────┐
 │   INGEST  │  ──► Create Initial Audit Log
 └───────────┘
       │
       ▼
 ┌───────────┐
 │  PM PLAN  │  ──► Draft Spec & Week-1 Checklist
 └───────────┘
       │
       ▼
 ┌───────────┐
 │ FIN AUDIT │  ──► Compute salary + equipment cost ($3,200) vs limit
 └───────────┘
       │
       ▼
 ┌───────────────────────────┐
 │ PENDING_FINANCE_APPROVAL  │  ◄── [HUMAN APPROVAL GATE 1]
 └───────────────────────────┘
       │
       ├──► Rejected ──► [FAILED STATE] (Write Notion Record & Log)
       └──► Approved ──► Continue
             │
             ▼
       ┌───────────┐
       │ ENG SETUP │  ──► Invite GitHub Org, Create Issue, Schedule Cal, Send Gmail
       └───────────┘
             │
             ▼
       ┌──────────────────────────┐
       │   PENDING_ENG_APPROVAL   │  ◄── [HUMAN APPROVAL GATE 2]
       └──────────────────────────┘
             │
             ├──► Rejected ──► [FAILED STATE]
             └──► Approved ──► [COMPLETED STATE] (Final Notion update)
```

---

## 3. Durable Organizational Memory Pattern
A core architectural requirement of the Notion Track is utilizing Notion **exclusively** as a write-only, durable organizational memory. 

### Principles:
* **No Message Bus Polling**: Notion is never used as a messaging queue, state coordinator, or inter-agent communication channel. The state and logs are kept in-memory or broadcast to the frontend in real time via SSE.
* **Write-Only at Outcome Points**: Notion databases are only written to when a definitive outcome or checkpoint occurs:
  1. At the ingestion stage (optional audit trace).
  2. Upon reaching human approval gates (Decisions database).
  3. When the workflow transitions to Engineering Setup audit logging.
  4. On final completion or workflow failure (updating Onboarding Records).
* **Robust Fallback**: If the Notion integration is down, rate-limited, or unconfigured, the system falls back gracefully to a mock local file-based database schema (`.mock-notion-db/`), maintaining the exact same data format.

---

## 4. Real-Time Update Push Architecture (SSE)
Instead of the frontend constantly polling the backend database for updates, OrgOS utilizes a **Server-Sent Events (SSE)** architecture. This enables immediate, real-time push notifications from the backend state machine.

### Mechanics:
1. **Event Registration**: The backend runs an in-memory event bus (`AppEventEmitter` extending Node's `EventEmitter`).
2. **Subscription**: When a client dashboard connects to `/api/events`, the server sets headers (`Content-Type: text/event-stream`, `Connection: keep-alive`) and pushes the client reference into an array.
3. **Trigger**: Whenever the orchestrator transitions state, or an agent completes a thought process, it logs the step and fires `appEvents.emit('event', { event: 'session_updated', data: ... })`.
4. **Broadcast**: The emitter subscriber loops over all active SSE client streams and writes the payload as `data: {...}\n\n`.

---

## 5. Codebase Layout Map

```
org-os-notion/
├── .env                          # Local configuration & credentials (ignored by Git)
├── .env.example                  # Template configuration structure
├── .mcp.json                     # Config for the official Notion Model Context Protocol server
├── package.json                  # Root npm workspace configuration mapping 'client' and 'server'
├── package-lock.json             # Locked dependency versions
├── scripts/
│   └── setup-notion.js           # Database scaffolding script (supports REAL/MOCK execution)
├── client/                       # React Frontend workspace
│   ├── package.json              # Client scripts, dependencies (lucide-react, react, tailwindcss)
│   ├── postcss.config.js         # CSS post-processing rules
│   ├── tailwind.config.js        # Styling design theme configurations
│   ├── vite.config.ts            # Vite compile and local proxy config
│   └── src/
│       ├── main.tsx              # React mounting entrypoint
│       ├── index.css             # Tailwind base styles and dark glassmorphic design theme
│       ├── App.tsx               # Primary Dashboard view (Live agent log feed, approvals panels, Notion DB explorer)
│       └── vite-env.d.ts         # Vite TypeScript declarations
└── server/                       # Express Backend workspace
    ├── package.json              # Server dependencies (@notionhq/client, express, googleapis, tsx, vitest)
    ├── tsconfig.json             # Backend TypeScript compilation configurations
    └── src/
        ├── index.ts              # API controller mapping HTTP endpoints & SSE stream
        ├── types.ts              # Shared TypeScript entity structures (Decision, AuditLog, etc.)
        ├── events.ts             # In-memory EventEmitter bus
        ├── agents/
        │   └── index.ts          # Agent configuration definitions & multi-key Gemini api fallback reasoning
        ├── orchestrator/
        │   ├── index.ts          # State machine logic, human approval triggers, and state execution
        │   └── index.test.ts     # Tests verifying key fallbacks & orchestrator transitions
        ├── notion/
        │   └── index.ts          # Notion API integration service with mock fallback mapper logic
        ├── services/
        │   ├── github.ts         # GitHub API communications service for user verification & invitations
        │   └── googleService.ts  # Google Calendar event insertion & Gmail welcome email sender
        └── auditor/
            └── index.ts          # Forensic architecture compliance verification agent
```
