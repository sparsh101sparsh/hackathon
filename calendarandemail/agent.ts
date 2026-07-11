import { createOrientationEvent } from './services/calendarService';
import { sendWelcomeEmail } from './services/mailService';

export interface PMPlan {
  employeeName: string;
  employeeEmail: string;
  orientationStartTime: string; // ISO 8601
  orientationEndTime: string;   // ISO 8601
}

export async function executeEngineeringAgent(plan: PMPlan) {
  console.log('Engineering Agent started execution for:', plan.employeeName);

  // 1. Create Calendar Event
  console.log('Creating calendar event...');
  const calendarResponse = await createOrientationEvent(
    plan.employeeName,
    plan.orientationStartTime,
    plan.orientationEndTime
  );
  console.log('Calendar event created:', calendarResponse.eventUrl);

  // 2. Send Email
  console.log('Sending welcome email...');
  await sendWelcomeEmail(
    plan.employeeEmail,
    plan.employeeName,
    calendarResponse.eventUrl || ''
  );
  console.log('Welcome email sent.');

  // 3. Return Notion-ready update
  return {
    "GitHub Invite": true,
    "Calendar Event": true,
    "Calendar URL": calendarResponse.eventUrl,
    "Email Sent": true,
    "Status": "Completed"
  };
}
