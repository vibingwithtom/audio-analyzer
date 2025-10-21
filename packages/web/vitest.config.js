import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

// Create the Svelte plugin
const baseSveltePlugin = svelte({
  compilerOptions: {
    hydratable: false,
    immutable: true,
    dev: false
  },
  emitCss: false
});

// Convert to array if not already
const sveltePlugins = Array.isArray(baseSveltePlugin) ? baseSveltePlugin : [baseSveltePlugin];

// Wrap plugins to disable configureServer for test environment
const wrappedPlugins = sveltePlugins.map(plugin => {
  if (!plugin || !plugin.configureServer) return plugin;

  return {
    ...plugin,
    configureServer: undefined
  };
});

export default defineConfig({
  plugins: wrappedPlugins,
  ssr: {
    noExternal: ['@audio-analyzer/core']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**' // Exclude Playwright E2E tests (run separately)
    ],
    // Limit parallelism to reduce memory usage
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true  // Run tests in single process to prevent memory bloat
      }
    },
    // Limit concurrent tests
    maxConcurrency: 5,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.js',
        '**/*.test.ts',
        '**/*.spec.js'
      ]
    }
  },
  resolve: {
    alias: {
      '@audio-analyzer/core': path.resolve(__dirname, '../core')
    }
  }
});
