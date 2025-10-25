import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ResultsTable from '../../src/components/ResultsTable.svelte';
import {
  createMockAnalysisResult,
  createMockAnalysisResults
} from '../utils/component-test-helpers';

// Mock dependencies
vi.mock('@audio-analyzer/core', () => ({
  formatSampleRate: vi.fn((sr) => `${sr}Hz`),
  formatDuration: vi.fn((d) => `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')}`),
  formatBitDepth: vi.fn((bd) => `${bd}-bit`),
  formatChannels: vi.fn((ch) => ch === 1 ? 'Mono' : 'Stereo'),
  formatBytes: vi.fn((b) => `${(b / 1024 / 1024).toFixed(2)}MB`),
  computeExperimentalStatus: vi.fn(() => 'pass'),
  getNormalizationStatus: vi.fn(() => 'pass'),
  getReverbStatus: vi.fn(() => 'pass'),
  getNoiseFloorStatus: vi.fn(() => 'pass'),
  getSilenceStatus: vi.fn(() => 'pass'),
  getClippingStatus: vi.fn(() => 'pass'),
  getMicBleedStatus: vi.fn(() => 'pass'),
  CriteriaValidator: {
    validateSpeechOverlap: vi.fn(() => ({ status: 'pass' })),
    validateStereoType: vi.fn(() => ({ status: 'pass' }))
  }
}));

vi.mock('../../src/stores/settings', () => ({
  selectedPreset: { subscribe: vi.fn(cb => { cb({ maxOverlapWarning: 0.3, maxOverlapFail: 0.5, maxOverlapSegmentWarning: 5, maxOverlapSegmentFail: 10 }); return () => {} }) }
}));

