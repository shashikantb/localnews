/** @type {import('next').NextConfig} */

const gcsBucketName = process.env.GCS_BUCKET_NAME;

const remotePatterns = [
  {
    protocol: 'https',
    hostname: 'picsum.photos',
    port: '',
    pathname: '/**',
  },
  {
    protocol: 'https',
    hostname: 'placehold.co',
    port: '',
    pathname: '/**',
  },
];

if (gcsBucketName) {
  remotePatterns.push({
    protocol: 'https',
    hostname: 'storage.googleapis.com',
    port: '',
    pathname: `/${gcsBucketName}/**`,
  });
}

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});


const nextConfig = {
  productionBrowserSourceMaps: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns,
  },
};

module.exports = withPWA(nextConfig);
