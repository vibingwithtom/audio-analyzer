import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      hot: !process.env.VITEST,
      compilerOptions: {
        dev: true,
        compatibility: {
          componentApi: 4  // Enable Svelte 4 component API for testing
        }
      }
    })
  ],
  test: {
    // Transform @testing-library/svelte despite being in node_modules
    transformMode: {
      ssr: ['/node_modules/@testing-library/svelte/'],
      web: ['/src/', '/tests/']
    },
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
