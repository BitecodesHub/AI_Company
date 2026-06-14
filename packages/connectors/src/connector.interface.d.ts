/**
 * Connector interface — the contract every connector must implement.
 * (ARCHITECTURE.md §10)
 *
 * Actions become tools an agent can call AND steps a workflow can use —
 * one implementation, two consumers.
 */
import { z } from 'zod';
export type ConnectorRiskClass = 'read' | 'write' | 'destructive';
export interface ConnectorActionOptions<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> {
    description: string;
    inputSchema: TInput;
    outputSchema: TOutput;
    handler: (input: z.infer<TInput>, ctx: ConnectorContext) => Promise<z.infer<TOutput>>;
}
export interface ConnectorTriggerOptions {
    kind: 'webhook' | 'poll';
    description: string;
    /** For poll triggers: interval in seconds */
    intervalSecs?: number;
    handler: (payload: unknown, ctx: ConnectorContext) => Promise<void>;
}
export interface ConnectorContext {
    organizationId: string;
    workspaceId?: string;
    connectorId: string;
    /** Decrypted access token (never logged) */
    accessToken?: string;
    metadata?: Record<string, unknown>;
}
export interface ConnectorAction {
    description: string;
    inputSchema: z.ZodTypeAny;
    outputSchema: z.ZodTypeAny;
    riskClass: ConnectorRiskClass;
    handler: (input: unknown, ctx: ConnectorContext) => Promise<unknown>;
}
export interface ConnectorTrigger {
    kind: 'webhook' | 'poll';
    description: string;
    intervalSecs?: number;
    handler: (payload: unknown, ctx: ConnectorContext) => Promise<void>;
}
export interface Connector {
    /** Unique slug e.g. 'slack', 'gmail', 'x' */
    readonly type: string;
    readonly displayName: string;
    readonly authKind: 'oauth2' | 'apiKey' | 'none';
    readonly actions: Record<string, ConnectorAction>;
    readonly triggers?: Record<string, ConnectorTrigger>;
    riskClass(action: string): ConnectorRiskClass;
    /** OAuth2 scopes required (empty for apiKey/none) */
    readonly scopes?: string[];
}
/** Registry of all registered connectors */
export declare class ConnectorRegistry {
    private readonly connectors;
    register(connector: Connector): void;
    get(type: string): Connector | undefined;
    list(): Connector[];
    getAction(connectorType: string, actionName: string): ConnectorAction | undefined;
}
export declare const connectorRegistry: ConnectorRegistry;
//# sourceMappingURL=connector.interface.d.ts.map