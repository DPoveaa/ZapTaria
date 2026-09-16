import { AIProviderContext } from '../ai/AIProvider.js';

export interface ContextMessage {
  senderType: 'CONTACT' | 'USER' | 'AI' | 'SYSTEM';
  body: string;
  timestamp: Date | string;
  hasMedia?: boolean;
  mediaType?: string | null;
}

export interface ContextTaskInput {
  title: string;
  objective: string;
  successCriteria?: string | null;
  failureCriteria?: string | null;
  constraints?: string | null;
  status: string;
}

export class ContextBuilder {
  private static MAX_MESSAGES = 15;

  public static buildContext(
    task: ContextTaskInput,
    conversationSummary: string | null,
    messages: ContextMessage[],
    latestInbound?: ContextMessage
  ): AIProviderContext {
    // Select recent relevant messages bounded by max limit
    const recentMessages = messages.slice(-this.MAX_MESSAGES).map(m => ({
      senderType: m.senderType,
      body: m.body,
      timestamp: m.timestamp,
      hasMedia: m.hasMedia,
      mediaType: m.mediaType,
    }));

    return {
      taskObjective: `${task.title}: ${task.objective}`,
      successCriteria: task.successCriteria,
      failureCriteria: task.failureCriteria,
      constraints: task.constraints,
      summary: conversationSummary,
      conversationHistory: recentMessages,
      latestMessage: latestInbound ? {
        senderType: latestInbound.senderType,
        body: latestInbound.body,
        hasMedia: latestInbound.hasMedia,
        mediaType: latestInbound.mediaType,
      } : undefined,
      currentTaskState: task.status,
      currentDateTime: new Date().toISOString(),
    };
  }

  public static updateSummaryIncrementally(
    oldSummary: string | null,
    newExchange: { sender: string; body: string }
  ): string {
    const exchangeText = `${newExchange.sender}: "${newExchange.body}"`;
    if (!oldSummary) {
      return `Conversation initiated: ${exchangeText}`;
    }
    return `${oldSummary}\nFollow-up - ${exchangeText}`;
  }
}
