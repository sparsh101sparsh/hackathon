# OrgOS: Autonomous AI Employee Onboarding System

OrgOS is an autonomous, multi-agent enterprise operating system built to streamline and automate employee onboarding. It employs an AI-native design with three specialized agents that execute business workflows sequentially, managed by a centralized, in-memory state machine.

## Multi-Agent Architecture

OrgOS orchestrates complex onboarding workflows through a roster of specialized AI agents:

1. **Product Manager (PM) Agent**: Responsible for gathering employee details, compiling profiles, defining roles, and generating tailored week-1 onboarding roadmaps and task checklists.
2. **Finance Agent**: Responsible for auditing employee compensation, verifying equipment procurement limits, evaluating team budgets, and recommending approval or rejection.
3. **Engineering Agent**: Responsible for technical provisioning, including verifying GitHub accounts, inviting users to GitHub organizations, creating GitHub issues, scheduling Google Meet orientation events, and sending automated Gmail welcome messages.

## System Workflow & Human-in-the-Loop

Workflow execution in OrgOS follows a strict, unidirectional sequence with mandatory human approval checkpoints:

1. **Ingestion**: An onboarding request is submitted.
2. **PM Planning**: The PM Agent drafts the spec and checklist.
3. **Financial Audit**: The Finance Agent computes equipment and salary costs against the budget.
4. **Approval Gate 1 (Finance)**: A human manager must approve the financial audit.
5. **Engineering Setup**: Upon approval, the Engineering Agent executes API integrations (GitHub, Calendar, Mail).
6. **Approval Gate 2 (Engineering)**: A human manager must verify the technical provisioning.
7. **Completion**: The process is finalized, and a durable audit log is written.

## Tech Stack & Project Structure

The project is structured as a monorepo containing a React frontend and an Express/Node.js backend.

* **Frontend (`/client`)**: React 18, Vite, TailwindCSS (glassmorphic dark theme), Lucide React.
* **Backend (`/server`)**: Node.js, Express, TypeScript, Server-Sent Events (SSE) for real-time live feed.
* **Integrations**: 
  * Google Gemini (AI Reasoning & Agent execution)
  * Notion (Write-only durable organizational memory and auditing)
  * GitHub API (Organization invites & Issue creation)
  * Google Workspace API (Calendar events & Gmail)

## Running Locally

To run this project locally, ensure you have Node.js installed, then configure your `.env` file based on `.env.example`.

### Commands

| Command | Operation |
| :--- | :--- |
| `npm run setup:notion` | Scaffolds Notion databases (or a mock JSON environment). |
| `npm run dev:server` | Starts the Express backend on port 3001. |
| `npm run dev:client` | Starts the React frontend using Vite. |
| `npm run test:server` | Runs the Vitest test suite for the orchestrator. |

*(For a full list of required environment variables—including Google OAuth and GitHub PAT credentials—please consult the documentation in `orgos_documentation/phase_2.md`.)*