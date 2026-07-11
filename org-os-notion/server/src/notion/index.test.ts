import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Set up mock for @notionhq/client
const mockCreatePage = vi.fn().mockResolvedValue({ id: 'real-notion-page-id-123' });

vi.mock('@notionhq/client', () => {
  class MockClient {
    auth: string;
    pages: {
      create: any;
    };
    constructor(options: any) {
      this.auth = options?.auth || '';
      this.pages = {
        create: mockCreatePage
      };
    }
  }
  return {
    Client: MockClient
  };
});

describe('Notion Client & Mock DB Integration', () => {
  const mockDbDir = path.join(__dirname, '../../.mock-notion-db');

  beforeEach(() => {
    vi.resetModules();
    mockCreatePage.mockClear();
    
    // Clean up mock DB files if they exist
    const files = ['decisions.json', 'auditLogs.json', 'onboardingRecords.json'];
    files.forEach(f => {
      const p = path.join(mockDbDir, f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    });
  });

  afterEach(() => {
    // Clean up
    const files = ['decisions.json', 'auditLogs.json', 'onboardingRecords.json'];
    files.forEach(f => {
      const p = path.join(mockDbDir, f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    });
  });

  describe('Mock Fallback Mode', () => {
    it('should write to decisions.json and return mock ID in mock mode', async () => {
      process.env.MOCK_NOTION = 'true';
      process.env.NOTION_INTEGRATION_TOKEN = '';
      process.env.NOTION_DECISIONS_DATABASE_ID = '';

      const { createDecision, getMockData } = await import('./index');

      const decisionData = {
        decisionName: 'Test Decision',
        goalId: 'goal-1',
        agent: 'PM' as const,
        decisionStatus: 'Approved' as const,
        timestamp: new Date().toISOString(),
        reasoning: 'Because it is a test'
      };

      const result = await createDecision(decisionData);
      expect(result.id).toBeDefined();
      expect(result.id).toContain('mock-dec-');
      expect(result.decisionName).toBe('Test Decision');

      // Verify file content
      const filePath = path.join(mockDbDir, 'decisions.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(content.records).toHaveLength(1);
      expect(content.records[0].decisionName).toBe('Test Decision');

      // Verify getMockData
      const allMockData = getMockData();
      expect(allMockData.decisions).toHaveLength(1);
      expect(allMockData.decisions[0].decisionName).toBe('Test Decision');
    });

    it('should write to auditLogs.json and generate logId and id in mock mode', async () => {
      process.env.MOCK_NOTION = 'true';
      const { createAuditLog } = await import('./index');

      const logData = {
        stepName: 'PM_PLANNING',
        agent: 'PM' as const,
        actionExecuted: 'Draft Specs',
        thoughtProcess: 'Starting onboarding sequence',
        cost: 0.005,
        timestamp: new Date().toISOString()
      };

      const result = await createAuditLog(logData);
      expect(result.id).toBeDefined();
      expect(result.logId).toBeDefined();
      expect(result.id).toContain('mock-log-');

      const filePath = path.join(mockDbDir, 'auditLogs.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(content.records).toHaveLength(1);
      expect(content.records[0].stepName).toBe('PM_PLANNING');
    });

    it('should write to onboardingRecords.json in mock mode', async () => {
      process.env.MOCK_NOTION = 'true';
      const { createOnboardingRecord } = await import('./index');

      const onboardingData = {
        employeeName: 'Alice Smith',
        role: 'Software Engineer',
        department: 'Engineering' as const,
        salary: 120000,
        equipmentList: 'MacBook Pro, Monitor',
        githubUsername: 'alicesmith',
        onboardingStatus: 'In Progress' as const
      };

      const result = await createOnboardingRecord(onboardingData);
      expect(result.id).toBeDefined();
      expect(result.id).toContain('mock-onb-');

      const filePath = path.join(mockDbDir, 'onboardingRecords.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(content.records).toHaveLength(1);
      expect(content.records[0].employeeName).toBe('Alice Smith');
    });
  });

  describe('Real Notion Mode (Mocked HTTP)', () => {
    it('should format properties correctly and write to real Notion database for Decisions', async () => {
      process.env.MOCK_NOTION = 'false';
      process.env.NOTION_INTEGRATION_TOKEN = 'secret_test_token';
      process.env.NOTION_DECISIONS_DATABASE_ID = 'db_decisions_id';

      const { createDecision } = await import('./index');

      const decisionData = {
        decisionName: 'Hire Engineering Candidate',
        goalId: 'goal-eng-1',
        agent: 'Finance' as const,
        decisionStatus: 'Approved' as const,
        timestamp: '2026-07-11T00:00:00.000Z',
        reasoning: 'Budget is sufficient and role approved.'
      };

      const result = await createDecision(decisionData);
      expect(result.id).toBe('real-notion-page-id-123');

      expect(mockCreatePage).toHaveBeenCalledWith({
        parent: { database_id: 'db_decisions_id' },
        properties: {
          "Decision Name": {
            title: [{ text: { content: 'Hire Engineering Candidate' } }]
          },
          "Goal ID": {
            rich_text: [{ text: { content: 'goal-eng-1' } }]
          },
          "Agent": {
            select: { name: 'Finance' }
          },
          "Decision Status": {
            select: { name: 'Approved' }
          },
          "Timestamp": {
            date: { start: '2026-07-11T00:00:00.000Z' }
          },
          "Reasoning": {
            rich_text: [{ text: { content: 'Budget is sufficient and role approved.' } }]
          }
        }
      });
    });

    it('should format properties correctly and write to real Notion database for Audit Logs', async () => {
      process.env.MOCK_NOTION = 'false';
      process.env.NOTION_INTEGRATION_TOKEN = 'secret_test_token';
      process.env.NOTION_AUDIT_LOGS_DATABASE_ID = 'db_audit_logs_id';

      const { createAuditLog } = await import('./index');

      const logData = {
        stepName: 'FINANCE_AUDIT',
        agent: 'System' as const,
        actionExecuted: 'Auto-Audit',
        thoughtProcess: 'Checking constraints...',
        cost: 0.002,
        timestamp: '2026-07-11T01:00:00.000Z'
      };

      const result = await createAuditLog(logData);
      expect(result.id).toBe('real-notion-page-id-123');
      expect(result.logId).toBeDefined();

      expect(mockCreatePage).toHaveBeenCalledWith({
        parent: { database_id: 'db_audit_logs_id' },
        properties: {
          "Log ID": {
            title: [{ text: { content: result.logId } }]
          },
          "Step Name": {
            rich_text: [{ text: { content: 'FINANCE_AUDIT' } }]
          },
          "Agent": {
            select: { name: 'System' }
          },
          "Action Executed": {
            rich_text: [{ text: { content: 'Auto-Audit' } }]
          },
          "Thought Process": {
            rich_text: [{ text: { content: 'Checking constraints...' } }]
          },
          "Cost": {
            number: 0.002
          },
          "Timestamp": {
            date: { start: '2026-07-11T01:00:00.000Z' }
          }
        }
      });
    });

    it('should format properties correctly and include children blocks for Onboarding Records', async () => {
      process.env.MOCK_NOTION = 'false';
      process.env.NOTION_INTEGRATION_TOKEN = 'secret_test_token';
      process.env.NOTION_ONBOARDING_DATABASE_ID = 'db_onboarding_id';

      const { createOnboardingRecord } = await import('./index');

      const onboardingData = {
        employeeName: 'Jane Doe',
        role: 'PM',
        department: 'Product' as const,
        salary: 130000,
        equipmentList: 'Laptop, Headset',
        githubUsername: 'janedoe_pm',
        onboardingStatus: 'Complete' as const
      };

      const result = await createOnboardingRecord(onboardingData);
      expect(result.id).toBe('real-notion-page-id-123');

      expect(mockCreatePage).toHaveBeenCalledWith({
        parent: { database_id: 'db_onboarding_id' },
        properties: {
          "Employee Name": {
            title: [{ text: { content: 'Jane Doe' } }]
          },
          "Role": {
            rich_text: [{ text: { content: 'PM' } }]
          },
          "Department": {
            select: { name: 'Product' }
          },
          "Salary": {
            number: 130000
          },
          "Equipment List": {
            rich_text: [{ text: { content: 'Laptop, Headset' } }]
          },
          "GitHub Username": {
            rich_text: [{ text: { content: 'janedoe_pm' } }]
          },
          "Onboarding Status": {
            select: { name: 'Complete' }
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
                    content: 'Role: PM\nDepartment: Product\nSalary: $130000\nEquipment: Laptop, Headset\nGitHub: janedoe_pm'
                  }
                }
              ]
            }
          }
        ]
      });
    });
  });

  describe('Robust Fallback handling', () => {
    it('should fallback to mock DB if NOTION_INTEGRATION_TOKEN is missing even if MOCK_NOTION is false', async () => {
      process.env.MOCK_NOTION = 'false';
      process.env.NOTION_INTEGRATION_TOKEN = ''; // missing
      process.env.NOTION_DECISIONS_DATABASE_ID = 'db_decisions_id';

      const { createDecision } = await import('./index');

      const decisionData = {
        decisionName: 'Test Fallback Decision',
        goalId: 'goal-fallback',
        agent: 'Engineering' as const,
        decisionStatus: 'Pending' as const,
        timestamp: new Date().toISOString(),
        reasoning: 'Fallback verification'
      };

      const result = await createDecision(decisionData);
      expect(result.id).toBeDefined();
      expect(result.id).toContain('mock-dec-');
      expect(mockCreatePage).not.toHaveBeenCalled();
    });

    it('should fallback to mock DB if database ID is missing even if MOCK_NOTION is false', async () => {
      process.env.MOCK_NOTION = 'false';
      process.env.NOTION_INTEGRATION_TOKEN = 'secret_token';
      process.env.NOTION_DECISIONS_DATABASE_ID = ''; // missing

      const { createDecision } = await import('./index');

      const decisionData = {
        decisionName: 'Test Fallback Decision 2',
        goalId: 'goal-fallback-2',
        agent: 'Engineering' as const,
        decisionStatus: 'Pending' as const,
        timestamp: new Date().toISOString(),
        reasoning: 'Fallback verification 2'
      };

      const result = await createDecision(decisionData);
      expect(result.id).toBeDefined();
      expect(result.id).toContain('mock-dec-');
      expect(mockCreatePage).not.toHaveBeenCalled();
    });
  });
});
