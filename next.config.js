/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
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
