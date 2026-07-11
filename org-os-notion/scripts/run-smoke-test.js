// Use global fetch (built-in in Node.js 18+)

async function run() {
  const payload = {
    employeeName: "Test Employee",
    role: "Engineer",
    department: "Engineering",
    salary: 90000,
    githubUsername: "testuser",
    equipment: "MacBook Pro"
  };

  console.log("Starting onboarding via POST /api/onboarding/start...");
  const startRes = await fetch("http://localhost:3001/api/onboarding/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!startRes.ok) {
    throw new Error(`Failed to start onboarding: ${startRes.status} ${await startRes.text()}`);
  }

  const startData = await startRes.json();
  const sessionId = startData.sessionId;
  console.log(`Successfully started! Session ID: ${sessionId}`);

  // Polling helper
  let approved = false;
  let finished = false;
  let attempts = 0;

  while (!finished && attempts < 120) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`Polling sessions (attempt ${attempts})...`);
    const sessionsRes = await fetch("http://localhost:3001/api/onboarding/sessions");
    if (!sessionsRes.ok) {
      console.error(`Failed to fetch sessions: ${sessionsRes.status}`);
      continue;
    }

    const sessions = await sessionsRes.json();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      console.log("Session not found in list.");
      continue;
    }

    console.log(`Session state: ${session.state}`);

    if (session.state === 'PENDING_FINANCE_APPROVAL' && !approved) {
      approved = true;
      console.log("Submitting approval for the Finance step...");
      const approveRes = await fetch("http://localhost:3001/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          approvalId: "fin-app-smoke",
          action: "approve",
          reason: "Compensation looks good."
        })
      });

      if (!approveRes.ok) {
        console.error(`Approval failed: ${approveRes.status} ${await approveRes.text()}`);
        approved = false; // retry next time
      } else {
        console.log("Approval submitted successfully.");
      }
    }

    if (session.state === 'PENDING_ENG_APPROVAL' || session.state === 'COMPLETED' || session.state === 'FAILED') {
      console.log(`Terminal state reached or Engineering completed. State: ${session.state}`);
      finished = true;

      console.log("\n--- Audit Logs ---");
      session.logs.forEach(log => {
        console.log(`[${log.agent}] ${log.actionExecuted}: ${log.thoughtProcess}`);
      });

      console.log("\n--- Verification ---");
      const requiredLogs = [
        "Engineering Agent initialized.",
        "Checking GitHub username...",
        "✓ Username exists.",
        "Preparing organization invitation...",
        "✓ Invitation sent.",
        "Creating onboarding issue...",
        "✓ Issue #", // matches both "✓ Issue #[number] created." and "✓ Issue #"
        "Updating Notion...",
        "✓ Organizational memory updated."
      ];

      let allPassed = true;
      const verifiedLogs = [];
      for (const req of requiredLogs) {
        // Find if any log's actionExecuted contains the exact string
        const match = session.logs.find(log => log.actionExecuted.includes(req));
        if (match) {
          console.log(`✓ Found: "${req}" (in log action: "${match.actionExecuted}")`);
          verifiedLogs.push({ required: req, found: match.actionExecuted, thought: match.thoughtProcess });
        } else {
          console.log(`✗ Missing: "${req}"`);
          allPassed = false;
        }
      }

      if (allPassed) {
        console.log("\nSUCCESS: All required logs verified!");
      } else {
        console.error("\nFAILURE: Some logs were not found.");
      }

      // Write results to a verification file
      const fs = require('node:fs');
      const path = require('node:path');
      const resultsPath = path.resolve(__dirname, '../.agents/worker_smoke_test/smoke_test_results.json');
      fs.writeFileSync(resultsPath, JSON.stringify({
        success: allPassed,
        sessionId,
        state: session.state,
        verifiedLogs,
        fullLogs: session.logs
      }, null, 2));
      console.log(`\nSmoke test results saved to ${resultsPath}`);
    }
  }

  if (!finished) {
    console.error("Timeout waiting for E2E flow to complete.");
  }
}

run().catch(console.error);
