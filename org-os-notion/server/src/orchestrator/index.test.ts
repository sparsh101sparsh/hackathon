import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startOnboarding, approveStep, getSession, getAllSessions } from './index';
import { runAgentThought, PMAgent, FinanceAgent, EngineeringAgent } from '../agents';
import { createDecision, createAuditLog, createOnboardingRecord } from '../notion';

// Mock the Notion database functions to avoid actual filesystem writes or API calls
vi.mock('../notion', () => {
  const mockCreateDecision = vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: `mock-dec-${Date.now()}` }));
  const mockCreateAuditLog = vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: `mock-log-${Date.now()}` }));
  const mockCreateOnboardingRecord = vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: `mock-onb-${Date.now()}` }));

  return {
    createDecision: mockCreateDecision,
    createAuditLog: mockCreateAuditLog,
    createOnboardingRecord: mockCreateOnboardingRecord,
    getMockData: vi.fn().mockReturnValue({ decisions: [], auditLogs: [], onboardingRecords: [] }),
    notionService: {
      createDecision: mockCreateDecision,
      createAuditLog: mockCreateAuditLog,
      createOnboardingRecord: mockCreateOnboardingRecord,
      getNotionData: vi.fn().mockResolvedValue({ decisions: [], auditLogs: [], onboardingRecords: [] })
    }
  };
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Orchestrator State Machine & Deep Agents', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network connection error')));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  describe('Full Successful Onboarding State Machine & Approval Gates', () => {
    it('should transition through INGESTED -> PM_PLANNING -> FINANCE_AUDIT -> PENDING_FINANCE_APPROVAL -> ENGINEERING_SETUP -> PENDING_ENG_APPROVAL -> COMPLETED', async () => {
      const employeeData = {
        employeeName: 'John Doe',
        role: 'Senior Software Engineer',
        department: 'Engineering' as const,
        salary: 150000,
        equipmentList: 'MacBook Pro, 4K Monitor',
        githubUsername: 'johndoe_git',
      };

      // 1. Start onboarding
      const sessionId = await startOnboarding(employeeData);
      expect(sessionId).toBeDefined();

      const session1 = getSession(sessionId);
      expect(session1).toBeDefined();
      expect(session1?.record.employeeName).toBe('John Doe');

      // Wait for async orchestrator steps: PM_PLANNING -> FINANCE_AUDIT -> PENDING_FINANCE_APPROVAL
      await wait(100);

      const sessionAfterAudit = getSession(sessionId);
      expect(sessionAfterAudit?.state).toBe('PENDING_FINANCE_APPROVAL');

      // Verify PM and Finance logs are created
      expect(createAuditLog).toHaveBeenCalled();
      
      const pmCompleteLog = vi.mocked(createAuditLog).mock.calls.find(call => 
        call[0].agent === 'PM' && call[0].actionExecuted === 'Completed Product Manager Spec'
      );
      expect(pmCompleteLog).toBeDefined();
      // PM fallback produces plain operational copy
      expect(pmCompleteLog?.[0].thoughtProcess).toMatch(/Onboarding plan|checklist/i);

      const financeCompleteLog = vi.mocked(createAuditLog).mock.calls.find(call => 
        call[0].agent === 'Finance' && call[0].actionExecuted === 'Budget Audited'
      );
      expect(financeCompleteLog).toBeDefined();
      // Finance fallback now produces rich markdown output
      expect(financeCompleteLog?.[0].thoughtProcess).toMatch(/Finance Audit|APPROVE|Approved|within|Budget Analysis/);

      // 2. Approve Finance Step
      await approveStep(sessionId, 'fin-app-1', 'approve', 'Compensation looks good.');
      await wait(100);

      const sessionAfterFinanceApproval = getSession(sessionId);
      expect(sessionAfterFinanceApproval?.state).toBe('PENDING_ENG_APPROVAL');
      
      // Verify Finance decision was logged
      expect(createDecision).toHaveBeenCalled();
      const financeDecision = vi.mocked(createDecision).mock.calls.find(call =>
        call[0].agent === 'Finance' && call[0].decisionStatus === 'Approved'
      );
      expect(financeDecision).toBeDefined();
      expect(financeDecision?.[0].reasoning).toBe('Compensation looks good.');

      // Verify Engineering Setup log is created
      const engSetupLog = vi.mocked(createAuditLog).mock.calls.find(call =>
        call[0].agent === 'Engineering' && call[0].actionExecuted === 'Accounts Provisioned'
      );
      expect(engSetupLog).toBeDefined();
      // Engineering fallback now produces rich markdown output
      expect(engSetupLog?.[0].thoughtProcess).toMatch(/Engineering Provisioning|provisioned|GitHub/);

      // 3. Approve Engineering Release Sign-Off
      await approveStep(sessionId, 'eng-app-1', 'approve', 'Workspace is fully configured.');
      await wait(100);

      const sessionFinal = getSession(sessionId);
      expect(sessionFinal?.state).toBe('COMPLETED');
      expect(sessionFinal?.record.onboardingStatus).toBe('Complete');

      // Verify final Onboarding record is written to Notion
      expect(createOnboardingRecord).toHaveBeenCalled();
      const onboardingRecordCall = vi.mocked(createOnboardingRecord).mock.calls.find(call =>
        call[0].employeeName === 'John Doe' && call[0].onboardingStatus === 'Complete'
      );
      expect(onboardingRecordCall).toBeDefined();

      // Verify final system log
      const finalLog = vi.mocked(createAuditLog).mock.calls.find(call =>
        call[0].agent === 'Engineering' && call[0].actionExecuted === 'Engineering Approved'
      );
      expect(finalLog).toBeDefined();
    });

    it('should transition to FAILED if Finance approves rejects', async () => {
      const employeeData = {
        employeeName: 'Reject Finance',
        role: 'QA Engineer',
        department: 'Engineering' as const,
        salary: 200000,
        equipmentList: 'Laptop',
        githubUsername: 'reject_fin',
      };

      const sessionId = await startOnboarding(employeeData);
      await wait(100);

      // Verify state is PENDING_FINANCE_APPROVAL
      expect(getSession(sessionId)?.state).toBe('PENDING_FINANCE_APPROVAL');

      // Reject Finance
      await approveStep(sessionId, 'fin-rej-1', 'reject', 'Salary exceeds QA budget limit.');
      await wait(100);

      const session = getSession(sessionId);
      expect(session?.state).toBe('FAILED');
      expect(session?.record.onboardingStatus).toBe('Failed');

      // Verify Finance decision was logged as Rejected
      const financeDecision = vi.mocked(createDecision).mock.calls.find(call =>
        call[0].agent === 'Finance' && call[0].decisionStatus === 'Rejected'
      );
      expect(financeDecision).toBeDefined();
      expect(financeDecision?.[0].reasoning).toBe('Salary exceeds QA budget limit.');

      // Verify Onboarding record is written with Failed status
      const onboardingRecordCall = vi.mocked(createOnboardingRecord).mock.calls.find(call =>
        call[0].employeeName === 'Reject Finance' && call[0].onboardingStatus === 'Failed'
      );
      expect(onboardingRecordCall).toBeDefined();
    });

    it('should transition to FAILED if Engineering release rejects', async () => {
      const employeeData = {
        employeeName: 'Reject Eng',
        role: 'DevOps Engineer',
        department: 'Engineering' as const,
        salary: 110000,
        equipmentList: 'Laptop',
        githubUsername: 'reject_eng',
      };

      const sessionId = await startOnboarding(employeeData);
      await wait(100);

      // Approve Finance
      await approveStep(sessionId, 'fin-app-2', 'approve', 'Budget okay.');
      await wait(100);

      // Verify state is PENDING_ENG_APPROVAL
      expect(getSession(sessionId)?.state).toBe('PENDING_ENG_APPROVAL');

      // Reject Engineering
      await approveStep(sessionId, 'eng-rej-1', 'reject', 'Background check failed.');
      await wait(100);

      const session = getSession(sessionId);
      expect(session?.state).toBe('FAILED');
      expect(session?.record.onboardingStatus).toBe('Failed');

      // Verify Engineering decision was logged as Rejected
      const engDecision = vi.mocked(createDecision).mock.calls.find(call =>
        call[0].agent === 'Engineering' && call[0].decisionStatus === 'Rejected'
      );
      expect(engDecision).toBeDefined();
      expect(engDecision?.[0].reasoning).toBe('Background check failed.');
    });
  });

  describe('runAgentThought - Gemini API Integration & Fallbacks', () => {
    it('should fallback to mock responses when GEMINI_API_KEY is missing', async () => {
      process.env.GEMINI_API_KEY = '';

      const pmResult = await runAgentThought(PMAgent, 'Draft PM spec');
      // Fallback contains meaningful PM content
      expect(pmResult.text).toMatch(/Onboarding plan|checklist/i);
      expect(pmResult.cost).toBe(0.0); // fallback cost is 0 (no API call)

      const finResult = await runAgentThought(FinanceAgent, 'Audit $100000 budget for employee');
      expect(finResult.text).toMatch(/Finance Audit|APPROVE|within/i);
      expect(finResult.cost).toBe(0.0);

      const engResult = await runAgentThought(EngineeringAgent, 'Provision accounts for Alice (GitHub: alice123)');
      expect(engResult.text).toMatch(/Engineering setup|Access prepared|GitHub|alice123/i);
      expect(engResult.cost).toBe(0.0);
    });

    it('should execute Gemini API POST request when GEMINI_API_KEY is present and calculate cost', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key-123';

      const mockResponseText = 'Real Gemini Response from Deep Agent thought process.';
      const mockResponseBody = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: mockResponseText,
                },
              ],
            },
          },
        ],
      };

      // Mock native global.fetch
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponseBody),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await runAgentThought(PMAgent, 'Draft special spec');
      
      // Agent tries multiple models in order; first successful call wins
      expect(fetchSpy).toHaveBeenCalled();
      // The first model tried should be gemini-2.0-flash-exp
      expect(fetchSpy.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
      expect(fetchSpy.mock.calls[0][0]).toContain('test-gemini-key-123');
      expect(fetchSpy.mock.calls[0][1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      });

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.contents[0].parts[0].text).toContain('System instructions:');
      expect(requestBody.contents[0].parts[0].text).toContain('Draft special spec');

      // Verify output
      expect(result.text).toBe(mockResponseText);
      
      // Verify cost calculation matches agent formula:
      // inputTokens = ceil((systemPrompt + prompt).length / 4)
      const expectedInputTokens = Math.ceil((PMAgent.systemPrompt + 'Draft special spec').length / 4);
      const expectedOutputTokens = Math.ceil(mockResponseText.length / 4);
      const expectedCost = (expectedInputTokens * 0.075 / 1_000_000) + (expectedOutputTokens * 0.30 / 1_000_000);
      
      expect(result.cost).toBeCloseTo(expectedCost, 8);

      vi.unstubAllGlobals();
    });

    it('should fallback to built-in response if all Gemini API calls fail', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key-123';

      // Mock all fetch calls failing with 500
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('API Unavailable'),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await runAgentThought(PMAgent, 'Draft PM spec');

      // Should fall back to built-in PM response since all API calls failed
      expect(result.text).toMatch(/Onboarding plan|checklist/i);
      expect(result.cost).toBe(0.0); // fallback cost is always 0

      vi.unstubAllGlobals();
    });

    it('should use custom apiKeys parameter and deduplicate them', async () => {
      const customKeys = [
        'custom-key-1',
        '',
        'custom-key-2',
        'custom-key-1',
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Custom Response' }] } }]
        }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await runAgentThought(PMAgent, 'Draft custom spec', customKeys);

      expect(fetchSpy).toHaveBeenCalled();
      // Should try the first unique, non-empty custom key
      expect(fetchSpy.mock.calls[0][0]).toContain('key=custom-key-1');
      expect(result.text).toBe('Custom Response');

      vi.unstubAllGlobals();
    });

    it('should sequentially try keys and succeed on a later key if earlier keys fail', async () => {
      const keysToTry = ['fail-key-1', 'fail-key-2', 'success-key-3'];

      const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('key=fail-key-1') || url.includes('key=fail-key-2')) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: () => Promise.resolve('Rate Limited'),
          };
        }
        if (url.includes('key=success-key-3')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              candidates: [{ content: { parts: [{ text: 'Success Response' }] } }]
            }),
          };
        }
        return {
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Error'),
        };
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await runAgentThought(PMAgent, 'Draft special spec', keysToTry);

      expect(fetchSpy).toHaveBeenCalled();
      const calledKeys = fetchSpy.mock.calls.map(call => {
        const url = call[0];
        const match = url.match(/key=([^&]+)/);
        return match ? match[1] : null;
      });
      expect(calledKeys).toContain('fail-key-1');
      expect(calledKeys).toContain('fail-key-2');
      expect(calledKeys).toContain('success-key-3');
      
      expect(result.text).toBe('Success Response');

      vi.unstubAllGlobals();
    });
  });
});
