/**
 * /inbox WebSocket namespace — live inbox message updates.
 *
 * BUILD_GUIDE §8:
 *   Server → client events: inbox:message
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/inbox', cors: { origin: '*' } })
export class InboxGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { workspaceId: string }, @ConnectedSocket() client: Socket) {
    client.join(`ws:${data.workspaceId}`);
    client.emit('joined', { room: `ws:${data.workspaceId}` });
  }

  emitMessage(workspaceId: string, message: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('inbox:message', { message });
  }
}
