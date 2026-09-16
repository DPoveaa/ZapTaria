import { TaskStatus, AutonomyLevel } from '@prisma/client';
import { TaskStateMachine } from './TaskStateMachine.js';
import { SafetyGuardrails } from './SafetyGuardrails.js';
import { ContextBuilder, ContextMessage } from './ContextBuilder.js';
import { AIProvider } from '../ai/AIProvider.js';
import { WhatsAppProvider } from '../whatsapp/WhatsAppProvider.js';

export interface TaskRecord {
  id: string;
  contactId: string;
  conversationId?: string | null;
  title: string;
  objective: string;
  successCriteria?: string | null;
  failureCriteria?: string | null;
  constraints?: string | null;
  status: TaskStatus;
  autonomyLevel: AutonomyLevel;
  maxMessages: number;
  messageCount: number;
  deadlineAt?: Date | null;
  conversationSummary?: string | null;
  humanTakeover?: boolean;
  whatsappChatId: string;
}

export interface TaskEngineDependencies {
  aiProvider: AIProvider;
  whatsappProvider: WhatsAppProvider;
  getTaskById: (taskId: string) => Promise<TaskRecord | null>;
  updateTaskStatus: (taskId: string, status: TaskStatus, updates?: Partial<TaskRecord>) => Promise<void>;
  getConversationMessages: (chatId: string) => Promise<ContextMessage[]>;
  saveMessage: (chatId: string, senderType: 'AI' | 'USER' | 'CONTACT', body: string) => Promise<void>;
  logAudit: (taskId: string, action: string, decision: string, reason: string) => Promise<void>;
  getGlobalEmergencyStop: () => Promise<boolean>;
}

export class TaskEngine {
  private deps: TaskEngineDependencies;

  constructor(deps: TaskEngineDependencies) {
    this.deps = deps;
  }

  public async processInboundMessage(taskId: string, inboundMsg: ContextMessage): Promise<void> {
    const task = await this.deps.getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const emergencyStop = await this.deps.getGlobalEmergencyStop();

    // Check safety
    const safetyResult = SafetyGuardrails.validateOutgoingAction({
      taskStatus: task.status,
      autonomyLevel: task.autonomyLevel,
      messageCount: task.messageCount,
      maxMessages: task.maxMessages,
      deadlineAt: task.deadlineAt,
      globalEmergencyStop: emergencyStop,
      humanTakeoverActive: task.humanTakeover,
    });

    if (!safetyResult.isSafe) {
      if (safetyResult.actionRequired === 'HUMAN_REQUIRED') {
        TaskStateMachine.assertTransition(task.status, 'HUMAN_REQUIRED');
        await this.deps.updateTaskStatus(taskId, 'HUMAN_REQUIRED');
        await this.deps.logAudit(taskId, 'SAFETY_ESCALATION', 'HUMAN_REQUIRED', safetyResult.reason || 'Safety limit reached');
      }
      return;
    }

    // Build context
    const messages = await this.deps.getConversationMessages(task.whatsappChatId);
    const aiContext = ContextBuilder.buildContext(
      {
        title: task.title,
        objective: task.objective,
        successCriteria: task.successCriteria,
        failureCriteria: task.failureCriteria,
        constraints: task.constraints,
        status: task.status,
      },
      task.conversationSummary || null,
      messages,
      inboundMsg
    );

    // Evaluate AI Decision
    const decision = await this.deps.aiProvider.evaluateConversation(aiContext);

    await this.deps.logAudit(
      taskId,
      'AI_DECISION',
      decision.decision,
      `Reason: ${decision.reason} | Confidence: ${decision.confidence}`
    );

    // Update state based on decision
    if (decision.decision === 'SEND_MESSAGE' && decision.reply) {
      // Validate outgoing message text against safety filter
      const textSafety = SafetyGuardrails.validateOutgoingAction({
        taskStatus: task.status,
        autonomyLevel: task.autonomyLevel,
        messageCount: task.messageCount,
        maxMessages: task.maxMessages,
        deadlineAt: task.deadlineAt,
        proposedMessage: decision.reply,
        globalEmergencyStop: emergencyStop,
        humanTakeoverActive: task.humanTakeover,
      });

      if (!textSafety.isSafe) {
        await this.deps.updateTaskStatus(taskId, 'HUMAN_REQUIRED');
        await this.deps.logAudit(taskId, 'RESTRICTED_TEXT_BLOCKED', 'HUMAN_REQUIRED', textSafety.reason || 'Blocked content');
        return;
      }

      // Send text via WhatsApp Provider
      await this.deps.whatsappProvider.sendText(task.whatsappChatId, decision.reply);
      await this.deps.saveMessage(task.whatsappChatId, 'AI', decision.reply);

      // Increment message count
      const newCount = task.messageCount + 1;
      const targetStatus: TaskStatus = decision.taskStatus as TaskStatus;

      TaskStateMachine.assertTransition(task.status, targetStatus);
      await this.deps.updateTaskStatus(taskId, targetStatus, { messageCount: newCount });

    } else if (decision.decision === 'WAIT') {
      TaskStateMachine.assertTransition(task.status, 'WAITING_FOR_CONTACT');
      await this.deps.updateTaskStatus(taskId, 'WAITING_FOR_CONTACT');

    } else if (decision.decision === 'COMPLETE') {
      if (decision.reply) {
        await this.deps.whatsappProvider.sendText(task.whatsappChatId, decision.reply);
        await this.deps.saveMessage(task.whatsappChatId, 'AI', decision.reply);
      }
      TaskStateMachine.assertTransition(task.status, 'COMPLETED');
      await this.deps.updateTaskStatus(taskId, 'COMPLETED');

    } else if (decision.decision === 'FAIL') {
      if (decision.reply) {
        await this.deps.whatsappProvider.sendText(task.whatsappChatId, decision.reply);
        await this.deps.saveMessage(task.whatsappChatId, 'AI', decision.reply);
      }
      TaskStateMachine.assertTransition(task.status, 'FAILED');
      await this.deps.updateTaskStatus(taskId, 'FAILED');

    } else if (decision.decision === 'REQUEST_HUMAN') {
      TaskStateMachine.assertTransition(task.status, 'HUMAN_REQUIRED');
      await this.deps.updateTaskStatus(taskId, 'HUMAN_REQUIRED');
    }
  }
}
