# Phase 2: Environment Configuration and Setup

## 1. Environment Secrets and Variables
OrgOS relies on configuration parameters stored inside a `.env` file at the project root. This ensures that no credentials, tokens, or private endpoints are hardcoded in the source files. 

The complete matrix of configuration options is described below:

| Environment Variable | Description | Source / How to Obtain | Fallback Behaviour / Mock Value |
| :--- | :--- | :--- | :--- |
| `PORT` | Local port for the Express backend server. | Custom choice (default: `3001`). | Defaults to `3001`. |
| `MOCK_NOTION` | Toggle switch to toggle database modes. | Set to `false` for real API, `true` for file simulator. | Defaults to `true` if undefined. |
| `NOTION_INTEGRATION_TOKEN` <br> (or `NOTION_API_KEY`) | Official integration API credential. | Notion Developer Portal (starts with `secret_`). | If empty & `MOCK_NOTION=false`, errors out. |
| `NOTION_ROOT_PAGE_ID` <br> (or `NOTION_PARENT_PAGE_ID`) | Parent page UUID where databases are nested. | Notion URL when viewing the page. | Required for real integration. |
| `NOTION_DECISIONS_DATABASE_ID` | UUID of Decisions DB. | Returned from scaffolding script. | Required for real Notion writes. |
| `NOTION_AUDIT_LOGS_DATABASE_ID` | UUID of Audit Logs DB. | Returned from scaffolding script. | Required for real Notion writes. |
| `NOTION_ONBOARDING_DATABASE_ID` | UUID of Onboarding Records DB. | Returned from scaffolding script. | Required for real Notion writes. |
| `GEMINI_API_KEY` | Primary Gemini API Key. | Google AI Studio account console. | Falls back to in-memory fallback list, then to mock text responses. |
| `GITHUB_PAT` | Personal Access Token (PAT). | GitHub Developer Settings -> Tokens (classic). | Falls back to mock client actions if not set. |
| `GITHUB_ORG` | Targeted GitHub Organization. | GitHub Org profile page. | Used for real invitations. |
| `GITHUB_REPO` | Targeted Repository for issues. | GitHub Repo settings. | Used to insert onboarding tasks. |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID. | Google Cloud Console Credentials. | Throws error if not provided. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret. | Google Cloud Console Credentials. | Throws error if not provided. |
| `GOOGLE_REDIRECT_URI` | Authorized OAuth Redirect URL. | Google Cloud Console Credentials. | Defaults to `http://localhost`. |
| `GOOGLE_REFRESH_TOKEN` | Refresh token to bypass user login. | Google OAuth playground extraction. | Falls back to `/calendarandemail/token.json` if exists. |

---

## 2. Calculation Logic and Currencies
The system defaults to **USD ($)** for currency formatting. It calculates first-year compensation and equipment budgets as follows:
* **Standard Equipment Bundle Cost**: Hardcoded inside the Finance Agent audit phase at **$3,200** (representing laptop, monitors, and workspace accessories).
* **Headcount Budget Cap**: Default corporate limit set at **$5,000,000** (or customized via `OnboardingRecord.companyBudget`).
* **Formula**:
  $$\text{Total Cost} = \text{Salary} + \$3,200$$
  $$\text{Remaining Budget} = \text{Company Budget} - \text{Total Cost}$$
* **Audit Logic**: If $\text{Total Cost} > \text{Company Budget}$, the Finance Agent automatically issues a **Rejected** status decision, halting execution and changing `onboardingStatus` to `Failed` without requesting human approval. If valid, it transitions to `PENDING_FINANCE_APPROVAL`.

---

## 3. Package Dependency Matrices

### Root Workspace (`package.json`)
The root orchestrates workspaces and defines shared execution wrappers:
* **Workspaces**: `["client", "server"]`
* **Dependencies**:
  * `@notionhq/client` (`^2.2.15`): Official Notion API software development kit.
  * `dotenv` (`^16.4.5`): Parses `.env` configurations.

### Server Workspace (`server/package.json`)
* **Dependencies**:
  * `cors` (`^2.8.5`): Handles cross-origin requests from the React frontend.
  * `express` (`^4.19.2`): The HTTP web framework.
  * `googleapis` (`^173.0.0`): Google client interface for Gmail & Calendar API access.
* **DevDependencies**:
  * `typescript` (`^5.4.5`): Typings compiler.
  * `tsx` (`^4.15.7`): Executes TS files directly (watches during development).
  * `vitest` (`^4.1.10`): Fast, lightweight test suite processor.
  * `@types/node`, `@types/express`, `@types/cors`

### Client Workspace (`client/package.json`)
* **Dependencies**:
  * `react` / `react-dom` (`^18.3.1`): Main web user interface framework.
  * `lucide-react` (`^1.24.0`): Premium iconography assets.
* **DevDependencies**:
  * `vite` (`^5.3.1`): Build tool.
  * `tailwindcss` / `autoprefixer` (`^3.4.4`): Tailwind style compilation engine.

---

## 4. Operational Scripts & Commands

| Command | Working Directory | Operation Performed |
| :--- | :--- | :--- |
| `npm run setup:notion` | Project Root | Initiates `setup-notion.js` to scaffold databases (either in the Cloud or mock JSON). |
| `npm run dev:server` | Project Root | Starts backend server watcher (runs `tsx watch src/index.ts`). |
| `npm run dev:client` | Project Root | Starts client server (runs `vite`). |
| `npm run build:server` | Project Root | Compiles server code to JavaScript using `tsc`. |
| `npm run build:client` | Project Root | Compiles client assets and generates distribution bundle. |
| `npm run test:server` | Project Root | Initiates Vitest engine on server code. |
| `npm run dev` | `server/` | Direct command to start watcher locally on port 3001. |
| `npm run audit` | `server/` | Triggers the architectural forensic auditor validation process. |
