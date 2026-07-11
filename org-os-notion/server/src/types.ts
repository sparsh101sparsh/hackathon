export interface Decision {
  id?: string;
  decisionName: string;
  goalId: string;
  agent: 'PM' | 'Finance' | 'Engineering';
  decisionStatus: 'Approved' | 'Rejected' | 'Pending';
  timestamp: string;
  reasoning: string;
}

export interface AuditLog {
  id?: string;
  logId?: string;
  stepName: string;
  agent: 'System' | 'PM' | 'Finance' | 'Engineering';
  actionExecuted: string;
  thoughtProcess: string;
  cost: number;
  timestamp: string;
}

export interface OnboardingRecord {
  id?: string;
  employeeName: string;
  role: string;
  department: 'Product' | 'Finance' | 'Engineering' | 'Sales';
  salary: number;
  equipmentList: string;
  githubUsername: string;
  email?: string;
  companyBudget?: number;
  onboardingStatus: 'In Progress' | 'Complete' | 'Failed';
  // Google Calendar & Gmail results
  calendarEventUrl?: string;
  calendarEventDate?: string;
  emailSent?: boolean;
}
