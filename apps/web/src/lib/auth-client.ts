/**
 * Better Auth client for the browser.
 * Uses better-auth/client (framework-agnostic) — works in Next.js app router.
 */
import { createAuthClient } from 'better-auth/client';

// Browser calls the NestJS API directly.
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
