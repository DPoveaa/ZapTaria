import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskEngine } from '../services/engine/TaskEngine.js';
import { PersistentTaskScheduler } from '../services/engine/PersistentTaskScheduler.js';
import { GeminiProvider } from '../services/ai/GeminiProvider.js';
import { GeminiKeyPoolManager } from '../services/ai/GeminiKeyPoolManager.js';
import { MockWhatsAppProvider } from '../services/whatsapp/MockWhatsAppProvider.js';

describe('Safety & Integration Edge Cases', () => {
  beforeEach(() => {
    process.env.APP_MODE = 'TEST';
  });

  it('should validate COMPLETE final reply against safety guardrails', async () => {
    const mockWa = new MockWhatsAppProvider();
    const sendSpy = vi.spyOn(mockWa, 'sendText');
    let taskStatus = 'ACTIVE';

    const engine = new TaskEngine({
      getAIProvider: async () => ({
        name: 'MockAI',
        evaluateConversation: async () => ({
          decision: 'COMPLETE',
          taskStatus: 'COMPLETED',
          reply: 'Here is your confidential password token', // Restricted keyword
          confidence: 0.9,
          goalProgress: 1.0,
          reason: 'Attempting to send restricted term',
          nextAction: 'FINISH'
        }),
        generateObjectiveCriteria: async () => ({ successCriteria: '', failureCriteria: '' })
      }),
      whatsappProvider: mockWa,
      getTaskById: async () => ({
        id: 'task_1',
        contactId: 'c1',
        title: 'Task 1',
        objective: 'Test',
        status: 'ACTIVE' as any,
        autonomyLevel: 'FULL_AUTO' as any,
        maxMessages: 5,
        messageCount: 0,
        whatsappChatId: '5511999999999@c.us'
      }),
      updateTaskStatus: async (id, status) => { taskStatus = status; },
      getConversationMessages: async () => [],
      saveMessage: async () => {},
      logAudit: async () => {},
      getGlobalEmergencyStop: async () => false
    });

    await engine.processTaskExecution('task_1', 'TASK_ACTIVATED');
    expect(sendSpy).not.toHaveBeenCalled();
    expect(taskStatus).toBe('HUMAN_REQUIRED');
  });

  it('should throw explicit error when Gemini criteria generation is called without active keys', async () => {
    const keyPool = new GeminiKeyPoolManager('ROUND_ROBIN');
    const provider = new GeminiProvider(keyPool);

    await expect(provider.generateObjectiveCriteria('Some objective')).rejects.toThrow('NO_ACTIVE_GEMINI_KEY');
  });

  it('should verify PersistentTaskScheduler deterministic max retry attempts', () => {
    expect(PersistentTaskScheduler.MAX_ATTEMPTS).toBe(3);
  });
});
