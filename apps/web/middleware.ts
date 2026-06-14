import createMiddleware from 'next-intl/middleware';
import { routing } from './src/routing';

export default createMiddleware(routing);

export const config = {
  // Exclude backend-proxy prefixes (/v1, /api/*, /socket.io) so next-intl does
  // not locale-mangle them before the next.config rewrites can proxy them.
  matcher: ['/((?!_next|_vercel|api|v1|socket\\.io|.*\\..*).*)'],
};
