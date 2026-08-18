import type { NextConfig } from 'next';

/**
 * Tenant logos and hero images are supplied by colleges and may live on
 * their own web host or in our S3 bucket. `next/image` would need an
 * allowlist wide enough to be meaningless, so brand imagery is served
 * through plain <img> (see src/components/brand/Logo.tsx) and only
 * first-party imagery goes through the optimiser.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Standalone output is what the Docker runner stage copies, and it
  // matters for a product a college may insist on self-hosting on their
  // own campus server rather than putting on anyone's cloud.
  //
  // Opt-in rather than always-on: `next start` refuses to serve a
  // standalone build, so leaving it set breaks the ordinary
  // `build && start` loop everyone uses locally. The Dockerfile sets
  // BUILD_STANDALONE=1.
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' as const } : {}),

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.amazonaws.com' }],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
