import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import fs from 'fs';

// Plugin to generate version.json during build
function versionPlugin() {
  return {
    name: 'version-plugin',
    writeBundle() {
      const version = {
        buildTime: Date.now(),
        version: new Date().toISOString()
      };

      const versionPath = path.resolve(__dirname, 'dist', 'version.json');
      fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));
      console.log('Generated version.json:', version);
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), versionPlugin()],
  root: '.',
  publicDir: 'public',
  // Base path is always '/' since beta uses subdomain (beta.audio-analyzer.tinytech.site)
  // Legacy '/beta/' path no longer used
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020'
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@audio-analyzer/core': path.resolve(__dirname, '../core')
    }
  },
  optimizeDeps: {
    exclude: ['@audio-analyzer/core']
  }
}));