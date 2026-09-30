import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('API_PROXY_TARGET must be an HTTP(S) origin');
    }
    return [{ source: '/gateway/:path*', destination: `${parsed.origin}/:path*` }];
  },
  typescript: {
    // Production images contain only this repository. Contract fixtures remain
    // covered by the separate full typecheck and contract test jobs.
    tsconfigPath: process.env.NODE_ENV === 'production' ? 'tsconfig.build.json' : 'tsconfig.json',
  },
  async headers() {
    return ['/verify-email', '/reset-password', '/forgot-password', '/two-factor'].map(source => ({ source, headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] }));
  },
  output: 'standalone',
  distDir: process.env.NEXT_BUILD_DIRECTORY || '.next',
  reactStrictMode: true,
};

export default nextConfig;
