# OrgOS — AI-Native Enterprise Operating System

> **Notion Hackathon Track Submission**  
> An autonomous multi-agent system where 3 specialized AI agents (PM, Finance, Engineering) coordinate to execute business workflows. Notion serves exclusively as the durable company memory — never as a message bus.

---

## Architecture

```
React Frontend (Vite)
        ↓  HTTP / SSE
OrgOS Orchestrator (Express + in-memory state machine)
        ↓  in-memory function calls
PM Agent ↔ Finance Agent ↔ Engineering Agent (Gemini 2.5 Flash reasoning)
        ↓  External API calls (Engineering)
GitHub (Org Invites, Issues) + Google Calendar (Events) + Gmail (Welcome Emails)
        ↓  write-only at outcome points
Notion (Decisions DB, Audit Logs DB, Onboarding Records DB)
```

**Key Principle:** Agent chatter stays in the orchestrator. Notion only receives finalized outcomes.

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 18
- A Notion integration token
- A Gemini API key

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
NOTION_API_KEY=ntn_your_token_here
NOTION_PARENT_PAGE_ID=your_parent_page_id
GEMINI_API_KEY=AIzaSy_your_key_here
MOCK_NOTION=false   # set to 'true' for local mock mode

# GitHub Integration
GITHUB_PAT=ghp_your_personal_access_token
GITHUB_ORG=orgos-hackathon
GITHUB_REPO=employee-onboarding

# Google Calendar & Gmail Integration
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost
```

### 3. Set Up Notion Databases
```bash
npm run setup:notion
```

This creates 3 databases under your parent page:
- ⚖️ OrgOS — Decisions
- 📋 OrgOS — Audit Logs  
- 👤 OrgOS — Onboarding Records

Copy the database IDs into your `.env`:
```env
NOTION_DECISIONS_DATABASE_ID=...
NOTION_AUDIT_LOGS_DATABASE_ID=...
NOTION_ONBOARDING_DATABASE_ID=...
```

### 4. Install Dependencies
```bash
npm install
cd server && npm install
cd ../client && npm install
```

### 5. Run Locally
```bash
# Terminal 1 — Backend (port 3001)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && npm run dev
```

Open http://localhost:5173

---

## Employee Onboarding Workflow

Submitting a new employee in the UI triggers the full autonomous pipeline:

| Step | Agent | Action |
|------|-------|--------|
| 1 | System | Ingests onboarding request |
| 2 | PM | Drafts onboarding spec, generates role checklist (Gemini) |
| 3 | Finance | Audits salary & equipment budget (Gemini) |
| 4 | **Human** | ⏳ Manager approves or rejects Finance budget |
| 5 | Engineering | Provisions GitHub Org access, creates Onboarding Issue, schedules Google Calendar Orientation, sends Welcome Gmail |
| 6 | **Human** | ⏳ Engineering lead signs off release |
| 7 | System | Writes final record to Notion. Onboarding Complete. |

---

## Commands

| Command | What it does |
|---------|-------------|
| `npm run setup:notion` | Creates Notion databases |
| `cd server && npm run dev` | Starts backend server with hot-reload |
| `cd client && npm run dev` | Starts React frontend |
| `cd server && npm test` | Runs 17-test suite (concurrency, state machine, Gemini) |
| `cd server && npm run audit` | Runs forensic architecture auditor |
| `cd server && npm run build` | TypeScript compile check |

---

## Forensic Auditor

The project ships with an independent auditor agent that verifies Notion Track compliance:

```bash
cd server && npm run audit
```

It checks:
1. ✅ No hardcoded API keys in source code
2. ✅ Notion not used as a message bus (no polling patterns)
3. ✅ Agent communication is in-memory only (agents don't import Notion)
4. ✅ All required env vars present
5. ✅ Orchestrator writes to Notion only at outcome points

---

## Notion MCP Server

The project includes `.mcp.json` for the official Notion MCP server integration:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer YOUR_TOKEN\", \"Notion-Version\": \"2022-06-28\"}"
      }
    }
  }
}
```

---

## Project Structure

```
org-os-notion/
├── .env                          # API keys (never committed)
├── .env.example                  # Template
├── .mcp.json                     # Notion MCP server config
├── scripts/
│   └── setup-notion.js           # Creates Notion databases
├── client/                       # React + Vite frontend
│   └── src/
│       ├── App.tsx               # Dashboard (pipeline, approvals, Notion explorer)
│       └── index.css             # Premium dark glassmorphism UI
└── server/                       # Express backend
    └── src/
        ├── index.ts              # API routes + SSE events
        ├── types.ts              # Shared TypeScript types
        ├── events.ts             # In-memory event bus
        ├── agents/index.ts       # PM, Finance, Engineering agents + Gemini
        ├── orchestrator/index.ts # State machine + human approval gates
        ├── notion/index.ts       # Dual-mode: real Notion API + mock fallback
        └── auditor/index.ts      # Forensic architecture auditor
```

---

## Notion Track Compliance

| Requirement | Status |
|-------------|--------|
| Notion as durable organizational memory | ✅ |
| Notion NOT used as message bus | ✅ |
| Agent communication in-memory only | ✅ |
| Human approval gates | ✅ |
| Exactly 3 agents (PM, Finance, Engineering) | ✅ |
| All secrets in .env, none hardcoded | ✅ |
| Local-first execution (no cloud orchestration) | ✅ |
| Mock fallback when Notion unavailable | ✅ |

---

*Built for the Cognitive Hackathon — Notion Track*
