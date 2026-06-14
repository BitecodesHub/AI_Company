/**
 * /company WebSocket namespace — the unified company-chat / inter-agent
 * timeline. Server → client: company:message, company:handoff. Like /runs, the
 * join is verified against the Better Auth session + workspace membership so a
 * client cannot subscribe to another tenant's timeline.
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { eq, and } from 'drizzle-orm';
import { setCompanyEmitter } from './company-emitter.js';
import { BetterAuthService } from '../auth/better-auth.service.js';
import { DrizzleService, memberships } from '../drizzle/drizzle.service.js';

@WebSocketGateway({ namespace: '/company', cors: { origin: '*' } })
export class CompanyGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly auth: BetterAuthService,
    private readonly drizzle: DrizzleService,
  ) {}

  afterInit() { setCompanyEmitter(this); }
  onModuleDestroy() { setCompanyEmitter(null); }

  @SubscribeMessage('join')
  async handleJoin(@MessageBody() data: { workspaceId: string }, @ConnectedSocket() client: Socket) {
    const workspaceId = data?.workspaceId;
    if (!workspaceId) { client.emit('join:error', { code: 'VALIDATION_FAILED' }); return; }

    let userId: string | null = null;
    try {
      const headers = new Headers();
      const cookie = client.handshake.headers.cookie;
      if (cookie) headers.set('cookie', cookie);
      const session = await this.auth.auth.api.getSession({ headers });
      userId = session?.user?.id ?? null;
    } catch { userId = null; }
    if (!userId) { client.emit('join:error', { code: 'UNAUTHENTICATED' }); return; }

    const member = await this.drizzle.systemDb
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)))
      .limit(1);
    if (!member.length) { client.emit('join:error', { code: 'TENANT_MISMATCH' }); return; }

    client.join(`ws:${workspaceId}`);
    client.emit('joined', { room: `ws:${workspaceId}` });
  }

  emitMessage(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('company:message', payload);
  }

  emitHandoff(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('company:handoff', payload);
  }
}
