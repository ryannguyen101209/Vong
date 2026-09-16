import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API runs separately on :4000 in dev; these proxies mean the client code
// can just fetch('/api/...') and work the same in dev and in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