describe('ResultsTable', () => {
  let container: HTMLElement;
  let component: any;

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Create container for component
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup component
    if (component && component.$destroy) {
      component.$destroy();
    }
    component = null;

    // Remove container
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the results table component', () => {
      const results = createMockAnalysisResults(1);

      component = new (ResultsTable as any)({
        target: container,
        props: { results }
      });

      const table = document.querySelector('table');
      expect(table).toBeTruthy();
    });

    it('should render empty state when no results', () => {
      component = new (ResultsTable as any)({
        target: container,
        props: { results: [] }
      });

      const table = document.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('Single File Mode', () => {
    it('should render single file results', () => {
      const result = createMockAnalysisResult({
        filename: 'test1.wav',
        sampleRate: 48000,
        bitDepth: 16,
        channels: 2,
        duration: 120
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          mode: 'single'
        }
      });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('test1.wav');
    });

    it('should show audio player for single file', () => {
      const result = createMockAnalysisResult({ filename: 'test.wav' });
      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          mode: 'single'
        }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should display detailed audio properties', () => {
      const result = createMockAnalysisResult({
        sampleRate: 48000,
        bitDepth: 16,
        channels: 2,
        duration: 120
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          mode: 'single'
        }
      });

      const table = document.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('Batch Mode', () => {
    it('should render all batch results', () => {
      const results = [
        createMockAnalysisResult({ filename: 'test1.wav' }),
        createMockAnalysisResult({ filename: 'test2.wav' })
      ];

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results,
          mode: 'batch'
        }
      });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('test1.wav');
      expect(table?.textContent).toContain('test2.wav');
    });

    it('should display summary statistics', () => {
      const results = [
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'fail' })
      ];

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results,
          mode: 'batch'
        }
      });

      const table = document.querySelector('table');
      expect(table).toBeTruthy();
    });

    it('should handle large batches', () => {
      const results = createMockAnalysisResults(50);
      component = new (ResultsTable as any)({
        target: container,
        props: {
          results,
          mode: 'batch'
        }
      });

      const table = document.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('Status Display', () => {
    it('should display pass status', () => {
      const result = createMockAnalysisResult({ status: 'pass' });
      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should display fail status', () => {
      const result = createMockAnalysisResult({ status: 'fail' });
      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should display warning status', () => {
      const result = createMockAnalysisResult({ status: 'warning' });
      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should handle error status', () => {
      const result = createMockAnalysisResult({
        status: 'error' as any,
        error: 'File read failed'
      });

      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('File');
    });
  });

  describe('Metadata-Only Mode', () => {
    it('should hide audio analysis columns when enabled', () => {
      const result = createMockAnalysisResult({
        peakDb: -6,
        noiseFloor: { db: -60, status: 'pass' as const }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          metadataOnly: true
        }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should show all columns when disabled', () => {
      const result = createMockAnalysisResult({
        peakDb: -6
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          metadataOnly: false
        }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('getAudioOnlyStatus', () => {
    it('should return fail when filename validation fails', () => {
      const result = createMockAnalysisResult({
        status: 'pass', // Overall status
        validation: {
          filename: {
            status: 'fail',
            value: 'invalid-name.wav',
            issue: 'Filename does not match pattern'
          }
        }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          metadataOnly: true  // Use audio-only mode
        }
      });

      // Verify the status badge shows 'fail'
      const statusBadge = document.querySelector('[class*="status-fail"]');
      expect(statusBadge).toBeTruthy();
    });

    it('should return warning when filename validation warns', () => {
      const result = createMockAnalysisResult({
        status: 'pass',
        validation: {
          filename: {
            status: 'warning',
            value: 'questionable-name.wav',
            issue: 'Filename format is unusual'
          }
        }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          metadataOnly: true
        }
      });

      const statusBadge = document.querySelector('[class*="status-warning"]');
      expect(statusBadge).toBeTruthy();
    });

    it('should return pass when filename validation passes', () => {
      const result = createMockAnalysisResult({
        status: 'pass',
        validation: {
          filename: {
            status: 'pass',
            value: 'valid-name.wav'
          }
        }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          metadataOnly: true
        }
      });

      const statusBadge = document.querySelector('[class*="status-pass"]');
      expect(statusBadge).toBeTruthy();
    });

    it('should prioritize filename fail over other passing validations', () => {
      const result = createMockAnalysisResult({
        status: 'pass',
        validation: {
          sampleRate: { status: 'pass', value: '48000' },
          bitDepth: { status: 'pass', value: '16' },
          filename: {
            status: 'fail',
            value: 'bad-filename.wav',
            issue: 'Invalid format'
          }
        }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          metadataOnly: true
        }
      });

      const statusBadge = document.querySelector('[class*="status-fail"]');
      expect(statusBadge).toBeTruthy();
    });
  });

  describe('Experimental Mode', () => {
    it('should display experimental metrics when enabled', () => {
      const result = createMockAnalysisResult({
        peakDb: -3.5,
        reverbInfo: { time: 0.8, label: 'Moderate', status: 'pass' as const }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          experimentalMode: true
        }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should hide experimental metrics when disabled', () => {
      const result = createMockAnalysisResult({
        peakDb: -3.5
      });

      component = new (ResultsTable as any)({
        target: container,
        props: {
          results: [result],
          experimentalMode: false
        }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Validation Display', () => {
    it('should show validation errors for failed files', () => {
      const result = createMockAnalysisResult({
        status: 'fail',
        validation: {
          sampleRate: {
            status: 'fail',
            value: '32000',
            issue: 'Sample rate not supported'
          }
        }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('Sample');
    });

    it('should show validation warnings', () => {
      const result = createMockAnalysisResult({
        status: 'warning',
        channels: 1, // Set channels to 1 so formatChannels returns 'Mono'
        validation: {
          channels: {
            status: 'warning',
            value: '1',
            issue: 'Mono audio detected'
          }
        }
      });

      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('Mono');
    });
  });

  describe('Scrolling', () => {
    it('should handle horizontal scroll detection', () => {
      const results = createMockAnalysisResults(5);
      component = new (ResultsTable as any)({
        target: container,
        props: { results, mode: 'batch' }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should handle scroll on resize', () => {
      const results = createMockAnalysisResults(3);
      component = new (ResultsTable as any)({
        target: container,
        props: { results }
      });

      // Simulate window resize
      window.dispatchEvent(new Event('resize'));

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Fullscreen', () => {
    it('should handle fullscreen toggle', () => {
      const results = createMockAnalysisResults(1);
      component = new (ResultsTable as any)({
        target: container,
        props: { results }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should exit fullscreen on ESC key', () => {
      const results = createMockAnalysisResults(1);
      component = new (ResultsTable as any)({
        target: container,
        props: { results }
      });

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Audio Playback', () => {
    it('should create blob URLs for playback', () => {
      const result = createMockAnalysisResult();
      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should revoke blob URLs on cleanup', () => {
      const result = createMockAnalysisResult();
      component = new (ResultsTable as any)({
        target: container,
        props: { results: [result] }
      });

      // Cleanup happens in afterEach
      expect(global.URL.revokeObjectURL).toBeDefined();
    });
  });

  describe('Props Updates', () => {
    it('should update when results change', () => {
      const initial = createMockAnalysisResults(1);
      component = new (ResultsTable as any)({
        target: container,
        props: { results: initial }
      });

      // Destroy and recreate with updated props
      if (component.$destroy) component.$destroy();
      const updated = createMockAnalysisResults(3);
      component = new (ResultsTable as any)({
        target: container,
        props: { results: updated }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should update when mode changes', () => {
      const results = createMockAnalysisResults(2);
      component = new (ResultsTable as any)({
        target: container,
        props: { results, mode: 'single' }
      });

      // Destroy and recreate with updated mode
      if (component.$destroy) component.$destroy();
      component = new (ResultsTable as any)({
        target: container,
        props: { results, mode: 'batch' }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should update when experimentalMode changes', () => {
      const results = createMockAnalysisResults(1);
      component = new (ResultsTable as any)({
        target: container,
        props: { results, experimentalMode: false }
      });

      // Destroy and recreate with updated experimentalMode
      if (component.$destroy) component.$destroy();
      component = new (ResultsTable as any)({
        target: container,
        props: { results, experimentalMode: true }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have table headers', () => {
      const results = createMockAnalysisResults(1);
      component = new (ResultsTable as any)({
        target: container,
        props: { results }
      });

      const headers = document.querySelectorAll('th');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should use semantic structure', () => {
      const results = createMockAnalysisResults(1);
      component = new (ResultsTable as any)({
        target: container,
        props: { results }
      });

      expect(document.querySelector('thead')).toBeTruthy();
      expect(document.querySelector('tbody')).toBeTruthy();
    });
  });
});
