import { TaskStatus } from '@prisma/client';

export type TaskStateTransition = {
  from: TaskStatus[];
  to: TaskStatus;
};

export class TaskStateMachine {
  private static VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    DRAFT: ['SCHEDULED', 'ACTIVE', 'CANCELLED'],
    SCHEDULED: ['ACTIVE', 'PAUSED', 'CANCELLED'],
    ACTIVE: ['WAITING_FOR_CONTACT', 'WAITING_FOR_USER', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_REQUIRED'],
    WAITING_FOR_CONTACT: ['ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_REQUIRED'],
    WAITING_FOR_USER: ['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED', 'FAILED'],
    PAUSED: ['ACTIVE', 'CANCELLED'],
    HUMAN_REQUIRED: ['ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
    COMPLETED: [],
    FAILED: [],
    CANCELLED: []
  };

  public static isValidTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): boolean {
    if (currentStatus === nextStatus) return true;
    const allowed = this.VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  public static assertTransition(currentStatus: TaskStatus, nextStatus: TaskStatus) {
    if (!this.isValidTransition(currentStatus, nextStatus)) {
      throw new Error(`INVALID_STATE_TRANSITION: Cannot transition task status from ${currentStatus} to ${nextStatus}`);
    }
  }
}
