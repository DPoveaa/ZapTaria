import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptKey, calculateKeyFingerprint, extractLast4 } from '../src/services/security/crypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@zaptaria.io' },
    update: {},
    create: {
      email: 'admin@zaptaria.io',
      name: 'Admin ZapTaria',
      passwordHash,
      role: 'ADMIN'
    }
  });

  // Create WhatsApp Session
  const session = await prisma.whatsAppSession.upsert({
    where: { sessionName: 'default_session' },
    update: { status: 'CONNECTED' },
    create: {
      name: 'Primary WhatsApp Connection',
      sessionName: 'default_session',
      status: 'CONNECTED',
      phoneNumber: '5511999999999',
      connectedAt: new Date()
    }
  });

  // Create Demo Contact
  const contact = await prisma.contact.upsert({
    where: { whatsappId: '5511988887777@c.us' },
    update: {},
    create: {
      whatsappId: '5511988887777@c.us',
      phoneNumber: '5511988887777',
      name: 'Supplier Bravus Tech',
      pushName: 'Bravus Support',
      notes: 'Key medical equipment supplier'
    }
  });

  // Create Conversation
  const conversation = await prisma.conversation.upsert({
    where: { whatsappChatId: contact.whatsappId },
    update: {},
    create: {
      whatsappSessionId: session.id,
      contactId: contact.id,
      whatsappChatId: contact.whatsappId,
      autonomousMode: true,
      summary: 'Contact confirmed they have ANVISA documents and will send them.'
    }
  });

  // Create Messages
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        whatsappMessageId: 'demo_msg_1',
        direction: 'OUTBOUND',
        senderType: 'AI',
        body: 'Hello! Could you please confirm if you have the ANVISA documents for the Bravus product?',
        timestamp: new Date(Date.now() - 3600000)
      },
      {
        conversationId: conversation.id,
        whatsappMessageId: 'demo_msg_2',
        direction: 'INBOUND',
        senderType: 'CONTACT',
        body: 'Yes, we have them. I will check with regulatory and send them over tomorrow morning.',
        timestamp: new Date(Date.now() - 1800000)
      }
    ],
    skipDuplicates: true
  });

  // Create Demo Task
  const task = await prisma.task.create({
    data: {
      contactId: contact.id,
      conversationId: conversation.id,
      title: 'Bravus ANVISA Documents Retrieval',
      objective: 'Ask supplier whether they have the ANVISA documents for Bravus product. Request documents if available.',
      successCriteria: 'Contact provides or sends valid ANVISA documents.',
      failureCriteria: 'Contact explicitly states documents do not exist or cannot be provided.',
      status: 'WAITING_FOR_CONTACT',
      autonomyLevel: 'FULL_AUTO',
      priority: 'HIGH',
      maxMessages: 10
    }
  });

  // Create Demo Gemini Key
  const rawDemoKey = 'AIzaSyDemoKeyForOfflineTesting123456';
  const encrypted = encryptKey(rawDemoKey);
  const fingerprint = calculateKeyFingerprint(rawDemoKey);
  const last4 = extractLast4(rawDemoKey);

  await prisma.geminiKey.upsert({
    where: { keyFingerprint: fingerprint },
    update: {},
    create: {
      name: 'Demo Primary Key',
      encryptedKey: encrypted,
      keyFingerprint: fingerprint,
      last4,
      status: 'ACTIVE',
      requestCount: 42
    }
  });

  // Create Audit Log
  await prisma.auditLog.create({
    data: {
      taskId: task.id,
      conversationId: conversation.id,
      action: 'AI_DECISION',
      decision: 'WAIT',
      reason: 'Contact stated they will verify and send documents tomorrow.',
      confidence: 0.94
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
