import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import LocalFileTab from '../../src/components/LocalFileTab.svelte';

// Mock dependencies
vi.mock('../../src/services/audio-analysis-service', () => ({
  analyzeAudioFile: vi.fn(),
  cancelCurrentAnalysis: vi.fn()
}));

vi.mock('../../src/stores/settings', () => ({
  currentPresetId: { subscribe: vi.fn(cb => { cb('auditions'); return () => {} }) },
  availablePresets: { 'auditions': { name: 'Auditions' } },
  currentCriteria: { subscribe: vi.fn(cb => { cb({}); return () => {} }) },
  hasValidPresetConfig: { subscribe: vi.fn(cb => { cb(true); return () => {} }) }
}));

vi.mock('../../src/stores/tabs', () => ({
  currentTab: {
    subscribe: vi.fn(cb => { cb('local'); return () => {} }),
    setTab: vi.fn()
  }
}));

vi.mock('../../src/stores/analysisMode', () => ({
  analysisMode: { subscribe: vi.fn(cb => { cb('audio-only'); return () => {} }) },
  setAnalysisMode: vi.fn()
}));

vi.mock('../../src/stores/simplifiedMode', () => ({
  isSimplifiedMode: { subscribe: vi.fn(cb => { cb(false); return () => {} }) }
}));

describe('LocalFileTab Native Svelte 5 Tests', () => {
  let container: HTMLElement;
  let component: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (component) {
      unmount(component);
    }
    document.body.removeChild(container);
  });

  it('should mount the component', () => {
    // Try mounting with Svelte 5's native mount function
    component = mount(LocalFileTab, {
      target: container,
      props: {}
    });

    // Debug: Check if anything is rendered
    console.log('Container HTML:', container.innerHTML);
    console.log('Component:', component);

    expect(container.innerHTML).toBeTruthy();
    expect(container.querySelector('.local-file-tab')).toBeTruthy();
  });

  it('should have file upload element', () => {
    component = mount(LocalFileTab, {
      target: container,
      props: {}
    });

    // Debug: Check if anything is rendered
    console.log('Container HTML:', container.innerHTML);

    const fileInput = container.querySelector('#local-file-upload');
    expect(fileInput).toBeTruthy();
  });
});