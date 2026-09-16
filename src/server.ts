import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, TaskStatus, AutonomyLevel } from '@prisma/client';
import { GeminiKeyPoolManager } from './services/ai/GeminiKeyPoolManager.js';
import { MockAIProvider } from './services/ai/MockAIProvider.js';
import { GeminiProvider } from './services/ai/GeminiProvider.js';
import { MockWhatsAppProvider } from './services/whatsapp/MockWhatsAppProvider.js';
import { TaskEngine } from './services/engine/TaskEngine.js';
import { TaskStateMachine } from './services/engine/TaskStateMachine.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.SESSION_SECRET || 'fallback-secret-key';

// Global Key Pool Manager & Providers
const keyPool = new GeminiKeyPoolManager('ROUND_ROBIN');
const mockAiProvider = new MockAIProvider();
const whatsappProvider = new MockWhatsAppProvider();

// Helper to get active AI provider
function getAIProvider() {
  const activeKey = keyPool.getNextActiveKey();
  if (activeKey) {
    return new GeminiProvider(keyPool);
  }
  return mockAiProvider;
}

// Global Emergency Stop state helper
async function getGlobalEmergencyStop(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'GLOBAL_EMERGENCY_STOP' } });
  return setting?.value === 'true';
}

// Instantiate Task Engine
const taskEngine = new TaskEngine({
  aiProvider: getAIProvider(),
  whatsappProvider: whatsappProvider,
  getTaskById: async (taskId: string) => {
    const dbTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { conversation: true, contact: true }
    });
    if (!dbTask) return null;
    return {
      id: dbTask.id,
      contactId: dbTask.contactId,
      conversationId: dbTask.conversationId,
      title: dbTask.title,
      objective: dbTask.objective,
      successCriteria: dbTask.successCriteria,
      failureCriteria: dbTask.failureCriteria,
      constraints: dbTask.constraints,
      status: dbTask.status,
      autonomyLevel: dbTask.autonomyLevel,
      maxMessages: dbTask.maxMessages,
      messageCount: dbTask.messageCount,
      deadlineAt: dbTask.deadlineAt,
      conversationSummary: dbTask.conversation?.summary,
      humanTakeover: dbTask.conversation?.autonomousMode === false,
      whatsappChatId: dbTask.conversation?.whatsappChatId || dbTask.contact.whatsappId
    };
  },
  updateTaskStatus: async (taskId: string, status: TaskStatus, updates?: any) => {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        ...(updates?.messageCount !== undefined ? { messageCount: updates.messageCount } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {})
      }
    });
    io.emit('task:updated', { taskId, status });
  },
  getConversationMessages: async (chatId: string) => {
    const conversation = await prisma.conversation.findUnique({
      where: { whatsappChatId: chatId },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });
    if (!conversation) return [];
    return conversation.messages.map(m => ({
      senderType: m.senderType as any,
      body: m.body,
      timestamp: m.timestamp,
      hasMedia: m.hasMedia,
      mediaType: m.mediaType
    }));
  },
  saveMessage: async (chatId: string, senderType: 'AI' | 'USER' | 'CONTACT', body: string) => {
    let conversation = await prisma.conversation.findUnique({ where: { whatsappChatId: chatId } });
    if (!conversation) return;

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        whatsappMessageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        direction: senderType === 'CONTACT' ? 'INBOUND' : 'OUTBOUND',
        senderType: senderType,
        body,
        timestamp: new Date()
      }
    });
    io.emit('message:new', { conversationId: conversation.id, body, senderType });
  },
  logAudit: async (taskId: string, action: string, decision: string, reason: string) => {
    await prisma.auditLog.create({
      data: {
        taskId,
        action,
        decision,
        reason,
        createdAt: new Date()
      }
    });
    io.emit('activity:logged', { taskId, action, decision, reason });
  },
  getGlobalEmergencyStop
});

// Setup mock WhatsApp event handlers
whatsappProvider.connectSession('default_session', {
  onSessionStatusChange: (status, qrCode) => {
    io.emit('whatsapp:status', { status, qrCode });
  },
  onIncomingMessage: async (msg) => {
    let contact = await prisma.contact.findUnique({ where: { whatsappId: msg.chatId } });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          whatsappId: msg.chatId,
          phoneNumber: msg.chatId.split('@')[0],
          name: 'Contact ' + msg.chatId.split('@')[0]
        }
      });
    }

    let session = await prisma.whatsAppSession.findFirst();
    if (!session) {
      session = await prisma.whatsAppSession.create({
        data: { name: 'Default Session', sessionName: 'default_session', status: 'CONNECTED' }
      });
    }

    let conversation = await prisma.conversation.findUnique({ where: { whatsappChatId: msg.chatId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          whatsappSessionId: session.id,
          contactId: contact.id,
          whatsappChatId: msg.chatId,
          lastMessageAt: msg.timestamp
        }
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        whatsappMessageId: msg.id,
        direction: 'INBOUND',
        senderType: 'CONTACT',
        body: msg.body,
        timestamp: msg.timestamp
      }
    });

    // Check for active autonomous task
    const activeTask = await prisma.task.findFirst({
      where: {
        contactId: contact.id,
        status: { in: ['ACTIVE', 'WAITING_FOR_CONTACT'] }
      }
    });

    if (activeTask && conversation.autonomousMode) {
      await taskEngine.processInboundMessage(activeTask.id, {
        senderType: 'CONTACT',
        body: msg.body,
        timestamp: msg.timestamp,
        hasMedia: msg.hasMedia,
        mediaType: msg.mediaType
      });
    }
  }
});

