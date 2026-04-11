/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/app', destination: '/' },
    ]
  },
}

module.exports = nextConfig
