/**
 * Schema superset guard.
 *
 * The DrizzleService client (`appSchema`) is now the full `@bitecodes/db` barrel
 * rather than a hand-rolled subset that drifted from the real tables. This test
 * fails CI if any table the API code references stops being a key on
 * `appSchema` — catching drift before it reaches a query.
 */
import { describe, it, expect } from 'vitest';
import { appSchema } from '../src/drizzle/drizzle.service.js';

// Every table the API persists to / reads from. Add here when a new domain is wired.
const API_REFERENCED_TABLES = [
  'organizations', 'workspaces', 'users', 'memberships', 'invitations',
  'agents', 'agentVersions', 'agentTriggers', 'agentRuns', 'runSteps', 'approvals',
  'employeeControls', 'agentRelationships', 'routingDecisions',
  'conversations', 'conversationMessages', 'agentMessages', 'onboardingStates',
  'knowledgeBases', 'documents', 'documentChunks', 'agentMemories',
  'socialAccounts', 'brandVoices', 'contentItems',
  'auditLogs', 'settings', 'notifications',
  'workflows', 'workflowRuns',
  'connectors', 'connectorCredentials', 'mcpServers', 'mcpTools',
  'idempotencyKeys',
] as const;

describe('appSchema superset', () => {
  it('contains every API-referenced table', () => {
    const keys = new Set(Object.keys(appSchema));
    const missing = API_REFERENCED_TABLES.filter((t) => !keys.has(t));
    expect(missing, `appSchema is missing tables: ${missing.join(', ')}`).toEqual([]);
  });

  it('exposes table objects (not helper functions)', () => {
    // Each entry must be a Drizzle table — i.e. an object, not a function/enum.
    for (const t of API_REFERENCED_TABLES) {
      const table = (appSchema as Record<string, unknown>)[t];
      expect(typeof table, `${t} should be a table object`).toBe('object');
    }
  });
});
