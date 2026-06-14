/**
 * Better Auth client for the browser.
 * Uses better-auth/client (framework-agnostic) — works in Next.js app router.
 */
import { createAuthClient } from 'better-auth/client';

// Same-origin: better-auth defaults baseURL to window.location.origin; the
// Next.js server proxies /api/auth/* to the API. No API URL in the bundle.
export const authClient = createAuthClient({
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
