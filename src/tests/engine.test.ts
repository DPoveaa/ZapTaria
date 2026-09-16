import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStateMachine } from '../services/engine/TaskStateMachine.js';
import { SafetyGuardrails } from '../services/engine/SafetyGuardrails.js';
import { TaskEngine, TaskRecord } from '../services/engine/TaskEngine.js';
import { MockAIProvider } from '../services/ai/MockAIProvider.js';
import { MockWhatsAppProvider } from '../services/whatsapp/MockWhatsAppProvider.js';

describe('Task Engine & State Machine Suite', () => {
  it('should validate allowed state transitions', () => {
    expect(TaskStateMachine.isValidTransition('DRAFT', 'SCHEDULED')).toBe(true);
    expect(TaskStateMachine.isValidTransition('SCHEDULED', 'ACTIVE')).toBe(true);
    expect(TaskStateMachine.isValidTransition('ACTIVE', 'WAITING_FOR_CONTACT')).toBe(true);
    expect(TaskStateMachine.isValidTransition('COMPLETED', 'ACTIVE')).toBe(false);
  });

  it('should enforce safety limits on max messages', () => {
    const safety = SafetyGuardrails.validateOutgoingAction({
      taskStatus: 'ACTIVE',
      autonomyLevel: 'FULL_AUTO',
      messageCount: 10,
      maxMessages: 10,
    });

    expect(safety.isSafe).toBe(false);
    expect(safety.reason).toContain('MAX_MESSAGES_REACHED');
  });

  it('should process inbound message and transition task to COMPLETED when AI decides COMPLETE', async () => {
    const aiProvider = new MockAIProvider();
    const whatsappProvider = new MockWhatsAppProvider();
    await whatsappProvider.connectSession('test');

    let currentStatus: any = 'ACTIVE';
    let messageCount = 1;

    const taskRecord: TaskRecord = {
      id: 'task_1',
      contactId: 'contact_1',
      whatsappChatId: '5511999999999@c.us',
      title: 'Get Bravus ANVISA',
      objective: 'Ask supplier for document',
      status: 'ACTIVE',
      autonomyLevel: 'FULL_AUTO',
      maxMessages: 10,
      messageCount: 1,
    };

    const engine = new TaskEngine({
      aiProvider,
      whatsappProvider,
      getTaskById: async () => ({ ...taskRecord, status: currentStatus, messageCount }),
      updateTaskStatus: async (id, status, updates) => {
        currentStatus = status;
        if (updates?.messageCount !== undefined) messageCount = updates.messageCount;
      },
      getConversationMessages: async () => [],
      saveMessage: async () => {},
      logAudit: async () => {},
      getGlobalEmergencyStop: async () => false,
    });

    await engine.processInboundMessage('task_1', {
      senderType: 'CONTACT',
      body: 'Yes, here is the document',
      timestamp: new Date(),
    });

    expect(currentStatus).toBe('COMPLETED');
  });
});
