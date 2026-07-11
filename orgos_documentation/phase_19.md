# Phase 19: Complete Glossary

This glossary defines the core technical concepts and acronyms used throughout the OrgOS codebase.

- **Agent:** An autonomous software entity powered by an AI language model (like Gemini). In OrgOS, agents are assigned specific roles (PM, Finance, Engineering) and are given instructions to process data and generate structured outputs.
- **API (Application Programming Interface):** A set of rules that allows different software applications to talk to each other. For example, OrgOS uses the GitHub API to automate sending org invites.
- **CI/CD (Continuous Integration / Continuous Deployment):** A method to frequently deliver apps to customers by introducing automation into the stages of app development.
- **Endpoint:** A specific URL where an API can be accessed. For instance, `POST /api/onboard` is the endpoint used to start a workflow.
- **Express:** A minimal and flexible Node.js web application framework that provides a robust set of features for building the OrgOS backend.
- **JSON (JavaScript Object Notation):** A lightweight, text-based data interchange format. It is the primary format used by the React frontend to send data to the Express backend, and the format used by Gemini to return agent thoughts.
- **JWT (JSON Web Token):** A compact, URL-safe means of representing claims to be transferred between two parties. Used for securely transmitting information (like user authentication status).
- **LLM (Large Language Model):** A type of artificial intelligence algorithm that uses deep learning techniques and massively large data sets to understand, summarize, generate and predict new content. Gemini 2.5 Flash is the LLM powering OrgOS.
- **MCP (Model Context Protocol):** An open standard that enables AI models to securely connect to local data sources and external tools.
- **Middleware:** Software that bridges gaps between other applications, tools, and databases in order to provide unified services to users. In Express, middleware functions execute during the lifecycle of an HTTP request.
- **OAuth (Open Authorization):** An open standard for access delegation, commonly used as a way for internet users to grant websites or applications access to their information on other websites but without giving them the passwords. OrgOS uses this to access Google Calendar.
- **Orchestrator:** The central logic controller in OrgOS. It does not perform tasks itself, but rather holds the state of the workflow and directs the Agents to act at the appropriate times.
- **REST (Representational State Transfer):** An architectural style for providing standards between computer systems on the web, making it easier for systems to communicate.
- **SSE (Server-Sent Events):** A standard describing how servers can initiate data transmission towards clients once an initial client connection has been established. This is how the OrgOS frontend receives real-time agent updates without polling.
- **State Machine:** A mathematical model of computation. OrgOS workflows operate as a state machine, moving strictly from one state (e.g., `INIT`) to another (e.g., `PM_PHASE`).
- **TypeScript:** A strict syntactical superset of JavaScript that adds optional static typing to the language. It is used throughout OrgOS to catch errors at compile-time rather than run-time.
- **Vite:** A build tool that aims to provide a faster and leaner development experience for modern web projects. It powers the React frontend of OrgOS.
- **Webhook:** A method of altering the behavior of a web page or web application with custom callbacks. Usually triggered by an event.
