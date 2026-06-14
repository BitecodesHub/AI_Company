'use client';

/**
 * Subscribe to the /company timeline socket. Joins the workspace room (server
 * verifies session + membership), then fires `onEvent` on company:message /
 * company:handoff so the caller can refetch. Best-effort; polling backs it up.
 */
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

export function useCompanyStream(workspaceId: string | undefined, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!workspaceId) return;
    let socket: Socket | null = null;
    try {
      // Same-origin; proxied by the Next.js server. Polling transport (Next
      // rewrites proxy HTTP long-poll, not raw WebSocket upgrades).
      socket = io('/company', { withCredentials: true, transports: ['polling'] });
      socket.on('connect', () => socket?.emit('join', { workspaceId }));
      const fire = () => cb.current();
      socket.on('company:message', fire);
      socket.on('company:handoff', fire);
    } catch { /* polling fallback in caller */ }
    return () => { socket?.disconnect(); };
  }, [workspaceId]);
}
