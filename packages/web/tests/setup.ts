import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi, beforeAll } from 'vitest';

// Fix document.createElement returning plain objects in CI
// Store the original createElement before anything can override it
const originalCreateElement = document.createElement.bind(document);
if (typeof document.createElement !== 'function' ||
    !document.createElement('div').appendChild) {
  // @ts-ignore - Fix broken createElement
  document.createElement = function(tagName: string, options?: any) {
    const element = originalCreateElement(tagName, options);
    // If the element doesn't have appendChild, it's broken - need to fix
    if (!element.appendChild && document.body.appendChild) {
      // Clone methods from body which does work
      const proto = Object.getPrototypeOf(document.body);
      Object.setPrototypeOf(element, proto);
    }
    return element;
  };
}

// Polyfill document.createTextNode for CI jsdom environment
// CI's jsdom is missing this critical API that Svelte's legacy-client needs
if (typeof document !== 'undefined' && typeof document.createTextNode !== 'function') {
  // Try to use the global Text constructor if available (proper way)
  if (typeof Text !== 'undefined') {
    // @ts-ignore - Polyfill using native Text constructor
    document.createTextNode = function(data: string) {
      return new Text(data);
    };
  } else {
    // Fallback: Create a minimal text node implementation
    // @ts-ignore - Polyfill with custom implementation
    document.createTextNode = function(data: string) {
      return {
        nodeType: 3,
        nodeName: '#text',
        nodeValue: data,
        textContent: data,
        data: data,
        ownerDocument: document,
        parentNode: null,
        parentElement: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        cloneNode: function() {
          return document.createTextNode(data);
        },
        toString: function() {
          return data;
        }
      };
    };
  }
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
