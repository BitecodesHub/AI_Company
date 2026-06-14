import { pgTable, text, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

// ── onboarding_states ──────────────────────────────────────────────────────────
// Server-owned onboarding checklist, one per workspace. Because it lives on the
// server, progress survives refresh / device changes (Phase I acceptance).
export const onboardingStates = pgTable(
  'onboarding_states',
  {
    id: primaryKey(),
    ...tenantColumns(),
    completedSteps: jsonb('completed_steps').notNull().default(sql`'[]'::jsonb`),
    currentStep: text('current_step'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('onboarding_states_workspace_uniq').on(t.workspaceId),
    index('onboarding_states_org_idx').on(t.organizationId),
  ],
);
