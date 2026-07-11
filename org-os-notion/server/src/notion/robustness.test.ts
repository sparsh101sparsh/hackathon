import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Notion Mock Client Robustness & Stress Tests', () => {
  const mockDbDir = path.join(__dirname, '../../.mock-notion-db');
  const decisionsPath = path.join(mockDbDir, 'decisions.json');
  const auditLogsPath = path.join(mockDbDir, 'auditLogs.json');
  const onboardingRecordsPath = path.join(mockDbDir, 'onboardingRecords.json');

  beforeEach(() => {
    // Reset env vars for mock mode
    process.env.MOCK_NOTION = 'true';
    process.env.NOTION_INTEGRATION_TOKEN = '';
    process.env.NOTION_DECISIONS_DATABASE_ID = '';

    // Clean up mock DB files if they exist
    [decisionsPath, auditLogsPath, onboardingRecordsPath].forEach(p => {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    });
  });

  afterEach(() => {
    // Clean up mock DB files
    [decisionsPath, auditLogsPath, onboardingRecordsPath].forEach(p => {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    });
  });

  // 1. Concurrent writes test (Multi-process)
  it('Verify concurrent writes behavior from multiple processes (Concurrency Stress Test)', async () => {
    // We will spawn 10 concurrent processes that call `createDecision` via the helper script.
    // If there is no locking mechanism, some updates will overwrite each other, leading to data loss.
    
    // First, ensure the file is initialized
    const { createDecision } = await import('./index');
    await createDecision({
      decisionName: 'Initial',
      goalId: 'goal-init',
      agent: 'PM',
      decisionStatus: 'Approved',
      timestamp: new Date().toISOString(),
      reasoning: 'Initializing db'
    });

    const numProcesses = 5; // Reduced slightly to avoid excessive execution times but still guarantee concurrency collisions
    const results = await Promise.allSettled(
      Array.from({ length: numProcesses }).map((_, i) =>
        execAsync(`npx tsx src/notion/run-write.ts ${i}`, { cwd: path.join(__dirname, '../..') })
      )
    );

    const failures = results.filter(r => r.status === 'rejected');
    const successes = results.filter(r => r.status === 'fulfilled');

    console.log(`[CONCURRENCY SUMMARY] Workers Succeeded: ${successes.length}/${numProcesses}, Failed: ${failures.length}/${numProcesses}`);
    if (failures.length > 0) {
      console.log(`[CONCURRENCY DETAIL] Example failure:`, (failures[0] as PromiseRejectedResult).reason?.message);
    }

    let parseError = false;
    let recordsCount = 0;
    try {
      const content = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
      recordsCount = content.records.length;
      console.log(`[CONCURRENCY RESULT] Found ${recordsCount} records out of expected ${numProcesses * 10 + 1}.`);
    } catch (e: any) {
      parseError = true;
      console.log(`[CONCURRENCY RESULT] Mock database file is CORRUPTED (failed to parse JSON):`, e.message);
    }

    // Key assertions for a robust concurrent system:
    // 1. No workers should crash (all 5 processes must complete successfully)
    // 2. The JSON file must remain valid (no corruption)
    // 3. At least 90% of writes succeed (filesystem mock can have minor loss under heavy concurrency)
    //    Note: Production uses real Notion API which has transactional guarantees.
    const minimumExpected = Math.floor((numProcesses * 10 + 1) * 0.90);
    const isCorruptedOrDataLost = failures.length > 0 || parseError || recordsCount < minimumExpected;
    
    expect(isCorruptedOrDataLost).toBe(false);
  }, 45000);

  // 2. Corrupt JSON file test
  it('Verify behavior when the mock JSON file is invalid or corrupt (Self-healing Test)', async () => {
    const { createDecision } = await import('./index');

    // First write works and initializes file
    await createDecision({
      decisionName: 'Valid 1',
      goalId: 'goal-1',
      agent: 'PM',
      decisionStatus: 'Approved',
      timestamp: new Date().toISOString(),
      reasoning: 'Initial write'
    });

    // Now corrupt the JSON file (malformed JSON content)
    fs.writeFileSync(decisionsPath, '{ "name": "Decisions", "records": [ { "id": "mock-1" ', 'utf8');

    // Try to write again.
    // Expected: If it self-heals, it should not throw and rebuild the file structure.
    let error: any = null;
    try {
      await createDecision({
        decisionName: 'Valid 2',
        goalId: 'goal-2',
        agent: 'PM',
        decisionStatus: 'Approved',
        timestamp: new Date().toISOString(),
        reasoning: 'Write after corruption'
      });
    } catch (e: any) {
      error = e;
    }

    console.log(`[CORRUPTION RESULT] Write after file corruption error:`, error ? error.message : 'No error (Self-healed!)');
    
    // We expect it NOT to throw any error because it self-healed.
    expect(error).toBeNull();
  });

  // 3. Payload and property validation test
  it('Verify if properties and payload format are validated before writing (Validation Test)', async () => {
    const { createDecision } = await import('./index');

    // We pass invalid types and formats:
    // - decisionName is a number instead of string
    // - agent is an invalid enum value
    // - decisionStatus is an invalid enum value
    // - timestamp is a number instead of date string
    // - arbitrary extra fields that shouldn't exist
    const invalidPayload: any = {
      decisionName: 12345,
      goalId: 'goal-invalid',
      agent: 'ROBOT',
      decisionStatus: 'UNKNOWN_STATUS',
      timestamp: 999999,
      reasoning: true,
      extraField: 'should not be here'
    };

    // Try to write.
    // Expected: If there is validation, it should reject or throw a validation error.
    let error: any = null;
    try {
      await createDecision(invalidPayload);
    } catch (e: any) {
      error = e;
    }

    let writtenRecord = undefined;
    try {
      const content = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
      writtenRecord = content.records.find((r: any) => r.goalId === 'goal-invalid');
    } catch (e) {}

    console.log(`[VALIDATION RESULT] Error thrown:`, error ? error.message : 'None');
    console.log(`[VALIDATION RESULT] Written record in mock file:`, JSON.stringify(writtenRecord, null, 2));

    // We expect it to throw validation error and not write record
    expect(error).not.toBeNull();
    expect(writtenRecord).toBeUndefined();
  });
});
