import { google } from 'googleapis';
import { getOAuthClient } from '../auth';

export async function sendWelcomeEmail(
  employeeEmail: string, 
  employeeName: string, 
  eventUrl: string
) {
  const auth = await getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const subject = 'Welcome to OrgOS';
  const bodyText = `Welcome to OrgOS

Your onboarding has been scheduled.

Event
Employee Orientation

Open Calendar
${eventUrl}

GitHub invitation has been sent.

Regards
OrgOS`;

  const messageParts = [
    `To: ${employeeEmail}`,
    'Subject: ' + subject,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    bodyText,
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return response.data;
}
