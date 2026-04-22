/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      {
        source: '/atelier-vault',
        destination: '/admin',
        permanent: false,
      },
    ]
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'notbxjqdzszxgfjnphpz.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
