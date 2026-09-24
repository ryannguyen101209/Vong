import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

// `npm run demo` builds a self-contained static copy with no backend: the API
// module is replaced by an in-browser stand-in. Normal builds are untouched.
const DEMO = process.env.VONG_DEMO === '1' && !process.env.VITE_API_BASE_URL;

// The API runs separately on :4000 in dev; these proxies mean the client code
// can just fetch('/api/...') and work the same in dev and in production.
/** In a demo build, every import of lib/api.js resolves to lib/api.demo.js. */
const demoApiPlugin = {
  name: 'vong-demo-api',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!source.includes('lib/api.js')) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    const resolvedId = resolved?.id.replaceAll('\\', '/');
    const realApiId = path.resolve(here, 'src/lib/api.js').replaceAll('\\', '/');
    return resolvedId === realApiId
      ? path.resolve(here, 'src/lib/api.demo.js')
      : null;
  },
};

export default defineConfig({
  plugins: DEMO ? [demoApiPlugin, react()] : [react()],
  base: '/',
  define: {
    __VONG_DEMO__: JSON.stringify(DEMO),
    __VONG_MEMORY_ROUTER__: JSON.stringify(process.env.VONG_MEMORY_ROUTER === '1'),
  },
  build: DEMO ? { outDir: 'dist-demo', emptyOutDir: true } : {},
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
