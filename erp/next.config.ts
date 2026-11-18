import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const isDev = process.env.NODE_ENV !== 'production';

// Basic CSP (spec): dev allows HMR websocket + eval, prod is strict.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://maps.googleapis.com https://maps.gstatic.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains',
        },
      ]),
];

const nextConfig: NextConfig = {
  // cacheComponents: false,
  // partialPrefetching: true,
  experimental: {
    agentUpgrade: 'security',
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    // Static brand/public assets are shared across clinics, but their URLs are
    // still tenant-prefixed (see tenantAssetPath). The proxy validates the
    // tenant before this rewrite serves the file.
    return [
      { source: '/:tenant/static/:path*', destination: '/:path*' },
      // Legacy site-relative asset folders stored in service/doctor rows.
      // `:path+` matters: `:path*` also matches a bare `/<tenant>/services`,
      // which would rewrite the real public page to the removed root route.
      { source: '/:tenant/services/:path+', destination: '/services/:path*' },
      { source: '/:tenant/doctors/:path+', destination: '/doctors/:path*' },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
