/**
 * @bitecodes/ee-audit — Audit log export, SIEM forwarding, indefinite retention.
 * Requires LICENSE_KEY. (P13-05)
 */
export function isAuditLicensed(): boolean {
  return Boolean(process.env['LICENSE_KEY']);
}

export interface SiemForwarder {
  forward(event: Record<string, unknown>): Promise<void>;
}
