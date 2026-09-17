import { TaskStatus } from '@prisma/client';

export interface ScheduledTask {
  id: string;
  status: TaskStatus;
  scheduledStartAt?: Date | null;
  deadlineAt?: Date | null;
  nextActionAt?: Date | null;
}

export interface SchedulerStorageAdapter {
  getPendingScheduledTasks(): Promise<ScheduledTask[]>;
  activateTask(taskId: string): Promise<void>;
  markTaskHumanRequired(taskId: string, reason: string): Promise<void>;
}

export class TaskScheduler {
  private storage: SchedulerStorageAdapter;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(storage: SchedulerStorageAdapter, intervalMs: number = 30000) {
    this.storage = storage;
    this.intervalMs = intervalMs;
  }

  public start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkScheduledTasks().catch(err => console.error('Scheduler error:', err));
    }, this.intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkScheduledTasks(): Promise<void> {
    const tasks = await this.storage.getPendingScheduledTasks();
    const now = new Date();

    for (const task of tasks) {
      // Check scheduled start time
      if (task.status === 'SCHEDULED' && task.scheduledStartAt && task.scheduledStartAt <= now) {
        await this.storage.activateTask(task.id);
      }

      // Check task deadline
      if ((task.status === 'ACTIVE' || task.status === 'WAITING_FOR_CONTACT') && task.deadlineAt && task.deadlineAt <= now) {
        await this.storage.markTaskHumanRequired(task.id, 'Task deadline exceeded');
      }
    }
  }
}
