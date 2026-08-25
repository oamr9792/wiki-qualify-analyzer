import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The "@" alias is required: every component imports via "@/components/...".
  // It was dropped in 50d7d90, which broke `vite build` for every commit after
  // that point — production has been serving a stale bundle ever since.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: mode === 'development'
    ? {
        host: '::',
        port: 8080,
        proxy: {
          '/api': {
            target: `http://localhost:${process.env.DEV_API_PORT || 3005}`,
            changeOrigin: true,
            secure: false
          }
        }
      }
    : undefined
}));