// Auth middleware
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Invalid token' });
  }
};

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// Dashboard Route
app.get('/api/dashboard', authenticate, async (req, res) => {
  const activeTasks = await prisma.task.count({ where: { status: 'ACTIVE' } });
  const waitingTasks = await prisma.task.count({ where: { status: { in: ['WAITING_FOR_CONTACT', 'WAITING_FOR_USER'] } } });
  const completedToday = await prisma.task.count({
    where: {
      status: 'COMPLETED',
      completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    }
  });
  const humanAttention = await prisma.task.count({ where: { status: 'HUMAN_REQUIRED' } });
  const emergencyStop = await getGlobalEmergencyStop();

  res.json({
    activeTasks,
    waitingTasks,
    completedToday,
    humanAttention,
    globalEmergencyStop: emergencyStop,
    keyPoolActiveCount: keyPool.listMaskedKeys().filter(k => k.status === 'ACTIVE').length,
  });
});

// Task Routes
app.get('/api/tasks', authenticate, async (req, res) => {
  const tasks = await prisma.task.findMany({
    include: { contact: true, conversation: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(tasks);
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { contactId, title, objective, successCriteria, failureCriteria, autonomyLevel, priority, maxMessages } = req.body;

  let contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    return res.status(400).json({ error: 'Contact not found' });
  }

  let conversation = await prisma.conversation.findFirst({ where: { contactId: contact.id } });
  if (!conversation) {
    let session = await prisma.whatsAppSession.findFirst();
    if (!session) {
      session = await prisma.whatsAppSession.create({
        data: { name: 'Default Session', sessionName: 'default_session', status: 'CONNECTED' }
      });
    }
    conversation = await prisma.conversation.create({
      data: {
        whatsappSessionId: session.id,
        contactId: contact.id,
        whatsappChatId: contact.whatsappId
      }
    });
  }

  const task = await prisma.task.create({
    data: {
      contactId: contact.id,
      conversationId: conversation.id,
      title,
      objective,
      successCriteria,
      failureCriteria,
      autonomyLevel: autonomyLevel || 'FULL_AUTO',
      priority: priority || 'MEDIUM',
      maxMessages: maxMessages || 10,
      status: 'ACTIVE'
    }
  });

  io.emit('task:created', task);
  res.status(201).json(task);
});

app.post('/api/tasks/:id/takeover', authenticate, async (req, res) => {
  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || !task.conversationId) return res.status(404).json({ error: 'Task not found' });

  await prisma.conversation.update({
    where: { id: task.conversationId },
    data: { autonomousMode: false }
  });

  await prisma.task.update({
    where: { id },
    data: { status: 'HUMAN_REQUIRED' }
  });

  io.emit('task:updated', { taskId: id, status: 'HUMAN_REQUIRED' });
  res.json({ message: 'Human takeover activated successfully' });
});

app.post('/api/tasks/:id/resume-ai', authenticate, async (req, res) => {
  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || !task.conversationId) return res.status(404).json({ error: 'Task not found' });

  await prisma.conversation.update({
    where: { id: task.conversationId },
    data: { autonomousMode: true }
  });

  await prisma.task.update({
    where: { id },
    data: { status: 'ACTIVE' }
  });

  io.emit('task:updated', { taskId: id, status: 'ACTIVE' });
  res.json({ message: 'Returned control to AI' });
});

// Gemini Key Pool Routes
app.get('/api/gemini/keys', authenticate, (req, res) => {
  res.json(keyPool.listMaskedKeys());
});

app.post('/api/gemini/keys', authenticate, (req, res) => {
  const { key, name } = req.body;
  const result = keyPool.addKeyInMemory(key, name);
  if (!result.success) {
    if (result.duplicate) return res.status(400).json({ error: 'DUPLICATE_KEY: Key already exists in pool' });
    return res.status(400).json({ error: 'Invalid key submitted' });
  }
  res.status(201).json(result.key);
});

app.post('/api/gemini/keys/bulk', authenticate, (req, res) => {
  const { bulkText } = req.body;
  const result = keyPool.addBulkKeysInMemory(bulkText);
  res.json(result);
});

// Emergency Stop Toggle Route
app.post('/api/settings/emergency-stop', authenticate, async (req, res) => {
  const { enabled } = req.body;
  await prisma.systemSetting.upsert({
    where: { key: 'GLOBAL_EMERGENCY_STOP' },
    update: { value: String(enabled) },
    create: { key: 'GLOBAL_EMERGENCY_STOP', value: String(enabled), description: 'Global Emergency Stop Switch' }
  });
  io.emit('settings:emergency_stop', { enabled });
  res.json({ enabled });
});

// Audit Log Route
app.get('/api/activity', authenticate, async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: { task: true, conversation: true }
  });
  res.json(logs);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`ZapTaria Server listening on port ${PORT}`);
});

export { app, server, io };
