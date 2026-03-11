/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', 'otplib'],
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
