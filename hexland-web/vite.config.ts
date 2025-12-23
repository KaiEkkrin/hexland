import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

// Plugin to copy static landing page to build output
const copyLandingPage = () => ({
  name: 'copy-landing-page',
  closeBundle() {
    try {
      copyFileSync(
        resolve(__dirname, 'landing-index.html'),
        resolve(__dirname, 'build/index.html')
      );
      console.log('Static landing page copied to build/index.html');
    } catch (err) {
      console.error('Failed to copy landing page:', err);
    }
  }
});

export default defineConfig({
  plugins: [react(), copyLandingPage()],
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
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
});
