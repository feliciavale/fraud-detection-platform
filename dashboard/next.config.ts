import type { NextConfig } from "next";

// Where the FastAPI server runs. The browser never calls it directly: it calls /api/... on this site,
// and Next.js forwards the request. Same origin means the login cookie works and no CORS is needed.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
