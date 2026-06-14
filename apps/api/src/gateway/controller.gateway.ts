/**
 * /controller WebSocket namespace — AI Controller action calls and traces.
 *
 * BUILD_GUIDE §8:
 *   Server → client events: controller:action, controller:trace
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/controller', cors: { origin: '*' } })
export class ControllerGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { workspaceId: string }, @ConnectedSocket() client: Socket) {
    client.join(`ws:${data.workspaceId}`);
    client.emit('joined', { room: `ws:${data.workspaceId}` });
  }

  emitAction(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('controller:action', payload);
  }

  emitTrace(workspaceId: string, payload: unknown) {
    this.server.to(`ws:${workspaceId}`).emit('controller:trace', payload);
  }
}
