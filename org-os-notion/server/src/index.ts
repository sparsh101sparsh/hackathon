import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { startOnboarding, approveStep, getAllSessions } from './orchestrator';
import { getNotionData } from './notion';
import { appEvents } from './events';

// Load .env from monorepo root (one level above server/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// List of connected SSE clients
let sseClients: any[] = [];

// Helper to broadcast event to all SSE clients
export function broadcastEvent(event: string, data: any) {
  sseClients.forEach((client) => {
    client.res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
  });
}

// Subscribe to system-wide events and broadcast them to all SSE clients
appEvents.on('event', ({ event, data }) => {
  broadcastEvent(event, data);
});


// 1. Ingest Onboarding Request
app.post('/api/onboarding', async (req, res) => {
  const { name, role, department, salary, githubUsername, equipment, email } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required properties' });
  }

  try {
    const sessionId = await startOnboarding({
      employeeName: name,
      role,
      department: department || 'Engineering',
      salary: salary || 0,
      equipmentList: equipment || '',
      githubUsername: githubUsername || '',
      email: email || undefined,
    });

    broadcastEvent('session_created', { sessionId });
    return res.status(202).json({ success: true, sessionId });
  } catch (error: any) {
    console.error('Error starting onboarding:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 1b. E2E Onboarding Start alias/route
app.post('/api/onboarding/start', async (req, res) => {
  const { name, employeeName, role, department, salary, githubUsername, equipment, equipmentList, email } = req.body;
  
  const empName = employeeName || name;
  const empEquipment = equipmentList || equipment;

  if (!empName || !role) {
    return res.status(400).json({ error: 'Name and role are required properties' });
  }

  try {
    const sessionId = await startOnboarding({
      employeeName: empName,
      role,
      department: department || 'Engineering',
      salary: salary || 0,
      equipmentList: empEquipment || '',
      githubUsername: githubUsername || '',
      email: email || undefined,
    });

    broadcastEvent('session_created', { sessionId });
    return res.status(202).json({ success: true, sessionId });
  } catch (error: any) {
    console.error('Error starting onboarding:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. Resolve Human Approval Gate
app.post('/api/approve', async (req, res) => {
  const { approvalId, action, reason, sessionId } = req.body;

  if (!sessionId || !action) {
    return res.status(400).json({ error: 'sessionId and action are required' });
  }

  try {
    await approveStep(sessionId, approvalId || 'default', action, reason);
    broadcastEvent('approval_resolved', { sessionId, action });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error resolving approval:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2b. GET Onboarding Sessions for E2E polling
app.get('/api/onboarding/sessions', async (req, res) => {
  try {
    const sessions = getAllSessions();
    return res.status(200).json(sessions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Fetch Notion company memory records with mock fallback
app.get('/api/notion-data', async (req, res) => {
  try {
    const data = await getNotionData();
    const activeSessions = getAllSessions();
    return res.status(200).json({
      mockData: data,
      notionData: data,
      activeSessions
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. SSE Stream for Real-Time UI updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };
  sseClients.push(newClient);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ event: 'connected', data: { clientId } })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 OrgOS Backend Server running on http://localhost:${PORT}`);
  console.log(`Notion mode: ${process.env.MOCK_NOTION === 'false' ? 'REAL' : 'MOCK (local filesystem)'}`);
});
