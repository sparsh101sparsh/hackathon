import { google } from 'googleapis';
import { getOAuthClient } from '../auth';

export async function createOrientationEvent(
  employeeName: string, 
  startTime: string, 
  endTime: string
) {
  const auth = await getOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: `Employee Orientation`, // Based on user rewrite "Event: Employee Orientation"
    description: `Welcome to OrgOS! This is your onboarding session for ${employeeName}.`,
    start: {
      dateTime: startTime,
    },
    end: {
      dateTime: endTime,
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return {
    eventId: response.data.id,
    eventUrl: response.data.htmlLink,
    startTime: response.data.start?.dateTime,
    endTime: response.data.end?.dateTime,
  };
}
