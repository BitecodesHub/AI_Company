'use client';

/**
 * useMe — the authenticated session (GET /v1/me) shared across the app.
 *
 * Backed by TanStack Query so the result is cached and shared. While loading or
 * on error the role resolves to `null`, and client gates (roleAtLeast) fail
 * CLOSED — privileged nav/UI stays hidden until a trustworthy role arrives.
 * Client gating is cosmetic only; the server enforces RBAC regardless.
 */
import { useQuery } from '@tanstack/react-query';
import { meApi, type Me } from '../lib/api-client';

export function useMe() {
  return useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => meApi.get(),
    staleTime: 60_000,
    retry: 1,
  });
}
