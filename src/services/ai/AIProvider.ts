import { z } from 'zod';

export const AIDecisionTypeSchema = z.enum([
  'SEND_MESSAGE',
  'WAIT',
  'COMPLETE',
  'FAIL',
  'REQUEST_HUMAN',
  'PAUSE'
]);

export type AIDecisionType = z.infer<typeof AIDecisionTypeSchema>;

export const AIDecisionContractSchema = z.object({
  decision: AIDecisionTypeSchema,
  taskStatus: z.enum([
    'ACTIVE',
    'WAITING_FOR_CONTACT',
    'WAITING_FOR_USER',
    'PAUSED',
    'COMPLETED',
    'FAILED',
    'HUMAN_REQUIRED'
  ]),
  reply: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1),
  goalProgress: z.number().min(0).max(1),
  reason: z.string(),
  nextAction: z.enum(['SEND_MESSAGE', 'WAIT', 'ESCALATE', 'FINISH', 'NONE']),
  nextActionAt: z.string().optional().nullable()
});

export type AIDecisionContract = z.infer<typeof AIDecisionContractSchema>;

export interface AIProviderContext {
  taskObjective: string;
  successCriteria?: string | null;
  failureCriteria?: string | null;
  constraints?: string | null;
  summary?: string | null;
  conversationHistory: Array<{
    senderType: string;
    body: string;
    timestamp: Date | string;
    hasMedia?: boolean;
    mediaType?: string | null;
  }>;
  latestMessage?: {
    body: string;
    senderType: string;
    hasMedia?: boolean;
    mediaType?: string | null;
  };
  currentTaskState: string;
  currentDateTime: string;
}

export interface AIProvider {
  name: string;
  evaluateConversation(context: AIProviderContext): Promise<AIDecisionContract>;
  generateObjectiveCriteria(objective: string): Promise<{ successCriteria: string; failureCriteria: string }>;
}
