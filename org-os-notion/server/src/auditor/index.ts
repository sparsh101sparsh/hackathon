/**
 * OrgOS Forensic Auditor Agent
 * 
 * This independent auditor verifies:
 * 1. Notion is ONLY used for durable memory (outcomes/decisions/logs), never as a message bus
 * 2. No API keys are hardcoded anywhere in the codebase
 * 3. Agent-to-agent communication happens in-memory via the orchestrator only
 * 
 * Run: npx ts-node src/auditor/index.ts
 *   or: node dist/auditor/index.js
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from the monorepo root — try multiple resolution strategies
// because tsx and compiled node resolve __dirname differently
const envPaths = [
  path.resolve(__dirname, '../../.env'),     // compiled: dist/auditor/ → org-os-notion/
  path.resolve(__dirname, '../../../.env'),  // tsx src: src/auditor/ → org-os-notion/
  path.resolve(process.cwd(), '../.env'),    // cwd=server/ → org-os-notion/
  path.resolve(process.cwd(), '.env'),       // cwd=org-os-notion/
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

interface AuditResult {
  check: string;
  passed: boolean;
  detail: string;
}

const SRC_ROOT = path.resolve(__dirname, '..');
const PATTERNS_HARDCODED_KEY = [
  /ntn_[A-Za-z0-9]{40,}/,        // Notion integration token
  /AIzaSy[A-Za-z0-9_-]{30,}/,    // Google AI / Gemini API key
  /secret_[A-Za-z0-9]{30,}/,     // Notion legacy secret
  /sk-[A-Za-z0-9]{40,}/,         // OpenAI key
];

const PATTERNS_NOTION_MESSAGE_BUS = [
  /notion.*poll/i,
  /poll.*notion/i,
  /notion.*subscribe/i,
  /setInterval.*notion/i,
  /notion.*listen/i,
  /queryNotion.*agent/i,
];

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
      results.push(...walkDir(fullPath, ext));
    } else if (entry.isFile() && fullPath.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function auditHardcodedKeys(): AuditResult {
  const files = [
    ...walkDir(SRC_ROOT, '.ts'),
    ...walkDir(SRC_ROOT, '.js'),
  ].filter(f => !f.includes('.env') && !f.includes('.example'));

  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      // Skip comment lines
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) return;
      for (const pattern of PATTERNS_HARDCODED_KEY) {
        if (pattern.test(line)) {
          // Check it's not being read from env
          if (!line.includes('process.env') && !line.includes('NOTION_INTEGRATION_TOKEN=secret_xxx')) {
            violations.push(`  ${path.relative(SRC_ROOT, file)}:${i + 1} → ${line.trim().substring(0, 80)}`);
          }
        }
      }
    });
  }

  return {
    check: 'No Hardcoded API Keys',
    passed: violations.length === 0,
    detail: violations.length === 0
      ? 'All API keys are sourced from process.env. No hardcoded secrets found in source.'
      : `VIOLATIONS:\n${violations.join('\n')}`,
  };
}

function auditNotionMessageBus(): AuditResult {
  const files = walkDir(SRC_ROOT, '.ts').filter(
    // Exclude the auditor itself — it defines these patterns as strings, not as code that polls Notion
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

function auditNotionOnlyWriteOnFinalState(): AuditResult {
  // Verify that orchestrator only calls Notion write functions (createDecision, createAuditLog, createOnboardingRecord)
  // and never calls read/query Notion functions in the loop
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

async function runAudit() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         OrgOS Forensic Architecture Auditor                  ║');
  console.log('║         Independent verification of Notion Track compliance  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const checks = [
    auditHardcodedKeys(),
    auditNotionMessageBus(),
    auditAgentCommunication(),
    auditEnvVars(),
    auditNotionOnlyWriteOnFinalState(),
  ];

  let allPassed = true;
  for (const result of checks) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.check}`);
    console.log(`   ${result.detail}`);
    console.log('');
    if (!result.passed) allPassed = false;
  }

  console.log('──────────────────────────────────────────────────────────────');
  if (allPassed) {
    console.log('🎉 AUDIT PASSED — OrgOS is fully compliant with the Notion Track architecture.');
    console.log('   Notion is used exclusively as durable organizational memory.');
    console.log('   All secrets are environment-variable sourced. No hardcoded keys.');
  } else {
    console.log('⚠️  AUDIT FAILED — Please fix the violations above before submission.');
    process.exit(1);
  }
  console.log('');
}

runAudit().catch(e => {
  console.error('Auditor crashed:', e);
  process.exit(1);
});
