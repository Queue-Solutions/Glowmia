/** @type {import('next').NextConfig} */
const nextConfig = {
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
