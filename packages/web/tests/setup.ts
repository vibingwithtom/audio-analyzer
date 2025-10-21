import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi, beforeAll } from 'vitest';

// Fix document.createElement returning plain objects in CI
// Something (Svelte plugin?) breaks createElement AFTER setup runs
// We need to ALWAYS wrap it to protect against this
const originalCreateElement = document.createElement;
const testDiv = originalCreateElement.call(document, 'div');

console.log('[SETUP] Initial createElement working:', !!testDiv.appendChild);
console.log('[SETUP] Initial div constructor:', testDiv.constructor.name);

// ALWAYS wrap createElement to protect against later breakage
// @ts-ignore - Override createElement to ensure all elements work
document.createElement = function(tagName: string, options?: any) {
  const element = originalCreateElement.call(document, tagName, options);

  // If element lacks appendChild, manually add DOM methods from body
  if (!element.appendChild && document.body.appendChild) {
    console.log('[CREATEELEMENT] Fixing broken element:', tagName);

    // Prototype copying doesn't work, so manually add each required method
    element.appendChild = document.body.appendChild.bind(element);
    element.removeChild = document.body.removeChild.bind(element);
    element.insertBefore = document.body.insertBefore.bind(element);
    element.replaceChild = document.body.replaceChild?.bind(element);
    element.cloneNode = document.body.cloneNode.bind(element);
    element.contains = document.body.contains.bind(element);

    // Add missing properties
    if (!element.childNodes) element.childNodes = [];
    if (!element.children) element.children = [];
    if (element.nodeType === undefined) element.nodeType = 1; // ELEMENT_NODE
    if (!element.ownerDocument) element.ownerDocument = document;
  }

  return element;
};

console.log('[SETUP] createElement wrapper installed');

// Test the wrapper
const wrappedDiv = document.createElement('div');
console.log('[SETUP] Wrapped div.appendChild exists:', typeof wrappedDiv.appendChild === 'function');
console.log('[SETUP] Wrapped div constructor:', wrappedDiv.constructor.name);

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
