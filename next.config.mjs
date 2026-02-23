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
          // Baseline CSP hardening without breaking Next.js runtime
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; " +
              "img-src 'self' data: https:; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://slack.com; " +
              "frame-ancestors 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self' https://checkout.stripe.com https://billing.stripe.com;",
          },
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
