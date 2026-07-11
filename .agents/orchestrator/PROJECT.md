# Project: OrgOS Reverse Engineering Documentation

## Architecture
- **React Frontend**: Vite + React, Tailwind CSS, live feed streaming, approvals dashboard, metrics integration.
- **Express Backend**: Express server, Server-Sent Events (SSE) for agent streaming, in-memory state machine orchestrator.
- **AI Agents**: PM Agent, Finance Agent, Engineering Agent powered by Gemini 2.5 Flash with multi-key API fallback logic.
- **Notion Database Memory**: Notion API integrating Decisions, Audit Logs, and Onboarding Records.
- **External Services**: GitHub REST API (organization invites, issue creation), Google Calendar (orientation event scheduling), Gmail API (welcome emails).
- **Compliance & Auditing**: Forensic architecture auditor verifying that agent communication remains in-memory and Notion is not used as a message bus.

## Code Layout
- `client/` - React frontend
- `server/` - Express backend
- `calendarandemail/` - Google Calendar and Gmail integration package
- `scripts/` - Notion database setup scripts

## Defined Documentation Phases
- **Phase 1**: Architecture Overview and System Design
- **Phase 2**: Environment Configuration and Setup
- **Phase 3**: Core Shared Data Models and Type Definitions
- **Phase 4**: Notion Schema Setup and Scaffolding Script
- **Phase 5**: Notion Integration - Real Client API Controller
- **Phase 6**: Notion Integration - Local Thread-Safe Mock Database
- **Phase 7**: Multi-Agent Model Layer & Prompt Engineering
- **Phase 8**: Gemini API Request Engine and Fallback Controller
- **Phase 9**: In-Memory Orchestrator and Workflow State Machine
- **Phase 10**: Human-in-the-Loop Gatekeepers & Resolutions
- **Phase 11**: Auditor Agent - Secrets Detection Audits
- **Phase 12**: Auditor Agent - Architectural Compliance Audits
- **Phase 13**: Express API Server Routes & Controllers
- **Phase 14**: Server-Sent Events (SSE) Bus and Streaming Engine
- **Phase 15**: Google Workspace OAuth 2.0 Auth Loop
- **Phase 16**: Google Calendar Orientation Event Scheduler
- **Phase 17**: Gmail Welcome Transactional Email Dispatcher
- **Phase 18**: GitHub User Verification & Onboarding Issue Generator
- **Phase 19**: React Web Client & Live Dashboard
- **Phase 20**: React Glassmorphism Styling & Layout Theme

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Phase Definition | Spawn Explorer to reverse-engineer codebase and define the 20 phases | None | DONE |
| 2 | Phases 1-5 Generation | Write phase_1.md through phase_5.md | M1 | IN_PROGRESS |
| 3 | Phases 6-10 Generation | Write phase_6.md through phase_10.md | M2 | PLANNED |
| 4 | Phases 11-15 Generation | Write phase_11.md through phase_15.md | M3 | PLANNED |
| 5 | Phases 16-20 Generation | Write phase_16.md through phase_20.md | M4 | PLANNED |
| 6 | Verification & Final Review | Run Reviewer agent to verify correctness of all 20 documentation files | M5 | PLANNED |

## Interface Contracts
- Each documentation phase must be generated as its own markdown file (named `phase_1.md` through `phase_20.md`) in `/Users/iamsparsh00321/teamwork_projects/orgos_documentation`.
- Every file must include a title, detailed technical summary of the component/feature, API contracts, dependencies, and code references.
