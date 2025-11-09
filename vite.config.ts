import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
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