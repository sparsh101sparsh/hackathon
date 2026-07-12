import React, { useState, useEffect, useRef } from 'react';
import {
  BadgeCheck,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Code2,
  Database,
  GitBranch,
  Calendar,
  Mail,
  LockKeyhole,
  MessageSquareText,
  NotepadText,
  Play,
  Plus,
  Route,
  ShieldCheck,
  UserRound,
  X,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import './index.css';

// @ts-ignore
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface EmployeeOnboardingData {
  name: string;
  role: string;
  department: string;
  salary: number;
  githubUsername: string;
  email: string;
  equipment: string;
  companyBudget?: number;
}

interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  details: string;
  sessionId: string;
}

interface Decision {
  id?: string;
  decisionName: string;
  goalId: string;
  agent: string;
  decisionStatus: string;
  timestamp: string;
  reasoning: string;
}

interface AuditLog {
  id?: string;
  logId?: string;
  stepName: string;
  agent: string;
  actionExecuted: string;
  thoughtProcess: string;
  cost: number;
  timestamp: string;
}

interface OnboardingRecord {
  id?: string;
  employeeName: string;
  role: string;
  department: string;
  salary: number;
  equipmentList: string;
  githubUsername: string;
  onboardingStatus: string;
  email?: string;
  calendarEventUrl?: string;
  emailSent?: boolean;
}

interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string; }

interface AgentCard {
  name: string;
  label: string;
  status: string;
  tasks: { text: string; done: boolean }[];
  tone: 'pm' | 'finance' | 'engineering';
}

const PIPELINE_STEPS = [
  { key: 'INGESTED', label: 'Request', Icon: Play },
  { key: 'PM_PLANNING', label: 'Product Manager Plan', Icon: ClipboardCheck },
  { key: 'FINANCE_AUDIT', label: 'Finance', Icon: CircleDollarSign },
  { key: 'PENDING_FINANCE_APPROVAL', label: 'Approval', Icon: Clock3, human: true },
  { key: 'ENGINEERING_SETUP', label: 'Setup', Icon: Code2 },
  { key: 'PENDING_ENG_APPROVAL', label: 'Sign-off', Icon: ShieldCheck, human: true },
  { key: 'COMPLETED', label: 'Done', Icon: BadgeCheck },
];

const STATE_ORDER = PIPELINE_STEPS.map(s => s.key);

function getStepStatus(stepKey: string, currentState: string): 'completed' | 'active' | 'pending-human' | 'idle' {
  const stepIdx = STATE_ORDER.indexOf(stepKey);
  const currentIdx = STATE_ORDER.indexOf(currentState);
  const step = PIPELINE_STEPS.find(s => s.key === stepKey);
  if (stepIdx < currentIdx) return 'completed';
  if (stepKey === currentState) return step?.human ? 'pending-human' : 'active';
  return 'idle';
}

function IconBox({ Icon }: { Icon: LucideIcon; tone?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'neutral' }) {
  return (
    <div className="card-icon">
      <Icon size={18} strokeWidth={2.2} />
    </div>
  );
}

function buildAgentCards(state: string): AgentCard[] {
  const cards: AgentCard[] = [
    {
      name: 'Product Manager',
      label: 'Product Manager Agent',
      status: 'Waiting',
      tasks: [
        { text: 'Generate onboarding roadmap', done: false },
        { text: 'Build Week 1 plan', done: false },
        { text: 'Assign milestones', done: false },
        { text: 'Prepare orientation checklist', done: false },
      ],
      tone: 'pm',
    },
    {
      name: 'Finance',
      label: 'Finance Agent',
      status: 'Waiting',
      tasks: [
        { text: 'Validate salary', done: false },
        { text: 'Check equipment cost', done: false },
        { text: 'Verify budget', done: false },
        { text: 'Await manager approval', done: false },
      ],
      tone: 'finance',
    },
    {
      name: 'Engineering',
      label: 'Engineering Agent',
      status: 'Waiting',
      tasks: [
        { text: 'GitHub organization invitation', done: false },
        { text: 'GitHub onboarding issue', done: false },
        { text: 'Google Calendar orientation event', done: false },
        { text: 'Welcome email sent', done: false },
        { text: 'Notion synced', done: false },
      ],
      tone: 'engineering',
    },
  ];

  if (!state) return cards;

  if (['PM_PLANNING', 'FINANCE_AUDIT', 'PENDING_FINANCE_APPROVAL', 'ENGINEERING_SETUP', 'PENDING_ENG_APPROVAL', 'COMPLETED'].includes(state)) {
    cards[0].status = state === 'PM_PLANNING' ? 'Planning' : 'Complete';
    cards[0].tasks.forEach(t => t.done = state !== 'PM_PLANNING');
  }

  if (['FINANCE_AUDIT', 'PENDING_FINANCE_APPROVAL', 'ENGINEERING_SETUP', 'PENDING_ENG_APPROVAL', 'COMPLETED'].includes(state)) {
    cards[1].status = state === 'FINANCE_AUDIT' ? 'Checking budget' : (state === 'PENDING_FINANCE_APPROVAL' ? 'Approval requested' : 'Complete');
    cards[1].tasks[0].done = state !== 'FINANCE_AUDIT';
    cards[1].tasks[1].done = state !== 'FINANCE_AUDIT';
    cards[1].tasks[2].done = state !== 'FINANCE_AUDIT';
    cards[1].tasks[3].done = !['FINANCE_AUDIT', 'PENDING_FINANCE_APPROVAL'].includes(state);
  }

  if (['ENGINEERING_SETUP', 'PENDING_ENG_APPROVAL', 'COMPLETED'].includes(state)) {
    cards[2].status = state === 'ENGINEERING_SETUP' ? 'Provisioning' : (state === 'PENDING_ENG_APPROVAL' ? 'Sign-off needed' : 'Complete');
    cards[2].tasks.forEach(t => t.done = !['ENGINEERING_SETUP'].includes(state));
  }

  if (state === 'FAILED') {
    cards.forEach(card => {
      card.status = 'Stopped';
    });
  }

  return cards;
}

