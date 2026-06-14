/**
 * ApprovalNotifierService — emails org admins/owners when a run is waiting for a
 * human approval, with signed approve/reject links. Best-effort: if email is
 * disabled (no RESEND_API_KEY) or links are unconfigured, it logs and no-ops —
 * the in-app approval inbox + WebSocket event remain the primary path.
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { DrizzleService, memberships, users } from '../drizzle/drizzle.service.js';
import { EmailService } from './email.service.js';
import { signApprovalToken } from '../common/approval-link.js';
import { setApprovalNotifier, type ApprovalNotification, type ApprovalNotifier } from './approval-notifier.js';

@Injectable()
export class ApprovalNotifierService implements ApprovalNotifier, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApprovalNotifierService.name);
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() { setApprovalNotifier(this); }
  onModuleDestroy() { setApprovalNotifier(null); }

  async notifyApprovalCreated(n: ApprovalNotification): Promise<void> {
    try {
      // Recipients: active admins/owners of the organization.
      const rows = await this.drizzle.systemDb
        .select({ email: users.email })
        .from(memberships)
        .leftJoin(users, eq(users.id, memberships.userId))
        .where(and(
          eq(memberships.organizationId, n.organizationId),
          inArray(memberships.role, ['owner', 'admin']),
          isNull(memberships.deactivatedAt),
        ));
      const recipients = rows.map((r) => r.email).filter((e): e is string => !!e);
      if (recipients.length === 0) return;

      const apiUrl = process.env['API_URL'] ?? process.env['AUTH_URL'] ?? 'http://localhost:4000';
      const link = (decision: 'approved' | 'rejected') =>
        `${apiUrl}/v1/approvals/${n.approvalId}/email-decision?token=${signApprovalToken(n.approvalId, decision, n.expiresAtMs)}`;

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:480px">
          <h2 style="margin:0 0 8px">Approval needed</h2>
          <p style="color:#555">An employee is waiting to run the tool <strong>${escapeHtml(n.toolName)}</strong>.</p>
          <p style="margin:24px 0">
            <a href="${link('approved')}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;margin-right:8px">Approve</a>
            <a href="${link('rejected')}" style="background:#dc2626;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Reject</a>
          </p>
          <p style="color:#999;font-size:12px">This link expires ${new Date(n.expiresAtMs).toUTCString()}.</p>
        </div>`;

      await this.email.send({
        to: recipients,
        subject: `Approval needed: ${n.toolName}`,
        html,
      });
    } catch (err) {
      this.logger.warn(`Approval email notification failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
