# Phase 12: Auditor Agent - Architectural Compliance Audits

## 1. Overview and Scope
Under Phase 12, the **Auditor Agent** acts as an architectural gatekeeper. It enforces compliance with the **Notion Track principles** defined in the project architecture. In particular, it validates that:
1. **Notion is not abused as a Message Bus**: No asynchronous polling, subscription loops, or continuous listen patterns are allowed to target Notion directly.
2. **Strict Agent Scope Isolation**: The agent communication layer (`agents/index.ts`) must never import or query the Notion database directly. All agent-to-agent and state coordination operations must happen in-memory.
3. **Orchestrator Query Restrictions**: The main orchestrator (`orchestrator/index.ts`) must only write state updates to Notion databases at final outcome points. It is restricted from querying or polling database pages during execution loops.
4. **Environment Health**: Checks environment variables required for Notion databases and external model configurations.
5. **Process Exit Enforcement**: Returns failure signals (`process.exit(1)`) to ensure failing architectural audits block build pipelines.

---

## 2. Key Source File
- **Path**: `org-os-notion/server/src/auditor/index.ts`
- **Language**: TypeScript (Node.js)

---

## 3. Technical Content and Implementation Details

### A. Polling and Subscription Syntax Detectors
To ensure Notion remains a durable write-only logs/decision storage system rather than an active polling interface, the auditor uses a list of regex-based syntax detectors (`PATTERNS_NOTION_MESSAGE_BUS`) to inspect source files (excluding the auditor codebase itself).

#### Code Snippet (Regex Definitions)
```typescript
const PATTERNS_NOTION_MESSAGE_BUS = [
  /notion.*poll/i,
  /poll.*notion/i,
  /notion.*subscribe/i,
  /setInterval.*notion/i,
  /notion.*listen/i,
  /queryNotion.*agent/i,
];
```

#### Verification Function (`auditNotionMessageBus`)
```typescript
function auditNotionMessageBus(): AuditResult {
  const files = walkDir(SRC_ROOT, '.ts').filter(
    // Exclude the auditor itself — it defines these patterns as strings
    f => !f.includes('auditor/')
  );
  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
      for (const pattern of PATTERNS_NOTION_MESSAGE_BUS) {
        if (pattern.test(line)) {
          violations.push(`  ${path.relative(SRC_ROOT, file)}:${i + 1} → ${line.trim().substring(0, 80)}`);
        }
      }
    });
  }

  return {
    check: 'Notion Not Used as Message Bus',
    passed: violations.length === 0,
    detail: violations.length === 0
      ? 'Notion is exclusively used as a write-only durable memory store. No polling or message-bus patterns found.'
      : `VIOLATIONS:\n${violations.join('\n')}`,
  };
}
```

---

### B. Agent Scope Import Restrictions
Agent files in `agents/index.ts` are audited to verify isolation:
- They must not import the Notion library or services (`/from.*notion/i`).
- They must not contain any notion polling patterns.

#### Code Snippet (`auditAgentCommunication`)
```typescript
function auditAgentCommunication(): AuditResult {
  // Verify agents export no poll/read-from-Notion methods
  const agentFile = path.join(SRC_ROOT, 'agents/index.ts');
  if (!fs.existsSync(agentFile)) {
    return { check: 'Agent Communication In-Memory Only', passed: false, detail: 'agents/index.ts not found' };
  }
  const content = fs.readFileSync(agentFile, 'utf8');
  
  // Agents should not import notion
  const importsNotion = /from.*notion/i.test(content);
  // Agents should not poll or query
  const pollsNotion = PATTERNS_NOTION_MESSAGE_BUS.some(p => p.test(content));

  return {
    check: 'Agent Communication In-Memory Only',
    passed: !importsNotion && !pollsNotion,
    detail: importsNotion
      ? 'WARNING: agents/index.ts imports from notion — agents should not directly access Notion'
      : pollsNotion
      ? 'WARNING: agents/index.ts contains Notion polling pattern'
      : 'Agents communicate solely via in-memory function calls. No Notion reads in agent layer.',
  };
}
```

---

### C. Orchestrator Query Restrictions
The orchestrator coordinates the agents' activities and updates. It should only write final outcomes (e.g., `createDecision`, `createAuditLog`, `createOnboardingRecord`). Reading or querying databases (`notionClient.databases.query`, etc.) inside the orchestrator flow is flagged as a compliance violation.

#### Code Snippet (`auditNotionOnlyWriteOnFinalState`)
```typescript
function auditNotionOnlyWriteOnFinalState(): AuditResult {
  const orchFile = path.join(SRC_ROOT, 'orchestrator/index.ts');
  if (!fs.existsSync(orchFile)) {
    return { check: 'Notion Write-Only at Outcome Points', passed: false, detail: 'orchestrator/index.ts not found' };
  }
  const content = fs.readFileSync(orchFile, 'utf8');
  
  const usesCreate = /createDecision|createAuditLog|createOnboardingRecord/.test(content);
  const usesQuery = /notionClient\.databases\.query|notionClient\.pages\.retrieve|queryDatabase/i.test(content);
  
  return {
    check: 'Notion Write-Only at Outcome Points',
    passed: usesCreate && !usesQuery,
    detail: !usesCreate
      ? 'Orchestrator never writes to Notion — integration may be broken'
      : usesQuery
      ? 'Orchestrator queries Notion inside agent loop — VIOLATION of architecture'
      : 'Orchestrator writes decisions, audit logs, and onboarding records to Notion only at final outcome points.',
  };
}
```

---

### D. Environment Checks and Reporting
The auditor verifies the existence of required environment variables, preventing failures due to missing configurations at runtime.

```typescript
function auditEnvVars(): AuditResult {
  const required = [
    'NOTION_API_KEY',
    'GEMINI_API_KEY',
    'NOTION_DECISIONS_DATABASE_ID',
    'NOTION_AUDIT_LOGS_DATABASE_ID',
    'NOTION_ONBOARDING_DATABASE_ID',
  ];
  const missing = required.filter(k => !process.env[k]);
  return {
    check: 'All Required Env Vars Present',
    passed: missing.length === 0,
    detail: missing.length === 0
      ? `All ${required.length} required env vars are present and loaded from .env`
      : `Missing env vars: ${missing.join(', ')}`,
  };
}
```

---

## 4. Operational Flowchart & Process Exit Indicators

The orchestrator executes the audits sequentially. If any audit reports `passed === false`, the entire compliance run fails, printing a warning banner and immediately stopping execution with code `1`.

```
[Start Compliance Run]
         │
         ├───► Run: auditNotionMessageBus()
         ├───► Run: auditAgentCommunication()
         ├───► Run: auditEnvVars()
         └───► Run: auditNotionOnlyWriteOnFinalState()
         │
         ▼
[Check Results List]
         │
         ├───► Did ANY audit return passed == false?
         │         │
         │         ▼ (YES)
         │   [Print Violation Details]
         │   [process.exit(1)] ──► Exits program & fails CI/CD
         │
         ▼ (NO)
   [Print Compliant Banner]
   [Exit Gracefully (code 0)]
```
