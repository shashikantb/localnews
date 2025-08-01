/** @type {import('next').NextConfig} */
const path = require('path');

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
  remotePatterns.push({
    protocol: 'http',
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
  output: 'standalone', // Required for optimized Docker builds
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
  webpack: (config) => {
    // Add alias for "@/..."
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = withPWA(nextConfig);
