import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Legacy bare routes redirect to the canonical /app/* segment.
const legacyAppRoutes = [
  'dashboard', 'agents', 'workflows', 'content', 'inbox',
  'knowledge', 'marketplace', 'analytics', 'settings',
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (apps/web/server.js).
  // Production only — `standalone` pulls in @swc/helpers via the webpack config,
  // which is unnecessary (and brittle) for local `next dev`.
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' as const } : {}),
  // Trace from the monorepo root so the standalone bundle picks up hoisted deps.
  outputFileTracingRoot: join(__dirname, '../../'),
  transpilePackages: ['@bitecodes/ui', '@bitecodes/shared', '@bitecodes/seo'],
  async redirects() {
    return [
      // Bare /:locale/dashboard → /:locale/app/dashboard (legacy bookmarks)
      ...legacyAppRoutes.map((route) => ({
        source: `/:locale(en)/${route}`,
        destination: `/:locale/app/${route}`,
        permanent: true,
      })),
      // Root bare routes (no locale prefix)
      ...legacyAppRoutes.map((route) => ({
        source: `/${route}`,
        destination: `/app/${route}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
