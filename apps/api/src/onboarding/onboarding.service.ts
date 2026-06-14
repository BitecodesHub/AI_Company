/**
 * OnboardingService — server-owned onboarding checklist (one per workspace).
 *
 * Steps auto-advance from real actions (hire an employee, complete the first
 * run) and can be advanced explicitly. Because state lives on the server,
 * progress survives refresh / device change. When every required step is done,
 * `completed_at` is set and `onboarding/completed` is emitted (best-effort).
 */
import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService, onboardingStates } from '../drizzle/drizzle.service.js';
import { inngest } from '../inngest/client.js';

export const ONBOARDING_STEPS = ['hire_employee', 'first_run', 'connect_tool', 'invite_team'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
const REQUIRED: OnboardingStep[] = ['hire_employee', 'first_run'];

export interface OnboardingCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly drizzle: DrizzleService) {}

  async get(ctx: OnboardingCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .select()
        .from(onboardingStates)
        .where(eq(onboardingStates.organizationId, ctx.organizationId))
        .limit(1);
      if (row) return this.shape(row);
      // No row yet → return a fresh (unpersisted) default checklist.
      return { completedSteps: [] as string[], currentStep: ONBOARDING_STEPS[0], completedAt: null, steps: this.stepView([]) };
    });
  }

  advance(ctx: OnboardingCtx, step: OnboardingStep) {
    return this.markStep(ctx, step);
  }

  /** Idempotently mark a step complete (used by API + auto-advance hooks). */
  async markStep(ctx: OnboardingCtx, step: OnboardingStep) {
    if (!ONBOARDING_STEPS.includes(step)) return this.get(ctx);

    const result = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(onboardingStates)
        .where(eq(onboardingStates.organizationId, ctx.organizationId))
        .limit(1);

      const completed = new Set<string>((existing?.completedSteps as string[] | undefined) ?? []);
      completed.add(step);
      const completedArr = [...completed];
      const allDone = REQUIRED.every((s) => completed.has(s));
      const nextStep = ONBOARDING_STEPS.find((s) => !completed.has(s)) ?? null;
      const completedAt = allDone ? (existing?.completedAt ?? new Date()) : null;

      if (existing) {
        const [row] = await tx
          .update(onboardingStates)
          .set({ completedSteps: completedArr, currentStep: nextStep, completedAt, updatedAt: new Date() })
          .where(eq(onboardingStates.id, existing.id))
          .returning();
        return { row: row!, newlyCompleted: allDone && !existing.completedAt };
      }
      const [row] = await tx
        .insert(onboardingStates)
        .values({ organizationId: ctx.organizationId, workspaceId: ctx.workspaceId ?? null, completedSteps: completedArr, currentStep: nextStep, completedAt })
        .returning();
      return { row: row!, newlyCompleted: allDone };
    });

    if (result.newlyCompleted) {
      try {
        await inngest.send({ name: 'onboarding/completed', data: { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId } });
      } catch { /* best-effort */ }
    }
    return this.shape(result.row);
  }

  private shape(row: typeof onboardingStates.$inferSelect) {
    const completed = (row.completedSteps as string[] | undefined) ?? [];
    return { completedSteps: completed, currentStep: row.currentStep, completedAt: row.completedAt, steps: this.stepView(completed) };
  }

  private stepView(completed: string[]) {
    return ONBOARDING_STEPS.map((s) => ({ step: s, done: completed.includes(s), required: REQUIRED.includes(s) }));
  }
}
