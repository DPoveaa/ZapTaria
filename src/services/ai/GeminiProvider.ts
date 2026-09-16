import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIProviderContext, AIDecisionContract, AIDecisionContractSchema } from './AIProvider.js';
import { GeminiKeyPoolManager } from './GeminiKeyPoolManager.js';

export class GeminiProvider implements AIProvider {
  public name = 'GeminiProvider';
  private keyPool: GeminiKeyPoolManager;
  private defaultModel: string;

  constructor(keyPool: GeminiKeyPoolManager, defaultModel: string = 'gemini-1.5-flash') {
    this.keyPool = keyPool;
    this.defaultModel = process.env.GEMINI_DEFAULT_MODEL || defaultModel;
  }

  public async evaluateConversation(context: AIProviderContext): Promise<AIDecisionContract> {
    const activeKey = this.keyPool.getNextActiveKey();
    if (!activeKey) {
      throw new Error('NO_ACTIVE_GEMINI_KEY: No eligible Gemini API key available in key pool');
    }

    try {
      const genAI = new GoogleGenerativeAI(activeKey.plaintextKey);
      const model = genAI.getGenerativeModel({
        model: this.defaultModel,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = this.buildPrompt(context);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const parsedJson = JSON.parse(responseText);
      const validated = AIDecisionContractSchema.parse(parsedJson);

      return validated;
    } catch (error: any) {
      const isQuotaOrRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota');
      this.keyPool.recordError(activeKey.id, isQuotaOrRateLimit);
      throw error;
    }
  }

  public async generateObjectiveCriteria(objective: string): Promise<{ successCriteria: string; failureCriteria: string }> {
    const activeKey = this.keyPool.getNextActiveKey();
    if (!activeKey) {
      return {
        successCriteria: 'Objective completed as requested by user',
        failureCriteria: 'Contact explicitly refuses or is unable to fulfill objective'
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(activeKey.plaintextKey);
      const model = genAI.getGenerativeModel({
        model: this.defaultModel,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
Given the following task objective for a WhatsApp conversation, generate structured successCriteria and failureCriteria.
Objective: "${objective}"

Return JSON matching:
{
  "successCriteria": "clear criteria for success",
  "failureCriteria": "clear criteria for failure"
}
`;
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      return {
        successCriteria: parsed.successCriteria || 'Objective completed',
        failureCriteria: parsed.failureCriteria || 'Objective failed or refused'
      };
    } catch (err) {
      return {
        successCriteria: 'Objective completed as requested',
        failureCriteria: 'Contact explicitly refuses or is unable to fulfill objective'
      };
    }
  }

  private buildPrompt(context: AIProviderContext): string {
    return `
You are an autonomous WhatsApp AI assistant executing a business task.
Your goal is to complete the objective through WhatsApp text conversation.

STRICT RULES:
1. Do NOT invent information or pretend to have fulfilled an objective if you do not.
2. If contact gives a partial answer, ask polite clarifying questions.
3. If contact asks to wait (e.g., "I will check tomorrow"), set decision to "WAIT" and status to "WAITING_FOR_CONTACT".
4. If contact provides the requested information or document, mark "COMPLETE" and taskStatus "COMPLETED".
5. If contact refuses or states they cannot fulfill the request, mark "FAIL" and taskStatus "FAILED".
6. If human approval or complex negotiation is required, set decision to "REQUEST_HUMAN" and taskStatus "HUMAN_REQUIRED".
7. You MUST return JSON ONLY. No markdown wrapper, no chain-of-thought.

CONTEXT:
Task Objective: ${context.taskObjective}
Success Criteria: ${context.successCriteria || 'N/A'}
Failure Criteria: ${context.failureCriteria || 'N/A'}
Constraints: ${context.constraints || 'None'}
Conversation Summary: ${context.summary || 'None'}
Current Date/Time: ${context.currentDateTime}
Current Task State: ${context.currentTaskState}

CONVERSATION HISTORY:
${context.conversationHistory.map(m => `[${m.timestamp}] ${m.senderType}: ${m.body}${m.hasMedia ? ` (Attachment: ${m.mediaType})` : ''}`).join('\n')}

LATEST MESSAGE FROM CONTACT:
${context.latestMessage ? `${context.latestMessage.senderType}: ${context.latestMessage.body}${context.latestMessage.hasMedia ? ` (Attachment: ${context.latestMessage.mediaType})` : ''}` : 'None'}

Return JSON exactly adhering to this TypeScript structure:
{
  "decision": "SEND_MESSAGE" | "WAIT" | "COMPLETE" | "FAIL" | "REQUEST_HUMAN" | "PAUSE",
  "taskStatus": "ACTIVE" | "WAITING_FOR_CONTACT" | "WAITING_FOR_USER" | "PAUSED" | "COMPLETED" | "FAILED" | "HUMAN_REQUIRED",
  "reply": "string (message to send to contact, or null if decision is WAIT)",
  "confidence": number between 0 and 1,
  "goalProgress": number between 0 and 1,
  "reason": "concise explanation of decision",
  "nextAction": "SEND_MESSAGE" | "WAIT" | "ESCALATE" | "FINISH" | "NONE",
  "nextActionAt": "ISO date string or null"
}
`;
  }
}