export default function App() {
  const [formData, setFormData] = useState<EmployeeOnboardingData>({
    name: '', role: '', department: 'Engineering',
    salary: 140000, githubUsername: '', email: '', companyBudget: 5000000, equipment: 'MacBook Pro M3 Max, LG 34" Ultrawide Monitor',
  });
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<Array<{ agent: string; text: string; timestamp: string }>>([
    { agent: 'System', text: 'Ready. Add a new employee to start.', timestamp: new Date().toLocaleTimeString() },
  ]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [sessionState, setSessionState] = useState<string>('');
  const [sessionRecord, setSessionRecord] = useState<OnboardingRecord | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notionDecisions, setNotionDecisions] = useState<Decision[]>([]);
  const [notionAuditLogs, setNotionAuditLogs] = useState<AuditLog[]>([]);
  const [notionOnboardingRecords, setNotionOnboardingRecords] = useState<OnboardingRecord[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'calendar' | 'mails' | 'employeeList' | 'employeeData' | null>(null);
  
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>(['MacBook Pro', '27" Monitor', 'Keyboard', 'Mouse']);
  const [customEquipment, setCustomEquipment] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const memorySectionRef = useRef<HTMLDivElement>(null);

  const selectedEquipment = formData.equipment ? formData.equipment.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggleEquipment = (item: string) => {
    let nextList;
    if (selectedEquipment.includes(item)) {
      nextList = selectedEquipment.filter(e => e !== item);
    } else {
      nextList = [...selectedEquipment, item];
    }
    setFormData(p => ({ ...p, equipment: nextList.join(', ') }));
  };

  const addCustomEquipment = () => {
    if (customEquipment.trim()) {
      const newItem = customEquipment.trim();
      if (!equipmentOptions.includes(newItem)) {
        setEquipmentOptions([...equipmentOptions, newItem]);
      }
      if (!selectedEquipment.includes(newItem)) {
        setFormData(p => ({ ...p, equipment: [...selectedEquipment, newItem].join(', ') }));
      }
      setCustomEquipment('');
      setIsAddingCustom(false);
    }
  };

  const addToast = (type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchNotionData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notion-data`);
      if (res.ok) {
        const data = await res.json();
        const memory = data.notionData || data.mockData || {};
        setNotionDecisions(memory.decisions || []);
        setNotionAuditLogs(memory.auditLogs || []);
        setNotionOnboardingRecords(memory.onboardingRecords || []);
        if (data.activeSessions) {
          setActiveSessions(data.activeSessions);
        }
      }
    } catch {} finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/events`);
    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);
    es.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        if (event === 'session_updated' && data) {
          setSessionState(data.state);
          setSessionRecord(data.record);
          if (data.logs?.length) {
            const newest = data.logs[data.logs.length - 1];
            setLogs(prev => {
              const text = newest.actionExecuted && newest.thoughtProcess
                ? `${newest.actionExecuted}\n${newest.thoughtProcess}`
                : newest.thoughtProcess || newest.actionExecuted || '';
              const isDup = prev.some(l => l.text === text && l.agent === newest.agent);
              if (isDup) return prev;
              return [...prev, { agent: newest.agent, text, timestamp: new Date().toLocaleTimeString() }];
            });
          }
          if (data.state === 'PENDING_FINANCE_APPROVAL') {
            setApprovals(prev => prev.some(a => a.type === 'finance') ? prev : [
              ...prev,
              { id: `finance-${data.sessionId}`, type: 'finance', title: 'Finance approval needed',
                details: `${data.record?.employeeName || 'Employee'} · ${data.record?.role || 'Role'} · Salary $${Number(data.record?.salary || 0).toLocaleString()} · Equipment: ${data.record?.equipmentList || 'standard kit'}`,
                sessionId: data.sessionId }
            ]);
          }
          if (data.state === 'PENDING_ENG_APPROVAL') {
            setApprovals(prev => prev.some(a => a.type === 'engineering') ? prev : [
              ...prev,
              { id: `eng-${data.sessionId}`, type: 'engineering', title: 'Engineering sign-off needed',
                details: `Access is ready for ${data.record?.employeeName || 'employee'}. Review before closing the workflow.`,
                sessionId: data.sessionId }
            ]);
          }
          if (data.state === 'COMPLETED') {
            setApprovals([]);
            addToast('success', `Onboarding finished for ${data.record?.employeeName}.`);
            setTimeout(fetchNotionData, 1500);
          }
          if (data.state === 'FAILED') {
            setApprovals([]);
            addToast('error', `Onboarding stopped for ${data.record?.employeeName}.`);
            setTimeout(fetchNotionData, 1500);
          }
        }
      } catch {}
    };
    fetchNotionData();
    const poll = setInterval(fetchNotionData, 8000);
    return () => { es.close(); clearInterval(poll); };
  }, []);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role) { addToast('error', 'Name and role are required.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const { sessionId } = await res.json();
        setSessionState('INGESTED');
        setApprovals([]);
        setLogs([{ agent: 'System', text: `Session ${sessionId} started. Product Manager is preparing the plan.`, timestamp: new Date().toLocaleTimeString() }]);
        addToast('info', 'Onboarding started.');
      } else {
        const err = await res.json();
        addToast('error', err.error || 'Failed to start onboarding.');
      }
    } catch {
      addToast('error', 'Cannot reach server. Is it running?');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (approvalId: string, action: 'approve' | 'reject', sessionId: string) => {
    setApprovingId(approvalId);
    try {
      const res = await fetch(`${API_URL}/api/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, action, sessionId }),
      });
      if (res.ok) {
        setApprovals(prev => prev.filter(a => a.id !== approvalId));
        addToast(action === 'approve' ? 'success' : 'error', action === 'approve' ? 'Approved.' : 'Rejected.');
      }
    } catch { addToast('error', 'Approval request failed.'); } finally {
      setApprovingId(null);
    }
  };

  const totalCost = notionAuditLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const agentCards = buildAgentCards(sessionState);
  const pendingApprovalCount = approvals.length;
  const pendingInvitesCount = notionAuditLogs.filter(l => l.actionExecuted && l.actionExecuted.includes("Invitation sent.")).length;
  const issuesCreatedCount = notionAuditLogs.filter(l => l.actionExecuted && /Issue #/.test(l.actionExecuted)).length;
  const notionPageCount = notionDecisions.length + notionAuditLogs.length + notionOnboardingRecords.length;
  const calendarEventsCount = notionAuditLogs.filter(l => l.actionExecuted && l.actionExecuted.includes('Orientation scheduled')).length;
  const emailsSentCount = notionAuditLogs.filter(l => l.actionExecuted && l.actionExecuted.includes('Welcome email delivered')).length;


  const renderModal = () => {
    if (!activeModal) return null;

    let content = null;
    let title = '';
    let Icon = Database;

    if (activeModal === 'calendar') {
      title = 'Calendar Events';
      Icon = Calendar;
      content = (
        <div style={{ display: 'grid', gap: '16px' }}>
          {notionOnboardingRecords.map(r => (
            <div key={r.id || r.employeeName} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.employeeName}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                {r.calendarEventUrl ? (
                  <a href={r.calendarEventUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4285F4', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> View Event
                  </a>
                ) : 'No calendar event scheduled.'}
              </div>
            </div>
          ))}
        </div>
      );
    } else if (activeModal === 'mails') {
      title = 'Emails';
      Icon = Mail;
      content = (
        <div style={{ display: 'grid', gap: '16px' }}>
          {notionOnboardingRecords.map(r => (
            <div key={r.id || r.employeeName} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.employeeName}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Mail size={14} /> {r.email || (r.emailSent ? <span style={{ color: '#2ecc71' }}>Welcome Email Delivered</span> : 'Waiting...')}</span>
              </div>
            </div>
          ))}
        </div>
      );
    } else if (activeModal === 'employeeList') {
      title = 'Employee List';
      Icon = UserRound;
      content = (
        <div style={{ display: 'grid', gap: '16px' }}>
          {notionOnboardingRecords.map(r => (
            <div key={r.id || r.employeeName} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.employeeName}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{r.role}</div>
            </div>
          ))}
        </div>
      );
    } else if (activeModal === 'employeeData') {
      title = 'Employee Data';
      Icon = NotepadText;
      content = (
        <div style={{ display: 'grid', gap: '16px' }}>
          {notionOnboardingRecords.map(r => (
            <div key={r.id || r.employeeName} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>{r.employeeName}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div><strong>Role:</strong> {r.role}</div>
                <div><strong>Dept:</strong> {r.department}</div>
                <div><strong>Salary:</strong> ${r.salary.toLocaleString()}</div>
                <div><strong>GitHub:</strong> {r.githubUsername || 'N/A'}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Equipment:</strong> {r.equipmentList}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Status:</strong> {r.onboardingStatus}</div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="modal-overlay" onClick={() => setActiveModal(null)}>
        <div className="modal-container" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              <Icon size={20} /> {title}
            </div>
            <button className="modal-close" onClick={() => setActiveModal(null)}><X size={20} /></button>
          </div>
          <div className="modal-content">
            {notionOnboardingRecords.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">No records available.</div>
              </div>
            ) : content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {isInitialLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', color: 'white'
        }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--text-primary)', marginBottom: '20px' }} />
          <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>Fetching data...</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Estimated time ~ 15-20s</div>
        </div>
      )}
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo"><Route size={18} strokeWidth={2.4} /></div>
          <div>
            <div className="navbar-name">OrgOS</div>
            <div className="navbar-sub">Company workflow system</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={`status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot" />
            {isConnected ? 'Live' : 'Disconnected'}
          </div>
          <a
            href="https://app.notion.com/p/OrgOS-AI-Enterprise-Operating-System-39979cc215378182afdfd2833e81abc9?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            className="status-pill"
            style={{ color: '#8888aa', textDecoration: 'none' }}
          >
            <Database size={14} /> Notion Company Memory
          </a>
        </div>
      </nav>

    <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-section-title">Navigation</div>
          <button className="sidebar-item" onClick={() => memorySectionRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            <Database size={16} /> Notion Records
          </button>
          <button className="sidebar-item" onClick={() => setActiveModal('calendar')}>
            <Calendar size={16} /> Calendar
          </button>
          <button className="sidebar-item" onClick={() => setActiveModal('mails')}>
            <Mail size={16} /> Mails
          </button>
          <button className="sidebar-item" onClick={() => setActiveModal('employeeList')}>
            <UserRound size={16} /> Employee List
          </button>
          <button className="sidebar-item" onClick={() => setActiveModal('employeeData')}>
            <NotepadText size={16} /> Employee Data
          </button>
        </aside>

        <div className="main-container">

        {/* ── Stats Row ── */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Employees Onboarded</div>
            <div className="stat-value">{notionOnboardingRecords.length}</div>
            <div className="stat-sub">finished</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value">{pendingApprovalCount}</div>
            <div className="stat-sub">waiting for you</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Calendar Events</div>
            <div className="stat-value">{calendarEventsCount}</div>
            <div className="stat-sub">orientations</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Emails Sent</div>
            <div className="stat-value">{emailsSentCount}</div>
            <div className="stat-sub">welcome emails</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Invites</div>
            <div className="stat-value">{pendingInvitesCount}</div>
            <div className="stat-sub">sent</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Issues Created</div>
            <div className="stat-value">{issuesCreatedCount}</div>
            <div className="stat-sub">checklists</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Notion Pages</div>
            <div className="stat-value">{notionPageCount}</div>
            <div className="stat-sub">records</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Run Cost</div>
            <div className="stat-value">${totalCost.toFixed(4)}</div>
            <div className="stat-sub">run estimate</div>
          </div>
        </div>

        {/* ── Judge-Facing Flow Summary ── */}
        <div className="flow-summary card" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '12px', left: '16px', fontSize: '16px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Agent Workflow</div>
          <div className="flow-step"><span className="flow-dot pm" /><span>Product Manager</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step"><span className="flow-dot finance" /><span>Finance</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step human"><span className="flow-dot human" /><span>Human Approval</span></div>
          <div className="flow-arrow">→</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="flow-step engineering" style={{ position: 'relative' }}>
              <span className="flow-dot engineering" />
              <span>Engineering</span>
              <div style={{ position: 'absolute', right: '-10px', top: '50%', width: '10px', height: '2px', background: 'var(--border)' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
              {/* Vertical line connecting the items */}
              <div style={{ position: 'absolute', left: '-10px', top: '16px', bottom: '16px', width: '2px', background: 'var(--border)' }} />
              
              <div className="flow-step" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', position: 'relative', padding: '6px 12px' }}>
                <div style={{ position: 'absolute', left: '-10px', top: '50%', width: '10px', height: '2px', background: 'var(--border)' }} />
                <GitBranch size={13} color="var(--text-primary)" />
                <span>Create invite and issues</span>
              </div>
              <div className="flow-step" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', position: 'relative', padding: '6px 12px' }}>
                <div style={{ position: 'absolute', left: '-10px', top: '50%', width: '10px', height: '2px', background: 'var(--border)' }} />
                <Calendar size={13} color="#4285F4" />
                <span>Schedule orientation on calendar</span>
              </div>
              <div className="flow-step" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', position: 'relative', padding: '6px 12px' }}>
                <div style={{ position: 'absolute', left: '-10px', top: '50%', width: '10px', height: '2px', background: 'var(--border)' }} />
                <Mail size={13} color="#EA4335" />
                <span>Send welcome mail</span>
              </div>
              <div className="flow-step" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', position: 'relative', padding: '6px 12px' }}>
                <div style={{ position: 'absolute', left: '-10px', top: '50%', width: '10px', height: '2px', background: 'var(--border)' }} />
                <Database size={13} color="#9C27B0" />
                <span>Update Notion records</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Pipeline ── */}
        {sessionState && (
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card-header" style={{ width: '100%', marginBottom: '24px' }}>
              <IconBox Icon={Route} tone="purple" />
              <div>
                <div className="card-title">Agent Pipeline</div>
                <div className="card-subtitle">
                  {sessionRecord?.employeeName ? `${sessionRecord.employeeName} · ${sessionRecord.role}` : 'Session running'}
                </div>
              </div>
            </div>
            <div className="pipeline">
              {PIPELINE_STEPS.map((step, i) => {
                const status = getStepStatus(step.key, sessionState);
                const StepIcon = step.Icon;
                return (
                  <div key={step.key} className="pipeline-step">
                    <div className="pipeline-node">
                      <div className={`pipeline-dot ${status}`}>
                        <StepIcon size={13} strokeWidth={2.4} />
                      </div>
                      <div className={`pipeline-label ${status}`}>{step.label}</div>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className={`pipeline-connector ${status === 'completed' ? 'completed' : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Agent Cards ── */}
        <div className="agent-card-grid">
          {agentCards.map(agent => (
            <div key={agent.name} className={`agent-card ${agent.tone}`}>
              <div className="agent-card-topline">
                <span className={`agent-live-dot ${agent.tone}`} />
                <div>
                  <div className="agent-card-name">{agent.name}</div>
                  <div className="agent-card-label">{agent.label}</div>
                </div>
              </div>
              <div className="agent-card-status">{agent.status}</div>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {agent.tasks.map((task, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: task.done ? 'var(--text-secondary)' : 'white', transition: 'color 0.2s ease' }}>
                    <div style={{ 
                      marginTop: '2px',
                      width: '12px', height: '12px', 
                      borderRadius: '3px', 
                      border: task.done ? '1px solid rgba(52,211,153,0.4)' : '1px solid white',
                      backgroundColor: task.done ? 'var(--green-subtle)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {task.done && <Check size={8} color="white" strokeWidth={4} />}
                    </div>
                    <span style={{ textDecoration: task.done ? 'line-through' : 'none', flex: 1, lineHeight: '1.4' }}>{task.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Layout ── */}
        <div className="main-layout">

          {/* ── LEFT: Form + Approvals ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Company Config */}
            <div className="card">
              <div className="card-header">
                <IconBox Icon={CircleDollarSign} tone="green" />
                <div>
                  <div className="card-title">Company Configuration</div>
                  <div className="card-subtitle">Global settings and limits</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Budget ($)</label>
                  <input className="form-input" type="number" value={formData.companyBudget || ''}
                    onChange={e => setFormData(p => ({ ...p, companyBudget: e.target.value === '' ? 0 : Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" disabled>
                    <option>USD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Onboarding Form */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <IconBox Icon={Plus} tone="purple" />
                <div>
                  <div className="card-title">New Employee Onboarding</div>
                  <div className="card-subtitle">Product Manager, Finance, and Engineering will review it</div>
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" placeholder="Shashwat Rastogi" value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <input className="form-input" placeholder="Senior Engineer" value={formData.role}
                      onChange={e => setFormData(p => ({ ...p, role: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-select" value={formData.department}
                      onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}>
                      <option>Engineering</option>
                      <option>Product</option>
                      <option>Finance</option>
                      <option>Sales</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Annual Salary ($)</label>
                    <input className="form-input" type="number" value={formData.salary || ''}
                      onChange={e => setFormData(p => ({ ...p, salary: e.target.value === '' ? 0 : Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">GitHub Username</label>
                  <input className="form-input" placeholder="shashwatrastogi" value={formData.githubUsername}
                    onChange={e => setFormData(p => ({ ...p, githubUsername: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee Email</label>
                  <input className="form-input" placeholder="shashwat@gmail.com" value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <div style={{ backgroundColor: 'var(--bg-lighter)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Equipment Allocation</div>
                    <hr style={{ border: 'none', borderBottom: '1px solid var(--border)', marginBottom: '16px' }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                      {equipmentOptions.map(item => (
                        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                          <div style={{ position: 'relative', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedEquipment.includes(item)}
                              onChange={() => toggleEquipment(item)}
                              style={{ 
                                appearance: 'none', position: 'absolute', inset: 0, margin: 0, width: '100%', height: '100%',
                                border: '1px solid #ffffff', borderRadius: '3px', 
                                backgroundColor: 'transparent', cursor: 'pointer', zIndex: 1
                              }}
                            />
                            {selectedEquipment.includes(item) && (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                <Check size={11} color="var(--text-primary)" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          {item}
                        </label>
                      ))}
                    </div>

                    <hr style={{ border: 'none', borderBottom: '1px solid var(--border)', marginBottom: '12px' }} />
                    
                    {isAddingCustom ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>[</span>
                        <input 
                          autoFocus
                          placeholder="Type resource..." 
                          value={customEquipment}
                          onChange={e => setCustomEquipment(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomEquipment();
                            } else if (e.key === 'Escape') {
                              setIsAddingCustom(false);
                            }
                          }}
                          onBlur={() => {
                            if (customEquipment.trim()) addCustomEquipment();
                            else setIsAddingCustom(false);
                          }}
                          style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: '13px', color: 'var(--text-primary)', flex: 1, padding: 0 }}
                        />
                        <button 
                          type="button" 
                          onClick={addCustomEquipment}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                        >
                          +
                        </button>
                        <span style={{ color: 'var(--text-secondary)' }}>]</span>
                      </div>
                    ) : (
                      <button 
                        type="button" 
                        onClick={() => setIsAddingCustom(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}
                      >
                        + Add custom resource...
                      </button>
                    )}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner" /> Starting...</> : <><Play size={16} /> Start onboarding</>}
                </button>
              </form>
            </div>


          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* ── RIGHT: Agent Workspace ── */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="card-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <IconBox Icon={MessageSquareText} tone="blue" />
                  <div>
                    <div className="card-title">Live Feed</div>
                    <div className="card-subtitle">Agents talk here before Notion is updated</div>
                  </div>
                </div>
                <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setHistoryOpen(true)}>
                  <Clock3 size={14} /> History
                </button>
              </div>
              <div className="agent-workspace">
                <div className="chat-feed">
                  {logs.map((log, i) => (
                    <div key={i} className="chat-bubble">
                      <div className="chat-meta">
                        <span className={`agent-badge ${log.agent}`}>
                          {log.agent === 'Engineering'
                            ? (/github|username|invitation|issue/i.test(log.text) ? <GitBranch size={14} style={{ marginRight: '4px' }} /> : /calendar|orientation/i.test(log.text) ? <Calendar size={14} style={{ marginRight: '4px' }} /> : /email|gmail/i.test(log.text) ? <Mail size={14} style={{ marginRight: '4px' }} /> : /notion/i.test(log.text) ? <NotepadText size={14} style={{ marginRight: '4px' }} /> : <Bot size={14} style={{ marginRight: '4px' }} />)
                            : log.agent === 'PM' ? <Bot size={14} style={{ marginRight: '4px' }} />
                            : log.agent === 'Finance' ? <CircleDollarSign size={14} style={{ marginRight: '4px' }} />
                            : log.agent === 'System' ? <Bot size={14} style={{ marginRight: '4px' }} />
                            : ''}
                          {log.agent === 'PM' ? 'Product Manager' : log.agent}
                        </span>
                        <span className="chat-time">{log.timestamp}</span>
                      </div>
                      <div className="chat-text">{log.text}</div>
                      {i < logs.length - 1 && <div className="chat-arrow">↓</div>}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-workspace-hint">
                  Agent notes stay here. Final records go to Notion.
                </div>
                
                {/* Approval Pending Warning */}
                {(sessionState === 'PENDING_FINANCE_APPROVAL' || sessionState === 'PENDING_ENG_APPROVAL') && (
                  <div style={{ padding: '12px', marginTop: '10px', backgroundColor: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', borderRadius: '8px', border: '1px solid rgba(255, 59, 48, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, fontSize: '13px' }}>
                    <ShieldCheck size={16} /> Approval Pending — Please review the request below.
                  </div>
                )}
  
                {/* Active Loading Indicator */}
                {(sessionState === 'PM_PLANNING' || sessionState === 'FINANCE_AUDIT' || sessionState === 'ENGINEERING_SETUP') && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 14px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: 'var(--text-primary)' }} />
                    {sessionState === 'PM_PLANNING' && "PM Agent is autonomously planning... est. ~15s"}
                    {sessionState === 'FINANCE_AUDIT' && "Finance Agent is autonomously auditing budget... est. ~15s"}
                    {sessionState === 'ENGINEERING_SETUP' && "Engineering Agent is autonomously setting up access... est. ~20s"}
                  </div>
                )}
  
                {/* Agent Execution Summary */}
                {sessionState === 'COMPLETED' && sessionRecord && (
                  <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-lighter)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ClipboardCheck size={16} color="#4CAF50" />
                      Agent Execution Summary
                    </div>
                    <div style={{ display: 'grid', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Calendar size={14} style={{ marginTop: '2px', color: '#4285F4' }} />
                        <div>
                          <div style={{ color: 'var(--text-primary)' }}>Calendar Event Created</div>
                          <div>Orientation scheduled for {sessionRecord.employeeName}. {sessionRecord.calendarEventUrl && <a href={sessionRecord.calendarEventUrl} target="_blank" rel="noreferrer" style={{ color: '#4285F4', textDecoration: 'none' }}>View Event ↗</a>}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <GitBranch size={14} style={{ marginTop: '2px', color: 'var(--text-primary)' }} />
                        <div>
                          <div style={{ color: 'var(--text-primary)' }}>GitHub Access Provisioned</div>
                          <div>Invited <strong>{sessionRecord.githubUsername}</strong> to the organization repository.</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Mail size={14} style={{ marginTop: '2px', color: '#EA4335' }} />
                        <div>
                          <div style={{ color: 'var(--text-primary)' }}>Welcome Email Sent</div>
                          <div>Delivered to <strong>{sessionRecord.email || `${sessionRecord.employeeName.split(' ')[0].toLowerCase()}@gmail.com`}</strong> with onboarding instructions.</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Database size={14} style={{ marginTop: '2px', color: '#9C27B0' }} />
                        <div>
                          <div style={{ color: 'var(--text-primary)' }}>Notion Records Updated</div>
                          <div>Employee profiles and access logs successfully written to company memory.</div>
                        </div>
                      </div>
  
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Human Approval Gates */}
            <div className="card">
              <div className="card-header">
                <IconBox Icon={LockKeyhole} tone="orange" />
                <div>
                  <div className="card-title">Human Approval Gates</div>
                  <div className="card-subtitle">The workflow pauses here</div>
                </div>
              </div>
              {approvals.length === 0 ? (
                <div className="empty-state">
                  <ShieldCheck size={30} className="empty-state-icon" />
                  <div className="empty-state-text">No approvals waiting.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {approvals.map(app => (
                    <div key={app.id} className="approval-gate">
                      <div className="approval-gate-header">
                        <div className="approval-gate-title">{app.title}</div>
                      </div>
                      <div className="approval-gate-detail">{app.details}</div>
                      {sessionRecord && (
                        <div className="approval-facts">
                          <div>
                            <span>Employee</span>
                            <strong>{sessionRecord.employeeName}</strong>
                          </div>
                          <div>
                            <span>Salary</span>
                            <strong>${sessionRecord.salary.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span>Equipment</span>
                            <strong>{sessionRecord.equipmentList}</strong>
                          </div>
                        </div>
                      )}
                      <div className="approval-actions">
                        <button 
                          className="btn btn-reject" 
                          onClick={() => handleApprove(app.id, 'reject', app.sessionId)}
                          disabled={approvingId === app.id}
                        >
                          <X size={15} /> Reject
                        </button>
                        <button 
                          className="btn btn-approve" 
                          onClick={() => handleApprove(app.id, 'approve', app.sessionId)}
                          disabled={approvingId === app.id}
                        >
                          {approvingId === app.id ? <div className="spinner" style={{ width: '12px', height: '12px', borderTopColor: 'currentColor' }} /> : <Check size={15} />} {approvingId === app.id ? 'Approving...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Notion Memory Explorer ── */}
        <div className="memory-section" ref={memorySectionRef}>
          <div className="section-label" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={13} /> Notion Company Memory — approvals, audit, decisions, history
            </div>
            <a 
              href="https://app.notion.com/p/OrgOS-AI-Enterprise-Operating-System-39979cc215378182afdfd2833e81abc9?source=copy_link"
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                color: 'var(--text-secondary)', 
                textDecoration: 'none', 
                textTransform: 'none', 
                letterSpacing: 'normal',
                fontWeight: 500
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              Visit Notion Page ↗
            </a>
          </div>
          <div className="memory-grid">
            {/* Decisions DB */}
            <div className="memory-panel">
              <div className="memory-panel-header">
                <div className="memory-panel-title"><ClipboardCheck size={16} /> Decisions</div>
                <div className="memory-count">{notionDecisions.length} records</div>
              </div>
              <div className="memory-list">
                {notionDecisions.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <ClipboardCheck size={24} className="empty-state-icon" />
                    <div className="empty-state-text">No decisions recorded yet.</div>
                  </div>
                ) : notionDecisions.slice().reverse().map((d, i) => (
                  <div key={d.id || i} className="memory-item">
                    <div className="memory-item-title">
                      <span>{d.decisionName}</span>
                      <span className={`status-badge ${d.decisionStatus.toLowerCase()}`}>{d.decisionStatus}</span>
                    </div>
                    <div className="memory-item-body">{d.reasoning}</div>
                    <div className="memory-item-footer">
                      <span>Agent: {d.agent}</span>
                      <span>{new Date(d.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Logs DB */}
            <div className="memory-panel">
              <div className="memory-panel-header">
                <div className="memory-panel-title"><NotepadText size={16} /> Audit Logs</div>
                <div className="memory-count">{notionAuditLogs.length} records</div>
              </div>
              <div className="memory-list">
                {notionAuditLogs.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <NotepadText size={24} className="empty-state-icon" />
                    <div className="empty-state-text">No audit logs yet.</div>
                  </div>
                ) : notionAuditLogs.slice().reverse().map((l, i) => (
                  <div key={l.id || i} className="memory-item">
                    <div className="memory-item-title">
                      <span>{l.actionExecuted}</span>
                      <span className={`agent-badge ${l.agent}`} style={{ fontSize: '9px' }}>{l.agent}</span>
                    </div>
                    <div className="memory-item-body">{l.thoughtProcess}</div>
                    <div className="memory-item-footer">
                      <span>{l.stepName} {l.cost > 0 ? `· $${l.cost.toFixed(4)}` : ''}</span>
                      <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Onboarding Records DB */}
            <div className="memory-panel">
              <div className="memory-panel-header">
                <div className="memory-panel-title"><UserRound size={16} /> Onboarding Records</div>
                <div className="memory-count">{notionOnboardingRecords.length} records</div>
              </div>
              <div className="memory-list">
                {notionOnboardingRecords.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <UserRound size={24} className="empty-state-icon" />
                    <div className="empty-state-text">No onboarding records yet.</div>
                  </div>
                ) : notionOnboardingRecords.slice().reverse().map((r, i) => (
                  <div key={r.id || i} className="memory-item">
                    <div className="memory-item-title">
                      <span>{r.employeeName}</span>
                      <span className={`status-badge ${r.onboardingStatus.toLowerCase().replace(' ', '-')}`}>
                        {r.onboardingStatus}
                      </span>
                    </div>
                    <div className="memory-item-body">{r.role} · {r.department} · ${r.salary.toLocaleString()}/yr</div>
                    <div className="memory-item-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>GitHub: {r.githubUsername || 'N/A'}</span>
                        <span>{r.equipmentList?.slice(0, 20)}…</span>
                      </div>
                      {/* NEW: Calendar and Email Data from Backend */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: '4px', marginTop: '2px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={14} /> Calendar: {r.calendarEventUrl ? <a href={r.calendarEventUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>View Event</a> : 'Waiting...'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={14} /> Email: {r.email || (r.emailSent ? <span style={{ color: '#2ecc71' }}>Delivered</span> : 'Waiting...')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>


        </div>
      </div>
      </div>

      {/* ── Toast Container ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* ── History Modal ── */}
      {historyOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 10, 15, 0.7)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setHistoryOpen(false)}>
          <div style={{
            background: 'var(--bg-card)', width: '600px', maxHeight: '80vh',
            borderRadius: '16px', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px' }}>Live Feed History</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Past session logs</div>
              </div>
              <button onClick={() => setHistoryOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {activeSessions.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No session history available.</div>
              ) : activeSessions.slice().reverse().map(session => (
                <div key={session.id}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    Session: {session.record?.employeeName || session.id}
                  </div>
                  <div className="chat-feed" style={{ maxHeight: 'none', overflow: 'visible', padding: 0 }}>
                    {session.logs.map((log: any, i: number) => (
                      <div key={i} className="chat-bubble">
                        <div className="chat-meta">
                          <span className={`agent-badge ${log.agent}`}>
                            {log.agent === 'PM' ? 'Product Manager' : log.agent}
                          </span>
                        </div>
                        <div className="chat-text">{log.thoughtProcess || log.actionExecuted}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {renderModal()}
    </div>
  );
}
