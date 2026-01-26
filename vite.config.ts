// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,           // Frontend port
    strictPort: true,     // If 3000 is busy, Vite will error instead of picking another
    host: true,           // Optional: allows access via localhost and network IP
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});