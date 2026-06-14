import type { NextConfig } from 'next';

// Legacy bare routes redirect to the canonical /app/* segment.
const legacyAppRoutes = [
  'dashboard', 'agents', 'workflows', 'content', 'inbox',
  'knowledge', 'marketplace', 'analytics', 'settings',
];

const nextConfig: NextConfig = {
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
