import { PrismaClient, ScheduledActionStatus } from '@prisma/client';

export class PersistentTaskScheduler {
  private prisma: PrismaClient;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private onExecuteAction?: (action: any) => Promise<void>;

  constructor(prisma: PrismaClient, intervalMs: number = 10000, onExecuteAction?: (action: any) => Promise<void>) {
    this.prisma = prisma;
    this.intervalMs = intervalMs;
    this.onExecuteAction = onExecuteAction;
  }

  public start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processPendingActions().catch(err => console.error('Scheduler processing error:', err));
    }, this.intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async scheduleAction(taskId: string, type: string, scheduledFor: Date, idempotencyKey: string, payload?: any) {
    return await this.prisma.scheduledAction.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        taskId,
        type,
        scheduledFor,
        idempotencyKey,
        payload,
        status: 'PENDING'
      }
    });
  }

  public async processPendingActions(): Promise<void> {
    const now = new Date();
    const pending = await this.prisma.scheduledAction.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: now }
      },
      take: 20,
      include: { task: true }
    });

    for (const action of pending) {
      // Atomic DB Claim Mechanism: Only claim if status is still PENDING
      try {
        const claimed = await this.prisma.scheduledAction.updateMany({
          where: {
            id: action.id,
            status: 'PENDING'
          },
          data: {
            status: 'PROCESSING',
            lastAttemptAt: now,
            attempts: { increment: 1 }
          }
        });

        if (claimed.count === 0) {
          // Action was claimed by another worker tick
          continue;
        }

        if (this.onExecuteAction) {
          await this.onExecuteAction(action);
        }

        await this.prisma.scheduledAction.update({
          where: { id: action.id },
          data: { status: 'COMPLETED', completedAt: new Date() }
        });
      } catch (err: any) {
        await this.prisma.scheduledAction.update({
          where: { id: action.id },
          data: {
            status: action.attempts >= 3 ? 'FAILED' : 'PENDING',
            error: err?.message || 'Execution failed'
          }
        });
      }
    }
  }
}
