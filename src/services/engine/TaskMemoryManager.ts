import { PrismaClient } from '@prisma/client';

export interface StructuredTaskMemory {
  goal: string;
  knownFacts: string[];
  openQuestions: string[];
  contactCommitments: string[];
  lastRelevantState: string;
}

export class TaskMemoryManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async getMemory(taskId: string): Promise<StructuredTaskMemory | null> {
    const mem = await this.prisma.taskMemory.findUnique({ where: { taskId } });
    if (!mem) return null;
    return {
      goal: mem.goal,
      knownFacts: (mem.knownFacts as string[]) || [],
      openQuestions: (mem.openQuestions as string[]) || [],
      contactCommitments: (mem.contactCommitments as string[]) || [],
      lastRelevantState: mem.lastRelevantState || 'DRAFT',
    };
  }

  public async initMemory(taskId: string, goal: string): Promise<StructuredTaskMemory> {
    const memory = await this.prisma.taskMemory.upsert({
      where: { taskId },
      update: { goal },
      create: {
        taskId,
        goal,
        knownFacts: [],
        openQuestions: [],
        contactCommitments: [],
        lastRelevantState: 'ACTIVE'
      }
    });
    return {
      goal: memory.goal,
      knownFacts: [],
      openQuestions: [],
      contactCommitments: [],
      lastRelevantState: 'ACTIVE'
    };
  }

  public async updateMemory(taskId: string, updates: Partial<StructuredTaskMemory>): Promise<StructuredTaskMemory> {
    const current = await this.getMemory(taskId);
    const updated = await this.prisma.taskMemory.upsert({
      where: { taskId },
      update: {
        ...(updates.goal ? { goal: updates.goal } : {}),
        ...(updates.knownFacts ? { knownFacts: updates.knownFacts } : {}),
        ...(updates.openQuestions ? { openQuestions: updates.openQuestions } : {}),
        ...(updates.contactCommitments ? { contactCommitments: updates.contactCommitments } : {}),
        ...(updates.lastRelevantState ? { lastRelevantState: updates.lastRelevantState } : {}),
      },
      create: {
        taskId,
        goal: updates.goal || current?.goal || '',
        knownFacts: updates.knownFacts || [],
        openQuestions: updates.openQuestions || [],
        contactCommitments: updates.contactCommitments || [],
        lastRelevantState: updates.lastRelevantState || 'ACTIVE'
      }
    });

    return {
      goal: updated.goal,
      knownFacts: (updated.knownFacts as string[]) || [],
      openQuestions: (updated.openQuestions as string[]) || [],
      contactCommitments: (updated.contactCommitments as string[]) || [],
      lastRelevantState: updated.lastRelevantState || 'ACTIVE'
    };
  }
}
