/**
 * Signed approval links for email human-in-the-loop decisions.
 *
 * A token encodes (approvalId, decision, expiry) and an HMAC over them, so an
 * approve/reject link in an email can be acted on without a session — the HMAC
 * is the authorization. Tokens are single-purpose (one decision each) and expire.
 */
import crypto from 'node:crypto';

export type ApprovalDecision = 'approved' | 'rejected';

function secret(): string {
  const s = process.env['APPROVAL_LINK_SECRET'];
  if (!s || s === 'CHANGE_ME') {
    // No usable secret → links are effectively disabled (verify always fails).
    return '';
  }
  return s;
}

export function signApprovalToken(approvalId: string, decision: ApprovalDecision, expiresAtMs: number): string {
  const payload = `${approvalId}.${decision}.${expiresAtMs}`;
  const sig = crypto.createHmac('sha256', secret() || 'disabled').update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyApprovalToken(
  token: string,
): { ok: boolean; approvalId?: string; decision?: ApprovalDecision; reason?: string } {
  if (!secret()) return { ok: false, reason: 'APPROVAL_LINKS_DISABLED' };
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  const parts = decoded.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'MALFORMED' };
  const [approvalId, decision, expiresAtMs, sig] = parts as [string, string, string, string];
  if (decision !== 'approved' && decision !== 'rejected') return { ok: false, reason: 'MALFORMED' };

  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${approvalId}.${decision}.${expiresAtMs}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'BAD_SIGNATURE' };
  if (Number(expiresAtMs) < Date.now()) return { ok: false, reason: 'EXPIRED' };

  return { ok: true, approvalId, decision };
}
