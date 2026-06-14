/**
 * AuditService — append-only audit log for every sensitive action.
 * Writes to `audit_logs` inside withTenant() so RLS is enforced.
 * Failures are caught and logged — audit must never break the main flow.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService, auditLogs } from '../drizzle/drizzle.service.js';

export type AuditActorType = 'user' | 'agent' | 'system';

export interface AuditEventInput {
  organizationId: string;
  workspaceId?: string;
  actorType: AuditActorType;
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async log(event: AuditEventInput): Promise<void> {
    try {
      await this.drizzle.withTenant(event.organizationId, event.workspaceId, async (tx) => {
        await tx.insert(auditLogs).values({
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          actorType: event.actorType,
          actorId: event.actorId,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          metadata: (event.metadata ?? null) as Record<string, unknown> | null,
          ip: event.ip,
        });
      });
    } catch (err) {
      // Audit failures must never break the main flow.
      this.logger.error(`Failed to write audit log for "${event.action}": ${err}`);
    }
  }

  async logAuth(opts: { userId: string; action: 'login' | 'logout' | 'signup'; ip?: string; orgId: string }): Promise<void> {
    return this.log({
      organizationId: opts.orgId,
      actorType: 'user',
      actorId: opts.userId,
      action: `auth.${opts.action}`,
      ip: opts.ip,
    });
  }

  async logConnector(opts: { orgId: string; wsId: string; userId: string; connectorType: string; action: 'connect' | 'disconnect' }): Promise<void> {
    return this.log({
      organizationId: opts.orgId,
      workspaceId: opts.wsId,
      actorType: 'user',
      actorId: opts.userId,
      action: `connector.${opts.action}`,
      targetType: 'connector',
      metadata: { type: opts.connectorType },
    });
  }

  async logRoleChange(opts: { orgId: string; wsId?: string; actorId: string; targetUserId: string; newRole: string }): Promise<void> {
    return this.log({
      organizationId: opts.orgId,
      workspaceId: opts.wsId,
      actorType: 'user',
      actorId: opts.actorId,
      action: 'member.role_changed',
      targetType: 'user',
      targetId: opts.targetUserId,
      metadata: { newRole: opts.newRole },
    });
  }

  async logControllerAction(opts: { orgId: string; wsId: string; userId: string; actionName: string; args: unknown }): Promise<void> {
    return this.log({
      organizationId: opts.orgId,
      workspaceId: opts.wsId,
      actorType: 'user',
      actorId: opts.userId,
      action: `controller.${opts.actionName}`,
      metadata: { args: opts.args },
    });
  }
}
