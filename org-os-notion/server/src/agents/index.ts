import { OnboardingRecord } from '../types';

export interface Agent {
  name: 'PM' | 'Finance' | 'Engineering';
  role: string;
  systemPrompt: string;
}

export const PMAgent: Agent = {
  name: 'PM',
  role: 'Product Manager Agent',
  systemPrompt: 'You are the Product Manager Agent in OrgOS. You gather onboarding details, compile employee profiles, and specify roles and responsibilities.'
};

export const FinanceAgent: Agent = {
  name: 'Finance',
  role: 'Finance Agent',
  systemPrompt: 'You are the Finance Agent in OrgOS. You audit compensation, budgets, equipment procurement costs, and request human-in-the-loop sign-off.'
};

export const EngineeringAgent: Agent = {
  name: 'Engineering',
  role: 'Engineering Agent',
  systemPrompt: 'You are the Engineering Agent in OrgOS. You handle technical setup like GitHub account provisioning, system access, and credentials generation.'
};

export async function runAgentThought(agent: Agent, prompt: string, apiKeys?: string[]): Promise<{ text: string; cost: number }> {
  console.log(`[${agent.role}] Processing prompt: "${prompt}"`);
  
  const keysToTry = apiKeys
    ? apiKeys.filter(Boolean)
    : [process.env.GEMINI_API_KEY].filter(Boolean) as string[];
  
  const uniqueKeys = Array.from(new Set(keysToTry));

  if (uniqueKeys.length > 0) {
    const models = [
      'gemini-3.5-flash',
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ];

    for (const apiKey of uniqueKeys) {
      let keyFailed = false;
      for (const model of models) {
        if (keyFailed) break;
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `System instructions: ${agent.systemPrompt}\n\nTask: ${prompt}`
                }]
              }]
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (response.status === 429) {
            console.warn(`[${agent.role}] Rate limited on ${model} with key ending in ...${apiKey.slice(-5)}, trying next key…`);
            keyFailed = true;
            break;
          }
          if (response.status === 404) {
            console.warn(`[${agent.role}] Model ${model} not available, trying next model…`);
            continue;
          }
          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`[${agent.role}] API error on key ending in ...${apiKey.slice(-5)}: ${response.status} - ${errorText.substring(0, 200)}`);
            keyFailed = true;
            break;
          }

          const json: any = await response.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!text) continue;

          console.log(`[${agent.role}] ✅ Gemini response via ${model} (key ...${apiKey.slice(-5)})`);
          const inputTokens = Math.ceil((agent.systemPrompt + prompt).length / 4);
          const outputTokens = Math.ceil(text.length / 4);
          const cost = (inputTokens * 0.075 / 1_000_000) + (outputTokens * 0.30 / 1_000_000);
          return { text, cost };
        } catch (error: any) {
          console.warn(`[${agent.role}] ${model} with key ...${apiKey.slice(-5)} failed:`, error.message);
          keyFailed = true;
          break;
        }
      }
    }
    console.warn(`[${agent.role}] All Gemini keys and models exhausted — using built-in fallback`);
  } else {
    console.warn(`[${agent.role}] No GEMINI_API_KEYs available — using built-in fallback`);
  }

  // ── Realistic fallback responses (used when Gemini is unavailable) ──
  // These simulate what a real agent would produce so the demo flow
  // is fully observable even without API access.
  const employeeMatch = prompt.match(/for ([A-Za-z ]+) \((.+?) in (.+?)\)/);
  const name = employeeMatch?.[1] ?? 'the employee';
  const role = employeeMatch?.[2] ?? 'their role';
  const dept = employeeMatch?.[3] ?? 'the department';
  const deptTeam = dept === 'the department' ? 'the team' : `the ${dept} team`;
  const salaryMatch = prompt.match(/\$([0-9,]+)/);
  const salary = salaryMatch?.[1] ?? '0';
  const githubMatch = prompt.match(/GitHub: ([a-z0-9-]+)/);
  const github = githubMatch?.[1] ?? 'employee';

  switch (agent.name) {
    case 'PM':
      return {
        text: `Onboarding plan for ${name}\n\n` +
          `Role: ${role}\n` +
          `Department: ${dept}\n\n` +
          `Week 1 checklist:\n` +
          `- Complete company orientation\n` +
          `- Meet the team lead\n` +
          `- Review the current sprint\n` +
          `- Set up the local dev environment\n` +
          `- Finish security training\n\n` +
          `30-day target: ${name} should be able to work independently with ${deptTeam}.\n` +
          `Success marker: first pull request merged within 2 weeks.`,
        cost: 0.0
      };

    case 'Finance':
      return {
        text: `Finance review for ${name}\n\n` +
          `Salary: $${salary}/year is within the usual range for ${role} in ${dept}.\n` +
          `Equipment: standard laptop and peripherals fit within the $3,500 limit.\n` +
          `Estimated first-year cost: salary, benefits, and equipment are within the approved headcount budget.\n\n` +
          `Recommendation: approve.\n` +
          `A human approval is still required before engineering starts setup.`,
        cost: 0.0
      };

    case 'Engineering':
      return {
        text: `Engineering setup for ${name}\n\n` +
          `GitHub: @${github} invited and added to ${dept.toLowerCase()}-team with write access.\n\n` +
          `Access prepared:\n` +
          `- Google Workspace account\n` +
          `- Team chat channels\n` +
          `- Read-only staging access\n` +
          `- Shared password vault\n` +
          `- Project tracker access\n` +
          `- Welcome email\n\n` +
          `Setup is ready for final engineering sign-off.`,
        cost: 0.0
      };

    default:
      return { text: `Processed.`, cost: 0.0 };
  }
}
