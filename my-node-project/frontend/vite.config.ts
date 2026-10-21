import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiProxyTarget = process.env.WEBGIS_API_PROXY_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/health': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      // Images uploaded through the admin panel
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Playwright specs in e2e/ are run by `npm run e2e`, not by Vitest
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
