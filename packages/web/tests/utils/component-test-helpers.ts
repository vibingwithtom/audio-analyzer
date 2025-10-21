/**
 * Component Testing Helpers
 *
 * Utilities for testing Svelte components consistently across the test suite
 */

import { render, RenderOptions } from '@testing-library/svelte';
import type { ComponentType } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { vi } from 'vitest';

/**
 * Extended render options for Svelte components
 */
export interface ComponentTestOptions<T> extends Omit<RenderOptions, 'component'> {
  component: ComponentType;
  props?: T;
}

/**
 * Render a Svelte component with default test configuration
 */
export function renderComponent<T>(
  component: ComponentType,
  props?: T,
  options?: Omit<RenderOptions, 'component'>
) {
  return render(component, { props, ...options });
}

/**
 * Create a mock Svelte store for testing
 */
export function createMockStore<T>(initialValue: T): Writable<T> {
  return writable(initialValue);
}

/**
 * Create mock file objects for testing file uploads
 */
export function createMockFile(
  name: string,
  size: number = 1024,
  type: string = 'audio/wav'
): File {
  const blob = new Blob(['a'.repeat(size)], { type });
  return new File([blob], name, { type });
}

/**
 * Create multiple mock files
 */
export function createMockFiles(
  names: string[],
  size: number = 1024
): File[] {
  return names.map(name => createMockFile(name, size));
}

/**
 * Mock audio analysis results for testing
 */
export interface MockAnalysisResult {
  filename: string;
  status: 'pass' | 'fail' | 'warning';
  duration?: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  errors?: string[];
}

export function createMockAnalysisResult(
  overrides?: Partial<MockAnalysisResult>
): MockAnalysisResult {
  return {
    filename: 'test.wav',
    status: 'pass',
    duration: 120,
    sampleRate: 48000,
    bitDepth: 16,
    channels: 2,
    errors: [],
    ...overrides,
  };
}

/**
 * Mock analysis results batch
 */
export function createMockAnalysisResults(
  count: number,
  overrides?: Partial<MockAnalysisResult>
): MockAnalysisResult[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAnalysisResult({
      filename: `test-${i + 1}.wav`,
      ...overrides,
    })
  );
}

/**
 * Mock audio settings/criteria
 */
export interface MockAudioCriteria {
  preset?: string;
  fileType?: string[];
  sampleRate?: number[];
  bitDepth?: number[];
  channels?: number[];
}

export function createMockCriteria(
  overrides?: Partial<MockAudioCriteria>
): MockAudioCriteria {
  return {
    preset: 'auditions',
    fileType: ['wav', 'mp3'],
    sampleRate: [48000],
    bitDepth: [16, 24],
    channels: [1, 2],
    ...overrides,
  };
}

/**
 * Mock Google Drive file object
 */
export interface MockGoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
}

export function createMockGoogleDriveFile(
  overrides?: Partial<MockGoogleDriveFile>
): MockGoogleDriveFile {
  return {
    id: 'drive-file-123',
    name: 'test.wav',
    mimeType: 'audio/wav',
    size: 1024000,
    webViewLink: 'https://drive.google.com/file/d/123/view',
    ...overrides,
  };
}

/**
 * Mock localStorage for testing settings persistence
 */
export function createMockLocalStorage() {
  const store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };
}

/**
 * Mock window.alert and window.confirm
 */
export function mockWindowDialogs() {
  return {
    alert: vi.fn(),
    confirm: vi.fn(() => true),
    prompt: vi.fn(() => 'test'),
  };
}

/**
 * Create a mock FileReader for testing
 */
export function createMockFileReader() {
  return {
    readAsArrayBuffer: vi.fn(),
    readAsDataURL: vi.fn(),
    readAsText: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    abort: vi.fn(),
    result: new ArrayBuffer(0),
    error: null,
    readyState: 0,
    onload: null,
    onerror: null,
    onprogress: null,
    onabort: null,
  };
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test helper: Get all elements with data-testid
 */
export function getAllByTestIds(container: Element, ids: string[]): Element[] {
  return ids.map(id => {
    const element = container.querySelector(`[data-testid="${id}"]`);
    if (!element) {
      throw new Error(`Element with data-testid="${id}" not found`);
    }
    return element;
  });
}

/**
 * Test helper: Simulate file drop
 */
export function createDropEvent(files: File[]) {
  const dataTransfer = {
    dropEffect: 'none' as const,
    effectAllowed: 'all' as const,
    files,
    items: files.map(file => ({
      kind: 'file' as const,
      type: file.type,
      getAsFile: () => file,
    })),
    types: ['Files'],
    getData: vi.fn(),
    setData: vi.fn(),
    clearData: vi.fn(),
    setDragImage: vi.fn(),
  };

  return new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer as any,
  });
}

/**
 * Test helper: Simulate file input change
 */
export function createInputChangeEvent(files: File[]) {
  const input = document.createElement('input');
  input.type = 'file';

  // Create a DataTransfer object to simulate file selection
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));
  input.files = dataTransfer.files;

  const event = new Event('change', { bubbles: true });
  Object.defineProperty(event, 'target', {
    value: input,
    enumerable: true,
  });

  return event;
}

/**
 * Test helper: Create a Promise that resolves after component updates
 */
export function createFlushPromise() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Test helper: Mock fetch responses
 */
export function mockFetchResponse<T>(data: T, status: number = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

/**
 * Test helper: Check if element is visible
 */
export function isElementVisible(element: Element | null): boolean {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * Test helper: Get all event listeners attached to element
 */
export function getElementEventListeners(element: Element) {
  // This is a simplified version - actual implementation would need to track listeners
  return {
    click: true,
    change: true,
    input: true,
  };
}
