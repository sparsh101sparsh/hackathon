# Phase 13: Deployment

OrgOS is designed to be deployed in a distributed environment utilizing serverless and containerized platforms.

## Production Topology

```mermaid
flowchart TD
    DNS[Domain / Route53] --> CDN[Vercel Edge Network]
    CDN --> FE[Frontend Static Assets (Vite App)]
    
    FE --> BE[Railway Express Server Docker Container]
    
    BE --> Notion[(Notion API)]
    BE --> Gemini[(Gemini API)]
    BE --> External[(Google/GitHub APIs)]
```

## Platform Justification
- **Frontend (Vercel):** The Vite-compiled React app is purely static HTML/CSS/JS. Vercel provides world-class global CDN distribution for static assets, ensuring rapid load times.
- **Backend (Railway):** The Express server requires a long-lived process to maintain open HTTP connections for Server-Sent Events (SSE) and to persist the in-memory orchestrator state. Railway provides simple container orchestration that prevents aggressive cold starts (unlike Vercel Serverless Functions).

## Critical Constraints
- **Scaling Limits:** Because the Orchestrator holds the `activeWorkflows` in a JavaScript Map, the Railway deployment *cannot* be horizontally scaled across multiple instances without losing state. 
- **Workaround:** If horizontal scaling is required, the state machine must be decoupled from Node.js memory and moved into a distributed cache like Redis or a dedicated workflow engine (e.g., Temporal).

## Environment Variables
Both environments must securely inject the following variables:
- `NOTION_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`
- `GITHUB_PAT`

## CI/CD Pipeline
- **Triggers:** Push to `main` branch.
- **Build Process:**
  1. Frontend: `npm run build` generates `dist/`.
  2. Backend: `tsc` compiles TypeScript to `build/`.
- **Testing:** The CI pipeline runs `npm test` (the 17-test suite) and `npm run audit` (the forensic auditor) before allowing the deployment to succeed.
