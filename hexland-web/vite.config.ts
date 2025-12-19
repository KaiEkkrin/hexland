import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    proxy: {
      // Replaces setupProxy.js - proxy Firebase reserved URLs to emulator
      '/__': {
        target: 'http://localhost:3400',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
  },
});
