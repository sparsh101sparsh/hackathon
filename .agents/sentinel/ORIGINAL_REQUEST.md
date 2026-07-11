# Original User Request

## Initial Request — 2026-07-12T00:38:53+05:30

# Teamwork Project Prompt — Draft

Reverse engineer the OrgOS codebase and generate comprehensive markdown documentation. A team of agents will work simultaneously to research and write separate `.md` files for each of the 20 specified documentation phases (e.g., Phase 1, Phase 2, etc.).

Working directory: ~/teamwork_projects/orgos_documentation
Integrity mode: development

## Requirements

### R1. Parallel Execution
The teamwork system must distribute the documentation work across multiple agents, working simultaneously to document the 20 phases.

### R2. Separate Phase Files
Each documentation phase must be generated as its own markdown file (e.g., `phase_1.md`, `phase_2.md`, up to `phase_20.md`) within the working directory.

### R3. Reverse Engineering
The agents must analyze the existing OrgOS source code (located at `/Users/iamsparsh00321/Desktop/cognitivehackathon`) to accurately document all required details for each phase.

## Acceptance Criteria

### Verification
- [ ] Exactly 20 separate `.md` files are created in the `~/teamwork_projects/orgos_documentation` directory.
- [ ] The files are sequentially named `phase_1.md` through `phase_20.md`.
- [ ] Each file contains comprehensive, well-formatted markdown content addressing its specific documentation phase (e.g., architecture, API documentation, component hierarchy, etc.).
- [ ] The documentation accurately reflects the actual state of the OrgOS codebase.
