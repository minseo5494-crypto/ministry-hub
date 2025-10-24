/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ 프로덕션 빌드 시 TypeScript 오류 무시
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ 프로덕션 빌드 시 ESLint 오류 무시
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig