// NOTE: Some Next.js versions' exported `NextConfig` type is narrower than runtime config.
// Keep this file build-safe by avoiding strict typing here.

// Backend URL used by the Next.js server-side rewrite proxy.
// Inside Docker the backend service is reachable at http://backend-dev:8000 (dev)
// or http://backend:8000 (prod). The env var BACKEND_INTERNAL_URL lets you
// override this (e.g. in docker-compose). Falls back to localhost:8000 for
// running outside Docker.
const backendUrl =
  process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  output: 'standalone',
  poweredByHeader: false,
  generateEtags: false,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Proxy /api/* to the FastAPI backend so the app works whether accessed
  // through nginx (port 80) or directly on the Next.js port (3000).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;