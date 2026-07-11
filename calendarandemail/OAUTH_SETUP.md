# Google OAuth 2.0 Setup Guide

To use the Google Calendar and Gmail APIs, you need to configure OAuth 2.0 credentials in the Google Cloud Console. Follow these steps:

## 1. Create a Project and Enable APIs
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `OrgOS-Hackathon`).
3. In the sidebar, navigate to **APIs & Services > Library**.
4. Search for and enable the **Google Calendar API**.
5. Search for and enable the **Gmail API**.

## 2. Configure the OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** (or Internal if using a Google Workspace account) and click **Create**.
3. Fill in the required fields (App name: `OrgOS`, User support email, Developer contact information) and click **Save and Continue**.
4. In the Scopes section, click **Add or Remove Scopes**.
5. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/gmail.send`
6. Click **Save and Continue**.
7. If your app is "External" and in "Testing" mode, add your own email address under **Test users**.

## 3. Create OAuth Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Desktop app** (or **Web application** with redirect URI `http://localhost`). 
   *(Note: The `auth.ts` script defaults to `urn:ietf:wg:oauth:2.0:oob` for terminal copy-paste, which requires "Desktop app" or "Web application" configured correctly depending on Google's current strictness. Using `http://localhost` as the redirect URI in the console and `.env` is recommended.)*
4. Name it (e.g., `OrgOS CLI Client`) and click **Create**.
5. You will see your **Client ID** and **Client Secret**.

## 4. Set Environment Variables
Copy `.env.example` to `.env` in this directory and add your credentials:
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost
```

## 5. Authenticate
Run the setup script:
```bash
npx ts-node auth.ts
```
1. Click the link printed in the terminal.
2. Sign in with your test user Google account and approve the permissions.
3. If using `http://localhost`, you may be redirected to a broken page like `http://localhost/?code=4/0A...`. Copy the value of the `code` parameter from the URL.
4. Paste the code back into the terminal.
5. A `token.json` file will be generated. You're ready to go!
