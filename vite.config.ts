import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
    allowedHosts: [
      'pablobots.net',
      'www.pablobots.net',
      'localhost',
      '127.0.0.1'
    ],
  },
})
