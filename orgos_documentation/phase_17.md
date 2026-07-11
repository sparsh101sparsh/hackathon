# Phase 17: Product Decisions

An analysis of the key product and engineering decisions made during the creation of OrgOS, and whether they should be kept long-term.

## 1. In-Memory Orchestrator
- **Why it exists:** To strictly comply with the Notion Track hackathon rules, which mandated that Notion be used as a durable memory but NOT as a message bus. Storing state in-memory prevented the system from polling Notion.
- **Should it stay?** No. For a production system, in-memory state is extremely fragile. A server restart drops all active onboarding workflows. It should be replaced with a durable orchestration engine (like Temporal or AWS Step Functions).

## 2. Manual Approval Gates (Human-in-the-Loop)
- **Why it exists:** AI agents, particularly LLMs, are prone to hallucination. Automatically provisioning resources or spending company budgets without oversight is a major liability.
- **Should it stay?** Yes. Humans must always remain in the loop for actions that incur financial costs or alter security permissions (like GitHub access).

## 3. Gemini 2.5 Flash for Agents
- **Why it exists:** Blazing fast inference speeds. When users are staring at a live feed waiting for an AI to think, latency is the ultimate killer of UX.
- **Should it stay?** Yes. However, for highly complex tasks, it might be worth routing the prompt to a larger, more capable model (like Gemini 1.5 Pro) and sacrificing some latency for accuracy.

## 4. UI: The Live Agent Feed
- **Why it exists:** To provide transparency. Users don't trust black boxes. By showing the agent's thought process (e.g., "Drafting checklist...", "Auditing budget..."), the user builds trust with the system.
- **Should it stay?** Yes, it is the core differentiator of the product's user experience.
