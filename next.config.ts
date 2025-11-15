import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Node.js 모듈 무시
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // 🆕 externals 추가
      config.externals = config.externals || [];
      config.externals.push({
        'node:fs': 'commonjs node:fs',
        'node:https': 'commonjs node:https',
      });
    }
    return config;
  },
};

export default nextConfig;