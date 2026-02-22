/** @type {import('next').NextConfig} */
const nextConfig = {
  // Catch common React bugs in development
  reactStrictMode: true,

  // Don't expose Next.js version in X-Powered-By header
  poweredByHeader: false,

  // Security headers applied to all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Strict referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable access to sensors and device features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
