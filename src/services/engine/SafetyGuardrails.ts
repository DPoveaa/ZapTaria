import { AutonomyLevel, TaskStatus } from '@prisma/client';

export interface SafetyCheckInput {
  taskStatus: TaskStatus;
  autonomyLevel: AutonomyLevel;
  messageCount: IntNumber;
  maxMessages: number;
  deadlineAt?: Date | null;
  proposedMessage?: string | null;
  globalEmergencyStop?: boolean;
  humanTakeoverActive?: boolean;
}

type IntNumber = number;

export interface SafetyValidationResult {
  isSafe: boolean;
  reason?: string;
  actionRequired?: 'PAUSE' | 'HUMAN_REQUIRED' | 'BLOCK';
}

export class SafetyGuardrails {
  private static FORBIDDEN_KEYWORDS = [
    'credit card',
    'bank account',
    'wire transfer',
    'payment link',
    'password',
    'secret key',
    'api key',
    'sign contract',
    'legally binding',
    'buy now'
  ];

  public static validateOutgoingAction(input: SafetyCheckInput): SafetyValidationResult {
    // 1. Global Emergency Stop Check
    if (input.globalEmergencyStop) {
      return {
        isSafe: false,
        reason: 'GLOBAL_EMERGENCY_STOP: Autonomous messaging globally disabled',
        actionRequired: 'PAUSE'
      };
    }

    // 2. Human Takeover Active
    if (input.humanTakeoverActive) {
      return {
        isSafe: false,
        reason: 'HUMAN_TAKEOVER: User has manually taken over conversation',
        actionRequired: 'PAUSE'
      };
    }

    // 3. Task Status Check
    if (input.taskStatus !== 'ACTIVE' && input.taskStatus !== 'WAITING_FOR_CONTACT') {
      return {
        isSafe: false,
        reason: `TASK_INACTIVE: Task status is ${input.taskStatus}, autonomous response blocked`,
        actionRequired: 'BLOCK'
      };
    }

    // 4. Autonomy Level Approval Check
    if (input.autonomyLevel === 'HUMAN_APPROVAL') {
      return {
        isSafe: false,
        reason: 'HUMAN_APPROVAL_REQUIRED: Task requires manual user approval before sending',
        actionRequired: 'HUMAN_REQUIRED'
      };
    }

    // 5. Max Messages Guard
    if (input.messageCount >= input.maxMessages) {
      return {
        isSafe: false,
        reason: `MAX_MESSAGES_REACHED: Message count (${input.messageCount}) reached limit (${input.maxMessages})`,
        actionRequired: 'HUMAN_REQUIRED'
      };
    }

    // 6. Deadline Guard
    if (input.deadlineAt && new Date() > input.deadlineAt) {
      return {
        isSafe: false,
        reason: 'DEADLINE_EXCEEDED: Task deadline has passed',
        actionRequired: 'HUMAN_REQUIRED'
      };
    }

    // 7. Sensitive Content & Restricted Actions Filter
    if (input.proposedMessage) {
      const lower = input.proposedMessage.toLowerCase();
      for (const kw of this.FORBIDDEN_KEYWORDS) {
        if (lower.includes(kw)) {
          return {
            isSafe: false,
            reason: `SENSITIVE_CONTENT_DETECTED: Proposed message contained restricted term "${kw}"`,
            actionRequired: 'HUMAN_REQUIRED'
          };
        }
      }
    }

    return { isSafe: true };
  }
}
