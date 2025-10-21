import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi, beforeAll } from 'vitest';

// Polyfill document.createTextNode for CI jsdom environment
// CI's jsdom is missing this critical API that Svelte's legacy-client needs
if (typeof document !== 'undefined' && typeof document.createTextNode !== 'function') {
  // @ts-ignore - Polyfill missing jsdom API
  document.createTextNode = function(data: string) {
    const text = document.createElement('text') as any;
    text.nodeType = 3; // TEXT_NODE
    text.nodeName = '#text';
    text.nodeValue = data;
    text.textContent = data;
    text.data = data;
    return text;
  };
}

// Mock Svelte lifecycle functions for testing
beforeAll(() => {
  vi.mock('svelte', async () => {
    const actual = await vi.importActual('svelte');
    return {
      ...actual,
      onMount: vi.fn((fn) => fn()),
      onDestroy: vi.fn(),
      mount: vi.fn(),
      beforeUpdate: vi.fn(),
      afterUpdate: vi.fn()
    };
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Error: Could not find Element with the given testid'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  });
});
