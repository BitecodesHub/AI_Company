'use client';

/**
 * Subscribe to live run events on the /runs WebSocket namespace. On connect it
 * joins the workspace room (the server verifies session + membership before
 * honouring the join), then invokes `onEvent` for run:step / run:status /
 * approval:created so the caller can refetch. Best-effort: if the socket can't
 * connect, the caller's polling still keeps the view fresh.
 */
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function useRunStream(workspaceId: string | undefined, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!workspaceId) return;
    let socket: Socket | null = null;
    try {
      socket = io(`${API_URL}/runs`, { withCredentials: true, transports: ['websocket', 'polling'] });
      socket.on('connect', () => socket?.emit('join', { workspaceId }));
      const fire = () => cb.current();
      socket.on('run:step', fire);
      socket.on('run:status', fire);
      socket.on('approval:created', fire);
    } catch {
      /* polling fallback in the caller */
    }
    return () => { socket?.disconnect(); };
  }, [workspaceId]);
}
