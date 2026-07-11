import { Client } from '@notionhq/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { Decision, AuditLog, OnboardingRecord } from '../types';

if (!process.env.VITEST) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

const isMock = process.env.MOCK_NOTION !== 'false';
const token = process.env.NOTION_API_KEY || process.env.NOTION_INTEGRATION_TOKEN || '';
const parentPageId = process.env.NOTION_PARENT_PAGE_ID || process.env.NOTION_ROOT_PAGE_ID || '';

// Mock directory path
const mockDbDir = path.join(__dirname, '../../.mock-notion-db');

// Ensure mock files exist helper
function ensureMockFile(filename: string, defaultStructure: any) {
  if (!fs.existsSync(mockDbDir)) {
    fs.mkdirSync(mockDbDir, { recursive: true });
  }
  const filePath = path.join(mockDbDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultStructure, null, 2), 'utf8');
  }
}

// Initialise Mock DB if we are in mock mode
if (isMock) {
  ensureMockFile('decisions.json', { name: 'Decisions', records: [] });
  ensureMockFile('auditLogs.json', { name: 'Audit Logs', records: [] });
  ensureMockFile('onboardingRecords.json', { name: 'Onboarding Records', records: [] });
}

// Instantiate real Notion client if not in mock mode
const notionClient = !isMock && token ? new Client({ auth: token }) : null;

type NotionPage = {
  id: string;
  properties: Record<string, any>;
};

// Validation helpers
export function validateDecision(data: any): data is Decision {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid Decision: must be an object');
  const allowedKeys = new Set(['id', 'decisionName', 'goalId', 'agent', 'decisionStatus', 'timestamp', 'reasoning']);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) throw new Error(`Invalid property in Decision: ${key}`);
  }
  if (typeof data.decisionName !== 'string') throw new Error('decisionName must be a string');
  if (typeof data.goalId !== 'string') throw new Error('goalId must be a string');
  if (data.agent !== 'PM' && data.agent !== 'Finance' && data.agent !== 'Engineering') throw new Error('Invalid agent in Decision');
  if (data.decisionStatus !== 'Approved' && data.decisionStatus !== 'Rejected' && data.decisionStatus !== 'Pending') throw new Error('Invalid decisionStatus');
  if (typeof data.timestamp !== 'string') throw new Error('timestamp must be a string');
  if (typeof data.reasoning !== 'string') throw new Error('reasoning must be a string');
  return true;
}

export function validateAuditLog(data: any): data is AuditLog {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid AuditLog: must be an object');
  const allowedKeys = new Set(['id', 'logId', 'stepName', 'agent', 'actionExecuted', 'thoughtProcess', 'cost', 'timestamp']);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) throw new Error(`Invalid property in AuditLog: ${key}`);
  }
  if (typeof data.stepName !== 'string') throw new Error('stepName must be a string');
  if (data.agent !== 'System' && data.agent !== 'PM' && data.agent !== 'Finance' && data.agent !== 'Engineering') throw new Error('Invalid agent in AuditLog');
  if (typeof data.actionExecuted !== 'string') throw new Error('actionExecuted must be a string');
  if (typeof data.thoughtProcess !== 'string') throw new Error('thoughtProcess must be a string');
  if (typeof data.cost !== 'number') throw new Error('cost must be a number');
  if (typeof data.timestamp !== 'string') throw new Error('timestamp must be a string');
  return true;
}

