import { google } from 'googleapis';
import * as fs from 'fs';

// Hardcoded absolute path to token.json in the calendarandemail folder
const TOKEN_PATH = '/Users/iamsparsh00321/Desktop/cognitivehackathon/calendarandemail/token.json';

async function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (process.env.GOOGLE_REFRESH_TOKEN) {
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  } else if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH, 'utf-8');
    oAuth2Client.setCredentials(JSON.parse(token));
  } else {
    throw new Error(
      `Token not found. Please set GOOGLE_REFRESH_TOKEN or ensure token.json exists.`
    );
  }

  return oAuth2Client;
}

/** Returns the date of next Monday at the given hour (local time, ISO string) */
function getNextMonday(hour: number = 10): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(hour, 0, 0, 0);

  const endMonday = new Date(nextMonday);
  endMonday.setHours(hour + 1, 0, 0, 0);

  return {
    start: nextMonday.toISOString(),
    end: endMonday.toISOString(),
  };
}

export const googleService = {
  /**
   * Creates a Google Calendar orientation event starting next Monday at 10AM for 1 hour.
   * 
   * PREREQUISITE:
   * To allow non-attendees to view this event via the generated link, the Google Calendar
   * itself must be configured as publicly shared:
   * Settings -> Access permissions -> "Make available to public"
   */
  async createOrientationEvent(employeeName: string, employeeEmail?: string): Promise<{
    eventId: string | null | undefined;
    eventUrl: string | null | undefined;
    startTime: string | null | undefined;
    endTime: string | null | undefined;
  }> {
    // Ensure developers know the calendar level setting required for the event visibility to actually work.
    console.warn(`[GoogleService] Note: To allow public access via event links, ensure the primary Google Calendar is set to "Make available to public" in Calendar Settings.`);

    const auth = await getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const { start, end } = getNextMonday(10);

    const event: any = {
      summary: 'Employee Orientation',
      description: `Welcome to OrgOS! This is your onboarding session for ${employeeName}.`,
      start: { dateTime: start },
      end: { dateTime: end },
      visibility: 'public',
    };

    if (employeeEmail) {
      event.attendees = [{ email: employeeEmail }];
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });

    return {
      eventId: response.data.id,
      eventUrl: response.data.htmlLink,
      startTime: response.data.start?.dateTime,
      endTime: response.data.end?.dateTime,
    };
  },

  /**
   * Sends an HTML welcome email via Gmail with calendar event link and optionally the GitHub issue link.
   */
  async sendWelcomeEmail(
    employeeEmail: string,
    employeeName: string,
    eventUrl: string,
    issueUrl?: string
  ): Promise<void> {
    const auth = await getOAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const subject = `Welcome to OrgOS, ${employeeName}!`;

    const issueSection = issueUrl
      ? `<p>📋 <strong>Onboarding Issue:</strong> <a href="${issueUrl}">${issueUrl}</a></p>`
      : '';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0;">Welcome to OrgOS 🎉</h1>
  </div>
  <div style="background: #f9fafb; padding: 32px; border-radius: 0 0 12px 12px;">
    <p>Hi <strong>${employeeName}</strong>,</p>
    <p>We're thrilled to have you on board! Your onboarding has been set up and is ready to go.</p>
    
    <div style="background: white; border-left: 4px solid #6366f1; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 12px;">📅 Orientation Session Scheduled</h3>
      <p style="margin: 0;"><a href="${eventUrl}" style="color: #6366f1; font-weight: bold;">Open Calendar Event →</a></p>
    </div>

    ${issueSection}

    <p>Your GitHub organization invitation has been sent. Please check your email to accept it.</p>
    
    <p>If you have any questions, feel free to reach out to the team.</p>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
      Regards,<br>
      <strong>OrgOS Onboarding System</strong>
    </p>
  </div>
</body>
</html>`;

    const messageParts = [
      `To: ${employeeEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlBody,
    ];

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
  },
};
