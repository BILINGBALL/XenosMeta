import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.23', 'www.oxth.com'],
  // 明确指定 turbopack root，消除多 lockfile 警告
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/index.html',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
