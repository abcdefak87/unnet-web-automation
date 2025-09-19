/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // Bundle optimization
  experimental: {
    webpackBuildWorker: true,
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'recharts', 'react-hook-form'],
  },
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async rewrites() {
    // Apply rewrites in both development and production
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  // Suppress router errors in development
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  // Custom webpack config for bundle optimization
  webpack: (config, { dev, isServer }) => {
    // Enhanced bundle splitting for better performance
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Vendor chunks
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          // Lucide React icons
          lucide: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: 'lucide',
            chunks: 'all',
            priority: 20,
          },
          // Recharts
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            chunks: 'all',
            priority: 20,
          },
          // React Query
          reactQuery: {
            test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
            name: 'react-query',
            chunks: 'all',
            priority: 20,
          },
          // Common chunks
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
    }

    if (dev && !isServer) {
      // Add plugin to suppress specific errors in development
      config.plugins = config.plugins || []
      config.plugins.push(
        new (require('webpack')).DefinePlugin({
          'process.env.SUPPRESS_ROUTER_ERRORS': JSON.stringify('true'),
        })
      )
    }
    
    return config
  },
}

module.exports = nextConfig
