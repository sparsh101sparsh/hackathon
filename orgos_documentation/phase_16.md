# Phase 16: Google Calendar Orientation Event Scheduler

## 1. Scope & System Overview
The Google Calendar Orientation Event Scheduler is responsible for automatically scheduling onboarding/orientation sessions for newly ingested employees. This component integrates with the Google Calendar API (v3) to create public calendar events on the primary calendar of the onboarding service account, invite the new employee, and return metadata including the direct URL of the event to log into the Notion database and notify the employee via email.

---

## 2. Key Source Files
- `calendarandemail/services/calendarService.ts` - Local calendar helper module.
- `org-os-notion/server/src/services/googleService.ts` - Main orchestration google integration service containing OAuth, calendar, and email logic.

---

## 3. Detailed Component Architecture & Technical Content

### 3.1. Google Calendar v3 Client Setup
The client utilizes the official `googleapis` package to establish a connection. Authentication is managed through OAuth2 by extracting client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and a refresh token from the environment variables or a token file.

#### OAuth2 Client Generator Signature (`googleService.ts`)
```typescript
async function getOAuthClient(): Promise<OAuth2Client>
```
- **Inputs**: Read from process environment variables:
  - `GOOGLE_CLIENT_ID` (Required)
  - `GOOGLE_CLIENT_SECRET` (Required)
  - `GOOGLE_REDIRECT_URI` (Defaults to `'http://localhost'`)
  - `GOOGLE_REFRESH_TOKEN` (Optional, fallback to token file)
- **Token Fallback File**: `/Users/iamsparsh00321/Desktop/cognitivehackathon/calendarandemail/token.json`
- **Output**: An authenticated instance of `google.auth.OAuth2`.

#### Calendar Client Instantiation
```typescript
const auth = await getOAuthClient();
const calendar = google.calendar({ version: 'v3', auth });
```

---

### 3.2. Next Monday Time Window Calculator
To schedule the orientation event dynamically, the system schedules it for the **next upcoming Monday at 10:00 AM local time** for a duration of exactly **1 hour** (until 11:00 AM).

#### Mathematical Logic for Monday Offset
Let $D_{\text{now}}$ be the current day of the week (where 0 is Sunday, 1 is Monday, ..., 6 is Saturday).
The number of days until the next Monday is computed as:
$$\text{daysUntilMonday} = \begin{cases} 1 & \text{if } D_{\text{now}} = 0 \text{ (Sunday)} \\ 8 - D_{\text{now}} & \text{otherwise} \end{cases}$$

#### Implementation Code (`googleService.ts`)
```typescript
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
```

---

### 3.3. Event Configuration & Summary Options
When constructing the calendar event payload, specific metadata options are enforced to align with company branding and ensure proper notifications are dispatched.

#### Event Payload Schema
- **`summary`**: Set to `'Employee Orientation'`
- **`description`**: Welcome message string: `"Welcome to OrgOS! This is your onboarding session for ${employeeName}."`
- **`start.dateTime`**: ISO 8601 string calculated by `getNextMonday(10).start`.
- **`end.dateTime`**: ISO 8601 string calculated by `getNextMonday(10).end`.
- **`visibility`**: Configured as `'public'` to permit viewing by external team members.
- **`attendees`**: Array containing `{ email: employeeEmail }` if the employee's email is specified.

---

### 3.4. Event Insertion Request Details
The insertion operation uses the calendar API’s `insert` method with the following details:
```typescript
const response = await calendar.events.insert({
  calendarId: 'primary',
  requestBody: event,
  sendUpdates: 'all',
});
```
- **`calendarId`**: `'primary'` maps to the main calendar associated with the authorized user account.
- **`sendUpdates`**: `'all'` forces Google Calendar to send notification emails immediately to all attendees (including the newly onboarded employee).

#### Returned Data Struct
Upon success, the scheduler extracts and returns:
- `eventId`: Direct Google identifier string (`response.data.id`).
- `eventUrl`: HTML web browser view URL (`response.data.htmlLink`).
- `startTime`: Confirmed event start date-time string.
- `endTime`: Confirmed event end date-time string.

---

### 3.5. Public Event Sharing Constraints
> ⚠️ **CRITICAL REQUIREMENT:**
> To allow non-attendees (e.g., HR managers or administrators) to inspect the event details via the generated `eventUrl` (htmlLink), the target Google Calendar itself must have its sharing permissions modified.
> 
> **Resolution Path:**
> Navigate to Google Calendar Settings -> Settings for my calendars -> Access permissions for events -> Check "Make available to public". If this permission is omitted, the link will redirect non-invited visitors to an HTTP 404/403 Access Denied screen.
> The server outputs a console warning about this constraint when executing:
> `console.warn("[GoogleService] Note: To allow public access via event links, ensure the primary Google Calendar is set to \"Make available to public\" in Calendar Settings.");`

---

## 4. Flowchart (Sequence of Operations)

```
[System Ingestion]
       │
       ▼
[Calculate Target Window] ──► Call getNextMonday(10)
       │                      - Computes start/end times in ISO strings
       │
       ▼
[Retrieve OAuth Client] ────► Loads Client ID, Secret & Refresh Token
       │
       ▼
[Build Event Request] ──────► Combines Employee Name, times, and public visibility
       │                      - Adds attendee if email provided
       │
       ▼
[API Event Insertion] ──────► calendar.events.insert() with sendUpdates: 'all'
       │
       ▼
[Extract Metadata] ─────────► Extracts ID & htmlLink
       │
       ▼
[Return Response] ──────────► Feeds URL to Mail & Notion Databases
```
