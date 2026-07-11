# Goal: Engineering Agent - Calendar and Email Integration

Implement an isolated module for the Engineering Agent that schedules Google Calendar orientation events, sends a welcome email via Gmail API, and prepares a Notion-ready update.

**Crucial Directive:** The PM Agent owns the onboarding schedule. The Engineering Agent must not decide the orientation schedule. It only executes the plan by creating the calendar event and sending the welcome email.

## Architecture

```
PM Agent
   ↓ (Onboarding Schedule)
Engineering Agent (agent.ts)
   ↓
   ├──> calendarService.ts  ---> Google Calendar API (Create Event, returns eventUrl)
   ↓
   └──> mailService.ts      ---> Gmail API (Sends Welcome Email with eventUrl)
   ↓
Notion Update (Returns status object)
```

## Proposed Changes

### Isolated Module (`calendarandemail`)

#### [NEW] `calendarandemail/package.json`
- Independent `package.json` to manage `googleapis` and `dotenv`. No `nodemailer`.

#### [NEW] `calendarandemail/services/calendarService.ts`
- **Responsibilities**:
  - Authenticate using full OAuth2 (`googleapis`).
  - Create a standard Google Calendar onboarding event (NO Google Meet conference by default).
  - Return `eventId`, `eventUrl` (htmlLink), `startTime`, and `endTime`.

#### [NEW] `calendarandemail/services/mailService.ts`
- **Responsibilities**:
  - Authenticate using full OAuth2 (`googleapis`).
  - Send Welcome Email using the Gmail API.
  - Body will contain:
    ```
    Welcome to OrgOS
    Your onboarding has been scheduled.
    Event: Employee Orientation
    Open Calendar: [eventUrl]
    GitHub invitation has been sent.
    Regards,
    OrgOS
    ```

#### [NEW] `calendarandemail/agent.ts`
- **Responsibilities**:
  1. Input: PM Plan (extract orientation date/time).
  2. Call `calendarService.ts` to create the event and receive `eventUrl`.
  3. Call `mailService.ts` to send the email.
  4. Return the Notion update object:
     ```json
     {
       "GitHub Invite": true,
       "Calendar Event": true,
       "Calendar URL": "https://calendar.google.com/...",
       "Email Sent": true,
       "Status": "Completed"
     }
     ```

#### [NEW] `calendarandemail/auth.ts`
- A utility script to perform the initial OAuth2 flow (generates auth URL, accepts code, and saves `token.json`) so we have a real OAuth implementation.

## Verification Plan
- Run `auth.ts` to authenticate with a real Google account.
- Run `agent.ts` with a mock PM plan.
- Verify the event appears in Google Calendar.
- Verify the email arrives in the inbox.
- Verify the JSON output matches the requested Notion update format.
