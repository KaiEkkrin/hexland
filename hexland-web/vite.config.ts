import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import packageJson from './package.json';

// Get Git commit hash (first 8 characters)
const getGitCommitHash = (): string => {
  try {
    const fullHash = execSync('git rev-parse HEAD').toString().trim();
    return fullHash.substring(0, 8);
  } catch (err) {
    console.warn('Failed to get Git commit hash:', err);
    return 'unknown';
  }
};

const gitCommitHash = getGitCommitHash();
const versionString = `v${packageJson.version}+${gitCommitHash}`;

// Plugin to copy static landing page to build output with version replacement
const copyLandingPage = () => ({
  name: 'copy-landing-page',
  closeBundle() {
    try {
      const sourcePath = resolve(__dirname, 'landing-index.html');
      const destPath = resolve(__dirname, 'build/index.html');

      // Read the landing page HTML
      let html = readFileSync(sourcePath, 'utf-8');

      // Replace version placeholder with actual version
      html = html.replace(/v0\.0\.0/g, versionString);

      // Write to build directory
      writeFileSync(destPath, html, 'utf-8');

      console.log(`Static landing page copied to build/index.html (version: ${versionString})`);
    } catch (err) {
      console.error('Failed to copy landing page:', err);
    }
  }
});

export default defineConfig({
  plugins: [react(), copyLandingPage()],
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommitHash),
  },
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