export function validateOnboardingRecord(data: any): data is OnboardingRecord {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid OnboardingRecord: must be an object');
  const allowedKeys = new Set(['id', 'employeeName', 'role', 'department', 'salary', 'equipmentList', 'githubUsername', 'onboardingStatus']);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) throw new Error(`Invalid property in OnboardingRecord: ${key}`);
  }
  if (typeof data.employeeName !== 'string') throw new Error('employeeName must be a string');
  if (typeof data.role !== 'string') throw new Error('role must be a string');
  if (data.department !== 'Product' && data.department !== 'Finance' && data.department !== 'Engineering' && data.department !== 'Sales') throw new Error('Invalid department');
  if (typeof data.salary !== 'number') throw new Error('salary must be a number');
  if (typeof data.equipmentList !== 'string') throw new Error('equipmentList must be a string');
  if (typeof data.githubUsername !== 'string') throw new Error('githubUsername must be a string');
  if (data.onboardingStatus !== 'In Progress' && data.onboardingStatus !== 'Complete' && data.onboardingStatus !== 'Failed') throw new Error('Invalid onboardingStatus');
  return true;
}

// Atomic lock & self-healing mock database writer helper
async function writeMockRecord<T>(
  filename: string,
  defaultStructure: { name: string; records: any[] },
  record: T,
  validate: (data: any) => data is T,
  idPrefix: string
): Promise<T> {
  // Validate first
  validate(record);

  const filePath = path.join(mockDbDir, filename);
  const lockfilePath = filePath + '.lock';

  let acquired = false;
  const startTime = Date.now();

  // Spin lock with retry and slight backoff
  while (Date.now() - startTime < 10000) {
    try {
      const fd = fs.openSync(lockfilePath, 'wx');
      fs.closeSync(fd);
      acquired = true;
      break;
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 20));
      } else {
        throw e;
      }
    }
  }

  if (!acquired) {
    throw new Error(`Timeout acquiring process lock for database file: ${filename}`);
  }

  try {
    let content: any = null;
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8').trim();
        if (fileContent) {
          content = JSON.parse(fileContent);
        }
      }
    } catch (err) {
      console.warn(`[Mock Notion] JSON corruption detected in ${filename}, self-healing...`);
    }

    if (!content || typeof content !== 'object' || !Array.isArray(content.records)) {
      content = { name: defaultStructure.name, records: [] };
    }

    const newRecord = {
      ...(record as any),
      id: (record as any).id || `${idPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    content.records.push(newRecord);

    // Atomically write by renaming a temporary file
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(content, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);

    return newRecord as T;
  } finally {
    if (acquired) {
      try {
        fs.unlinkSync(lockfilePath);
      } catch (e) {}
    }
  }
}

function getMockRecords(filename: string, defaultStructure: any): any[] {
  const filePath = path.join(mockDbDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.records)) {
          return parsed.records;
        }
      }
    }
  } catch (err) {
    console.warn(`[Mock Notion] JSON parse error in ${filename} during read, self-healing...`);
  }
  return [];
}

function titleText(property: any): string {
  return property?.title?.map((item: any) => item?.plain_text || '').join('').trim() || '';
}

function richText(property: any): string {
  return property?.rich_text?.map((item: any) => item?.plain_text || '').join('').trim() || '';
}

function selectName(property: any): string {
  return property?.select?.name || '';
}

function dateStart(property: any): string {
  return property?.date?.start || new Date().toISOString();
}

function numberValue(property: any): number {
  return typeof property?.number === 'number' ? property.number : 0;
}

function decisionAgent(value: string): Decision['agent'] {
  return value === 'Finance' || value === 'Engineering' ? value : 'PM';
}

function auditAgent(value: string): AuditLog['agent'] {
  return value === 'PM' || value === 'Finance' || value === 'Engineering' ? value : 'System';
}

function decisionStatus(value: string): Decision['decisionStatus'] {
  return value === 'Approved' || value === 'Rejected' ? value : 'Pending';
}

function department(value: string): OnboardingRecord['department'] {
  if (value === 'Product' || value === 'Finance' || value === 'Engineering' || value === 'Sales') {
    return value;
  }
  return 'Engineering';
}

function onboardingStatus(value: string): OnboardingRecord['onboardingStatus'] {
  return value === 'Complete' || value === 'Failed' ? value : 'In Progress';
}

async function queryDatabase<T>(
  databaseId: string,
  mapPage: (page: NotionPage) => T
): Promise<T[]> {
  if (!notionClient || !databaseId) {
    return [];
  }

  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionClient.databases.query({
      database_id: databaseId,
      start_cursor: cursor
    });

    results.push(...(response.results as NotionPage[]).map(mapPage));
    cursor = response.has_more ? response.next_cursor || undefined : undefined;
  } while (cursor);

  return results;
}

function sortByTimestamp<T extends { timestamp?: string }>(records: T[]): T[] {
  return records.sort((a, b) => {
    const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return right - left;
  });
}

export async function createDecision(data: Decision): Promise<Decision> {
  const dbId = process.env.NOTION_DECISIONS_DATABASE_ID || '';
  if (isMock || !notionClient || !dbId) {
    return writeMockRecord<Decision>(
      'decisions.json',
      { name: 'Decisions', records: [] },
      data,
      validateDecision,
      'mock-dec'
    );
  }

  // Real Notion API write
  try {
    const response = await notionClient.pages.create({
      parent: { database_id: dbId },
      properties: {
        "Decision Name": {
          title: [{ text: { content: data.decisionName } }]
        },
        "Goal ID": {
          rich_text: [{ text: { content: data.goalId } }]
        },
        "Agent": {
          select: { name: data.agent }
        },
        "Decision Status": {
          select: { name: data.decisionStatus }
        },
        "Timestamp": {
          date: { start: data.timestamp }
        },
        "Reasoning": {
          rich_text: [{ text: { content: data.reasoning } }]
        }
      }
    });

    return {
      ...data,
      id: response.id
    };
  } catch (error) {
    console.error(`[Notion API Error] Failed to create Decision:`, error);
    throw error;
  }
}

export async function createAuditLog(data: AuditLog): Promise<AuditLog> {
  const dbId = process.env.NOTION_AUDIT_LOGS_DATABASE_ID || '';
  const logId = data.logId || data.id || randomUUID();

  if (isMock || !notionClient || !dbId) {
    return writeMockRecord<AuditLog>(
      'auditLogs.json',
      { name: 'Audit Logs', records: [] },
      { ...data, logId },
      validateAuditLog,
      'mock-log'
    );
  }

  try {
    const response = await notionClient.pages.create({
      parent: { database_id: dbId },
      properties: {
        "Log ID": {
          title: [{ text: { content: logId } }]
        },
        "Step Name": {
          rich_text: [{ text: { content: data.stepName } }]
        },
        "Agent": {
          select: { name: data.agent }
        },
        "Action Executed": {
          rich_text: [{ text: { content: data.actionExecuted } }]
        },
        "Thought Process": {
          rich_text: [{ text: { content: data.thoughtProcess } }]
        },
        "Cost": {
          number: data.cost
        },
        "Timestamp": {
          date: { start: data.timestamp }
        }
      }
    });

    return {
      ...data,
      id: response.id,
      logId
    };
  } catch (error) {
    console.error(`[Notion API Error] Failed to create Audit Log:`, error);
    throw error;
  }
}

export async function createOnboardingRecord(data: OnboardingRecord): Promise<OnboardingRecord> {
  const dbId = process.env.NOTION_ONBOARDING_DATABASE_ID || '';
  if (isMock || !notionClient || !dbId) {
    return writeMockRecord<OnboardingRecord>(
      'onboardingRecords.json',
      { name: 'Onboarding Records', records: [] },
      data,
      validateOnboardingRecord,
      'mock-onb'
    );
  }

  try {
    const response = await notionClient.pages.create({
      parent: { database_id: dbId },
      properties: {
        "Employee Name": {
          title: [{ text: { content: data.employeeName } }]
        },
        "Role": {
          rich_text: [{ text: { content: data.role } }]
        },
        "Department": {
          select: { name: data.department }
        },
        "Salary": {
          number: data.salary
        },
        "Equipment List": {
          rich_text: [{ text: { content: data.equipmentList } }]
        },
        "GitHub Username": {
          rich_text: [{ text: { content: data.githubUsername } }]
        },
        "Onboarding Status": {
          select: { name: data.onboardingStatus }
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Final Specs & Comments' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: {
                  content: `Role: ${data.role}\nDepartment: ${data.department}\nSalary: $${data.salary}\nEquipment: ${data.equipmentList}\nGitHub: ${data.githubUsername}`
                }
              }
            ]
          }
        }
      ]
    });

    return {
      ...data,
      id: response.id
    };
  } catch (error) {
    console.error(`[Notion API Error] Failed to create Onboarding Record:`, error);
    throw error;
  }
}

// Fetch all mock/real data to display in the frontend Notion Explorer
export function getMockData() {
  try {
    ensureMockFile('decisions.json', { name: 'Decisions', records: [] });
    ensureMockFile('auditLogs.json', { name: 'Audit Logs', records: [] });
    ensureMockFile('onboardingRecords.json', { name: 'Onboarding Records', records: [] });

    const decisions = getMockRecords('decisions.json', { name: 'Decisions', records: [] });
    const auditLogs = getMockRecords('auditLogs.json', { name: 'Audit Logs', records: [] });
    const onboardingRecords = getMockRecords('onboardingRecords.json', { name: 'Onboarding Records', records: [] });
    return { decisions, auditLogs, onboardingRecords };
  } catch (err) {
    console.error("Error reading mock database:", err);
    return { decisions: [], auditLogs: [], onboardingRecords: [] };
  }
}

export async function getNotionData() {
  const decisionsDbId = process.env.NOTION_DECISIONS_DATABASE_ID || '';
  const auditLogsDbId = process.env.NOTION_AUDIT_LOGS_DATABASE_ID || '';
  const onboardingDbId = process.env.NOTION_ONBOARDING_DATABASE_ID || '';

  if (isMock || !notionClient || !decisionsDbId || !auditLogsDbId || !onboardingDbId) {
    return getMockData();
  }

  try {
    const [decisions, auditLogs, onboardingRecords] = await Promise.all([
      queryDatabase<Decision>(decisionsDbId, (page) => {
        const properties = page.properties;
        return {
          id: page.id,
          decisionName: titleText(properties['Decision Name']),
          goalId: richText(properties['Goal ID']),
          agent: decisionAgent(selectName(properties['Agent'])),
          decisionStatus: decisionStatus(selectName(properties['Decision Status'])),
          timestamp: dateStart(properties['Timestamp']),
          reasoning: richText(properties['Reasoning'])
        };
      }),
      queryDatabase<AuditLog>(auditLogsDbId, (page) => {
        const properties = page.properties;
        const logId = titleText(properties['Log ID']);
        return {
          id: page.id,
          logId,
          stepName: richText(properties['Step Name']) || logId,
          agent: auditAgent(selectName(properties['Agent'])),
          actionExecuted: richText(properties['Action Executed']),
          thoughtProcess: richText(properties['Thought Process']),
          cost: numberValue(properties['Cost']),
          timestamp: dateStart(properties['Timestamp'])
        };
      }),
      queryDatabase<OnboardingRecord>(onboardingDbId, (page) => {
        const properties = page.properties;
        return {
          id: page.id,
          employeeName: titleText(properties['Employee Name']),
          role: richText(properties['Role']),
          department: department(selectName(properties['Department'])),
          salary: numberValue(properties['Salary']),
          equipmentList: richText(properties['Equipment List']),
          githubUsername: richText(properties['GitHub Username']),
          onboardingStatus: onboardingStatus(selectName(properties['Onboarding Status']))
        };
      })
    ]);

    return {
      decisions: sortByTimestamp(decisions),
      auditLogs: sortByTimestamp(auditLogs),
      onboardingRecords
    };
  } catch (error) {
    console.error('[Notion API Error] Failed to read Notion data; falling back to mock data:', error);
    return getMockData();
  }
}

export const notionService = {
  createDecision,
  createAuditLog,
  createOnboardingRecord,
  getNotionData
};

