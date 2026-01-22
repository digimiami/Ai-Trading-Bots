import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Gzip compression for production builds
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files larger than 1KB
      deleteOriginFile: false, // Keep original files
      compressionOptions: {
        level: 9, // Maximum compression
      },
    }),
    // Brotli compression (better than gzip, supported by modern browsers)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // Better chunk splitting to prevent large chunks
        manualChunks: (id) => {
          // Split vendor chunks
          if (id.includes('node_modules')) {
            // CRITICAL: Keep React and React-DOM together to prevent multiple instances
            // React MUST be in its own chunk and load first
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            // React Router depends on React, so keep it separate but after React
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    // Pre-bundle React to ensure it's available immediately
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    // Force pre-bundling of React
    force: false,
    // Exclude problematic packages from optimization if needed
    exclude: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Ensure React is resolved correctly and not duplicated
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    allowedHosts: [
      'pablobots.net',
      'www.pablobots.net',
      'pablobots.com',
      'www.pablobots.com',
      'pablobots.live',
      'www.pablobots.live',
      'pablobots.online',
      'www.pablobots.online',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api/market-data': {
        target: process.env.VITE_SUPABASE_URL?.replace('/rest/v1', '') || 'https://your-project.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/market-data/, '/functions/v1/market-data'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add Supabase anon key if available
            const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
            if (anonKey) {
              proxyReq.setHeader('apikey', anonKey);
            }
          });
        },
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    outDir: 'dist',  // Serve directly from dist (no need to copy to out/)
    allowedHosts: [
      'pablobots.net',
      'www.pablobots.net',
      'pablobots.com',
      'www.pablobots.com',
      'pablobots.live',
      'www.pablobots.live',
      'pablobots.online',
      'www.pablobots.online',
      'localhost',
      '127.0.0.1'
    ],
  },
})
