/**
 * Bridge between the durable executor (static Inngest fn, no DI) and the
 * email-backed approval notifier (a Nest provider). The provider registers
 * itself on init; the executor calls through it when an approval is created.
 * When no provider is registered or email is disabled, calls are safe no-ops.
 */
export interface ApprovalNotification {
  approvalId: string;
  runId: string;
  organizationId: string;
  workspaceId?: string;
  toolName: string;
  expiresAtMs: number;
}

export interface ApprovalNotifier {
  notifyApprovalCreated(n: ApprovalNotification): Promise<void>;
}

let current: ApprovalNotifier | null = null;

export function setApprovalNotifier(notifier: ApprovalNotifier | null): void {
  current = notifier;
}

export function approvalNotifier(): ApprovalNotifier | null {
  return current;
}
