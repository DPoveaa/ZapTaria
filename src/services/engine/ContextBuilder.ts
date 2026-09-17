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
    inboundMsg?: ContextMessage,
    taskMemory?: { goal?: string; knownFacts?: string[]; openQuestions?: string[]; contactCommitments?: string[] } | null
  ): AIProviderContext {
    const recentMessages = messages.slice(-this.MAX_MESSAGES).map(m => ({
      senderType: m.senderType,
      body: m.body,
      timestamp: m.timestamp,
      hasMedia: m.hasMedia,
      mediaType: m.mediaType,
    }));

    let summaryWithMemory = conversationSummary || '';
    if (taskMemory) {
      const memoryText = `Goal: ${taskMemory.goal || 'N/A'} | Facts: ${(taskMemory.knownFacts || []).join('; ')} | Commitments: ${(taskMemory.contactCommitments || []).join('; ')}`;
      summaryWithMemory = summaryWithMemory ? `${summaryWithMemory}\nTask Memory: ${memoryText}` : `Task Memory: ${memoryText}`;
    }

    return {
      taskObjective: `${task.title}: ${task.objective}`,
      successCriteria: task.successCriteria,
      failureCriteria: task.failureCriteria,
      constraints: task.constraints,
      summary: summaryWithMemory || 'None',
      conversationHistory: recentMessages,
      latestMessage: inboundMsg ? {
        senderType: inboundMsg.senderType,
        body: inboundMsg.body,
        hasMedia: inboundMsg.hasMedia,
        mediaType: inboundMsg.mediaType,
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
