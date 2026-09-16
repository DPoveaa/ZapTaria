import { describe, it, expect } from 'vitest';
import { AIDecisionContractSchema } from '../services/ai/AIProvider.js';
import { MockAIProvider } from '../services/ai/MockAIProvider.js';

describe('AI Provider & Zod Decision Schema', () => {
  it('should validate valid structured AI decision JSON', () => {
    const validJson = {
      decision: 'SEND_MESSAGE',
      taskStatus: 'ACTIVE',
      reply: 'Hello! Do you have the document?',
      confidence: 0.92,
      goalProgress: 0.4,
      reason: 'Initiating follow-up question',
      nextAction: 'SEND_MESSAGE',
      nextActionAt: null
    };

    const parsed = AIDecisionContractSchema.parse(validJson);
    expect(parsed.decision).toBe('SEND_MESSAGE');
    expect(parsed.confidence).toBe(0.92);
  });

  it('should throw error on invalid decision type', () => {
    const invalidJson = {
      decision: 'INVALID_DECISION',
      taskStatus: 'ACTIVE',
      confidence: 0.5,
      goalProgress: 0.1,
      reason: 'test',
      nextAction: 'NONE'
    };

    expect(() => AIDecisionContractSchema.parse(invalidJson)).toThrow();
  });

  it('should evaluate conversation using MockAIProvider', async () => {
    const mockProvider = new MockAIProvider();
    const result = await mockProvider.evaluateConversation({
      taskObjective: 'Get ANVISA document',
      currentTaskState: 'ACTIVE',
      currentDateTime: new Date().toISOString(),
      conversationHistory: [],
      latestMessage: {
        body: 'Yes, here is the document',
        senderType: 'CONTACT'
      }
    });

    expect(result.decision).toBe('COMPLETE');
    expect(result.taskStatus).toBe('COMPLETED');
    expect(result.goalProgress).toBe(1.0);
  });
});
