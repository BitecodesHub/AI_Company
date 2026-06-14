import type { NextConfig } from 'next';

// Legacy bare routes redirect to the canonical /app/* segment.
const legacyAppRoutes = [
  'dashboard', 'agents', 'workflows', 'content', 'inbox',
  'knowledge', 'marketplace', 'analytics', 'settings',
];

// The web build proxies the API same-origin. The image runs the API + web
// together (see infra/docker/entrypoint.sh `app` role), so the API is always
// reachable at localhost:4000. Next bakes rewrite destinations at build time,
// so this is a constant — there is no API URL to configure in any environment.
const API_ORIGIN = 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@bitecodes/ui', '@bitecodes/shared', '@bitecodes/seo'],
  // Lint is a separate gate (`pnpm lint`); a style rule must never fail a deploy.
  // Real errors still fail the build — typescript.ignoreBuildErrors stays false.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    // The browser uses same-origin relative URLs; the web server proxies the
    // backend, so no API URL is ever baked into the client bundle.
    return {
      beforeFiles: [
        { source: '/v1/:path*', destination: `${API_ORIGIN}/v1/:path*` },
        { source: '/api/auth/:path*', destination: `${API_ORIGIN}/api/auth/:path*` },
        { source: '/socket.io/:path*', destination: `${API_ORIGIN}/socket.io/:path*` },
        { source: '/api/docs/:path*', destination: `${API_ORIGIN}/docs/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
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
