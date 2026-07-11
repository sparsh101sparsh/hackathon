# Engineering Agent - Calendar and Email Module

This module isolates the Engineering Agent's responsibilities for the OrgOS Orchestrator. The primary goal is to securely authenticate with Google Workspace via OAuth 2.0, schedule employee orientation events via Google Calendar, and send welcome emails via Gmail API.

## Architecture

This module strictly adheres to the principle that the **PM Agent plans the schedule**, while the **Engineering Agent only executes it**. 

### Services
- **`services/calendarService.ts`**: Implements the `googleapis` Calendar v3 client to create a standard Google Calendar event. It extracts `eventId`, `eventUrl` (`htmlLink`), `startTime`, and `endTime`. No default Google Meet conference is created.
- **`services/mailService.ts`**: Implements the `googleapis` Gmail v1 client. It constructs a plaintext MIME email containing the orientation details and the calendar link, then sends it on behalf of the authenticated user.
- **`agent.ts`**: The main workflow execution file. It receives the onboarding plan containing the date and time, executes the calendar and email services sequentially, and returns a JSON object perfectly formatted for updating the Notion memory bus.

### Authentication (`auth.ts`)
The module uses a full, real OAuth 2.0 implementation without mocks. It requires a `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` configured in Google Cloud Console. Running `npx ts-node auth.ts` (or `npx tsc && node auth.js`) handles the OAuth callback and generates a persistent `token.json` file.

## Expected Notion Output Format

The `executeEngineeringAgent()` function returns the following object format, intended to be written directly to the OrgOS Notion database:

```json
{
  "GitHub Invite": true,
  "Calendar Event": true,
  "Calendar URL": "https://www.google.com/calendar/...",
  "Email Sent": true,
  "Status": "Completed"
}
```

---

## Test Execution Results

We verified the complete end-to-end flow using the local `test.ts` file. 
Below is the terminal output from a successful execution generating a real Google Calendar event and sending a real Gmail email:

```bash
$ npx tsc && node test.js

◇ injected env (3) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Engineering Agent started execution for: Sparsh
Creating calendar event...
Calendar event created: https://www.google.com/calendar/event?eid=bWl1YXQ0aHI1bGl0MGFuc3R1MDJpdmMydmMgaWFtc3BhcnNoZW1haWwwMkBt
Sending welcome email...
Welcome email sent.
Result: {
  "GitHub Invite": true,
  "Calendar Event": true,
  "Calendar URL": "https://www.google.com/calendar/event?eid=bWl1YXQ0aHI1bGl0MGFuc3R1MDJpdmMydmMgaWFtc3BhcnNoZW1haWwwMkBt",
  "Email Sent": true,
  "Status": "Completed"
}
```
