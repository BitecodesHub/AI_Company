/**
 * Bridge so durable Inngest functions / services can push to the /company
 * timeline without holding the gateway instance. The gateway registers itself
 * on init; emits are safe no-ops when no gateway is registered.
 */
export interface CompanyEmitter {
  emitMessage(workspaceId: string, payload: unknown): void;
  emitHandoff(workspaceId: string, payload: unknown): void;
}

let current: CompanyEmitter | null = null;

export function setCompanyEmitter(emitter: CompanyEmitter | null): void {
  current = emitter;
}

export function companyEmitter(): CompanyEmitter | null {
  return current;
}
