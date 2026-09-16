import { AIProvider, AIProviderContext, AIDecisionContract } from './AIProvider.js';

export class MockAIProvider implements AIProvider {
  public name = 'MockAIProvider';
  private mockResponses: AIDecisionContract[] = [];

  public setMockResponse(response: AIDecisionContract) {
    this.mockResponses.push(response);
  }

  public async evaluateConversation(context: AIProviderContext): Promise<AIDecisionContract> {
    if (this.mockResponses.length > 0) {
      return this.mockResponses.shift()!;
    }

    const latest = context.latestMessage?.body?.toLowerCase() || '';

    if (latest.includes('yes') || latest.includes('here') || latest.includes('document')) {
      return {
        decision: 'COMPLETE',
        taskStatus: 'COMPLETED',
        reply: 'Thank you very much for sending the documents!',
        confidence: 0.98,
        goalProgress: 1.0,
        reason: 'Contact confirmed and provided the requested document.',
        nextAction: 'FINISH',
        nextActionAt: null,
      };
    }

    if (latest.includes('no') || latest.includes('don\'t have') || latest.includes('cannot')) {
      return {
        decision: 'FAIL',
        taskStatus: 'FAILED',
        reply: 'Thank you for informing us.',
        confidence: 0.95,
        goalProgress: 0.0,
        reason: 'Contact stated they do not have the requested items.',
        nextAction: 'FINISH',
        nextActionAt: null,
      };
    }

    if (latest.includes('wait') || latest.includes('check') || latest.includes('tomorrow')) {
      return {
        decision: 'WAIT',
        taskStatus: 'WAITING_FOR_CONTACT',
        reply: 'Sure, take your time and let us know.',
        confidence: 0.9,
        goalProgress: 0.5,
        reason: 'Contact requested time to check.',
        nextAction: 'WAIT',
        nextActionAt: new Date(Date.now() + 86400000).toISOString(),
      };
    }

    return {
      decision: 'SEND_MESSAGE',
      taskStatus: 'ACTIVE',
      reply: 'Hello! Following up regarding the request.',
      confidence: 0.85,
      goalProgress: 0.3,
      reason: 'General inquiry continuation.',
      nextAction: 'SEND_MESSAGE',
      nextActionAt: null,
    };
  }

  public async generateObjectiveCriteria(objective: string): Promise<{ successCriteria: string; failureCriteria: string }> {
    return {
      successCriteria: `Successfully achieved objective: ${objective}`,
      failureCriteria: `Failed or contact refused objective: ${objective}`,
    };
  }
}
