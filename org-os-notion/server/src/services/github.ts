import * as dotenv from 'dotenv';
import * as path from 'path';

if (!process.env.VITEST) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

const GITHUB_PAT = process.env.GITHUB_PAT || '';
const GITHUB_ORG = process.env.GITHUB_ORG || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const MOCK_GITHUB = process.env.MOCK_GITHUB === 'true' || !GITHUB_PAT;

let issueCallCount = 0;

export const githubService = {
  async verifyUsername(username: string): Promise<number> {
    if (MOCK_GITHUB) {
      const lower = username.toLowerCase();
      if (lower.includes('fail') || lower.includes('invalid') || lower === 'nonexistent') {
        throw new Error(`GitHub user "${username}" not found (Mock)`);
      }
      // Simple hash to return a stable numeric ID
      const userId = [...username].reduce((acc, char) => acc + char.charCodeAt(0), 0) + 100000;
      return userId;
    }

    const url = `https://api.github.com/users/${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'OrgOS-Agent'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`GitHub username "${username}" does not exist`);
      }
      throw new Error(`GitHub username verification failed with status: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (typeof data.id !== 'number') {
      throw new Error('Invalid response from GitHub API: missing user ID');
    }

    return data.id;
  },

  async inviteToOrg(userId: number): Promise<void> {
    if (MOCK_GITHUB) {
      return;
    }

    const url = `https://api.github.com/orgs/${encodeURIComponent(GITHUB_ORG)}/invitations`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'OrgOS-Agent',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invitee_id: userId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub organization invitation failed with status ${response.status}: ${errorText}`);
    }
  },

  async createOnboardingIssue(employeeName: string, githubUsername: string): Promise<{ number: number }> {
    if (MOCK_GITHUB) {
      const lowerName = employeeName.toLowerCase();
      const lowerUsername = githubUsername.toLowerCase();

      if (lowerName.includes('fail_once') || lowerUsername.includes('fail_once')) {
        issueCallCount++;
        if (issueCallCount % 2 === 1) {
          throw new Error('Mock: temporary issue creation failure (should succeed on retry)');
        }
      } else if (lowerName.includes('fail') || lowerUsername.includes('fail')) {
        throw new Error('Mock: persistent issue creation failure');
      }

      return { number: 42 + Math.floor(Math.random() * 1000) };
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(GITHUB_ORG)}/${encodeURIComponent(GITHUB_REPO)}/issues`;
    const body = `Onboarding checklist for ${employeeName} (@${githubUsername}):

- [ ] Accept GitHub Invitation
- [ ] Clone Starter Repository
- [ ] Install VS Code
- [ ] Configure SSH Keys
- [ ] Setup Local Environment
- [ ] Complete Security Training`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'OrgOS-Agent',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Onboard ${employeeName}`,
        body: body
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub onboarding issue creation failed with status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    if (typeof data.number !== 'number') {
      throw new Error('Invalid response from GitHub API: missing issue number');
    }

    return { number: data.number };
  }
};
