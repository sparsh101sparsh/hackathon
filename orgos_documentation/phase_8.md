# Phase 8: Gemini API Request Engine and Fallback Controller

## Overview
The request routing layer handles all generative AI communication in OrgOS. It accesses Google's Gemini API and utilizes a robust execution architecture that handles API rate limits, model deprecations, connection timeouts, and offline states. If the system detects network issues or missing keys, it falls back to a deterministic offline template generator that simulates agent responses.

---

## Key Source Files
- `org-os-notion/server/src/agents/index.ts` (Core request runner, API fallback loop, and token cost estimator)

---

## Technical Architecture

### A. Gemini Model Fallback Chain
Due to varying model availability, token limits, and deprecation schedules, the request engine iterates through a prioritized array of Gemini model endpoints in order:

1. `gemini-3.5-flash` (Primary fast model)
2. `gemini-3.1-pro-preview` (Advanced reasoning fallback)
3. `gemini-3-flash-preview` (Alternative preview fallback)
4. `gemini-2.5-flash` (Legacy fast model fallback)
5. `gemini-2.0-flash` (Secondary legacy fallback)

```typescript
const models = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
```

### B. API Key Round-Robin Logic
To support load-balancing and bypass rate limits (429 errors), the engine parses multiple API keys:
1. It reads the `apiKeys` argument passed to the function.
2. If omitted, it falls back to `process.env.GEMINI_API_KEY`.
3. It filters empty/falsy keys and deduplicates them using a set:
   ```typescript
   const keysToTry = apiKeys
     ? apiKeys.filter(Boolean)
     : [process.env.GEMINI_API_KEY].filter(Boolean) as string[];
   const uniqueKeys = Array.from(new Set(keysToTry));
   ```
4. **Nested Routing Loop**: For each unique key, it attempts to query the models. If a key fails (e.g. returns a 429 Rate Limit error or a generic auth failure), it marks that key as failed, breaks the inner model loop, and immediately tries the next key.

### C. Fetch Connection Timeouts
Network queries are guarded against hanging by using the modern `AbortSignal.timeout(ms)` API. It enforces a strict **12-second (12,000 ms) timeout**. If the API doesn't return a response within 12 seconds, the request aborts, throwing an error, which triggers the fallback process.

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
  signal: AbortSignal.timeout(12000)
});
```

### D. Token Cost Estimation
To log resource consumption accurately in the audit logs, the request runner estimates token usage dynamically.
- **Token Count Approximation**: Estimates that 1 token is approximately equal to 4 characters.
- **Input Tokens**: `Math.ceil((agent.systemPrompt + prompt).length / 4)`
- **Output Tokens**: `Math.ceil(text.length / 4)`
- **Pricing Factors**:
  - Input Rate: `$0.075` per 1,000,000 tokens
  - Output Rate: `$0.30` per 1,000,000 tokens
- **Cost Formula**:
  $$\text{Cost} = \left(\frac{\text{Input Tokens} \times 0.075}{1,000,000}\right) + \left(\frac{\text{Output Tokens} \times 0.30}{1,000,000}\right)$$

```typescript
const inputTokens = Math.ceil((agent.systemPrompt + prompt).length / 4);
const outputTokens = Math.ceil(text.length / 4);
const cost = (inputTokens * 0.075 / 1_000_000) + (outputTokens * 0.30 / 1_000_000);
```

---

## Offline Fallback Mock Generator Rules
When no API keys are configured, or all connection attempts time out or fail, the system invokes its offline simulation logic. This uses regular expressions to extract structured variables from the user prompt and generate context-aware mock responses.

### 1. Regex Entity Extractors
```typescript
const employeeMatch = prompt.match(/for ([A-Za-z ]+) \((.+?) in (.+?)\)/);
const name = employeeMatch?.[1] ?? 'the employee';
const role = employeeMatch?.[2] ?? 'their role';
const dept = employeeMatch?.[3] ?? 'the department';
const deptTeam = dept === 'the department' ? 'the team' : `the ${dept} team`;

const salaryMatch = prompt.match(/\$([0-9,]+)/);
const salary = salaryMatch?.[1] ?? '0';

const githubMatch = prompt.match(/GitHub: ([a-z0-9-]+)/);
const github = githubMatch?.[1] ?? 'employee';
```

### 2. Specialized Mock Responses

#### PM Agent Fallback Structure
Generates a structured markdown onboarding checklist, setting goals and week-1 milestones:
```typescript
`Onboarding plan for ${name}

Role: ${role}
Department: ${dept}

Week 1 checklist:
- Complete company orientation
- Meet the team lead
- Review the current sprint
- Set up the local dev environment
- Finish security training

30-day target: ${name} should be able to work independently with ${deptTeam}.
Success marker: first pull request merged within 2 weeks.`
```

#### Finance Agent Fallback Structure
Simulates a compensation and budget allocation review:
```typescript
`Finance review for ${name}

Salary: $${salary}/year is within the usual range for ${role} in ${dept}.
Equipment: standard laptop and peripherals fit within the $3,500 limit.
Estimated first-year cost: salary, benefits, and equipment are within the approved headcount budget.

Recommendation: approve.
A human approval is still required before engineering starts setup.`
```

#### Engineering Agent Fallback Structure
Simulates a technical setup summary for accounts and platforms:
```typescript
`Engineering setup for ${name}

GitHub: @${github} invited and added to ${dept.toLowerCase()}-team with write access.

Access prepared:
- Google Workspace account
- Team chat channels
- Read-only staging access
- Shared password vault
- Project tracker access
- Welcome email

Setup is ready for final engineering sign-off.`
```

---

## Request Controller Loop Flow
```
               [Run Agent Thought]
                        │
                        ▼
            [Are API keys available?]
                 ├── No ───► [Execute Offline Fallback Generator]
                 └── Yes ──► [Filter & Deduplicate Keys]
                                  │
                                  ▼
                        [Key Loop (uniqueKeys)]
                                  │
                                  ▼
                       [Model Fallback Chain]
                                  │
                                  ▼
                         [Execute HTTP Post]
                       - 12s Abort timeout
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼ (Rate Limit 429)      ▼ (HTTP 404)            ▼ (HTTP 200)
    [Try Next Key]          [Try Next Model]      [Parse JSON Content]
                                                          │
                                                          ▼
                                                  [Calculate Cost]
                                                          │
                                                          ▼
                                                  [Return Result]
```
