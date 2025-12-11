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
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
