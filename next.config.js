/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'notbxjqdzszxgfjnphpz.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
