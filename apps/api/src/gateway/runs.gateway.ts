/**
 * /runs WebSocket namespace — streams live run/step events to clients.
 *
 * BUILD_GUIDE §8:
 *   Server → client events: run:step, run:status, approval:created
 *   Client joins room: `ws:<workspaceId>` so events never cross tenants.
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { eq, and } from 'drizzle-orm';
import { setRunsEmitter } from './runs-emitter.js';
import { BetterAuthService } from '../auth/better-auth.service.js';
import { DrizzleService, memberships } from '../drizzle/drizzle.service.js';

@WebSocketGateway({ namespace: '/runs', cors: { origin: '*' } })
export class RunsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RunsGateway.name);

  constructor(
    private readonly auth: BetterAuthService,
    private readonly drizzle: DrizzleService,
  ) {}

  afterInit() {
    // Register so durable Inngest functions can stream run/step/approval events.
    setRunsEmitter(this);
  }

  onModuleDestroy() {
    setRunsEmitter(null);
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a workspace room ONLY after verifying the socket's Better Auth session
   * and that the user is a member of that workspace. Otherwise a client could
   * subscribe to another tenant's run/approval stream by guessing a workspace id.
   */
  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const workspaceId = data?.workspaceId;
    if (!workspaceId) {
      client.emit('join:error', { code: 'VALIDATION_FAILED', message: 'workspaceId required' });
      return;
    }

    const userId = await this.resolveUserId(client);
    if (!userId) {
      client.emit('join:error', { code: 'UNAUTHENTICATED', message: 'Sign in required.' });
      return;
    }

    const member = await this.drizzle.systemDb
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)))
      .limit(1);
    if (!member.length) {
      client.emit('join:error', { code: 'TENANT_MISMATCH', message: 'Not a member of this workspace.' });
      return;
    }

    const room = `ws:${workspaceId}`;
    client.join(room);
    client.emit('joined', { room });
  }

  private async resolveUserId(client: Socket): Promise<string | null> {
    try {
      const headers = new Headers();
      const cookie = client.handshake.headers.cookie;
      if (cookie) headers.set('cookie', cookie);
      const session = await this.auth.auth.api.getSession({ headers });
      return session?.user?.id ?? null;
    } catch {
      return null;
    }
  }

  emitRunStep(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('run:step', payload);
  }

  emitRunStatus(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('run:status', payload);
  }

  emitApprovalCreated(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('approval:created', payload);
  }
}
