/**
 * Bridge between durable Inngest functions (static, no Nest DI) and the live
 * RunsGateway (a Nest WebSocket provider). The gateway registers itself here on
 * init; Inngest functions emit through the registered instance. When no gateway
 * is registered (e.g. a headless worker process) emits are safe no-ops.
 */
export interface RunsEmitter {
  emitRunStep(workspaceId: string, payload: unknown): void;
  emitRunStatus(workspaceId: string, payload: unknown): void;
  emitApprovalCreated(workspaceId: string, payload: unknown): void;
}

let current: RunsEmitter | null = null;

export function setRunsEmitter(emitter: RunsEmitter | null): void {
  current = emitter;
}

export function runsEmitter(): RunsEmitter | null {
  return current;
}
