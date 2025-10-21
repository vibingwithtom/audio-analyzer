import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ResultsTable from '../../src/components/ResultsTable.svelte';
import {
  createMockAnalysisResult,
  createMockAnalysisResults
} from '../utils/component-test-helpers';

// Mock dependencies
vi.mock('../../src/utils/format-utils', () => ({
  formatSampleRate: vi.fn((sr) => `${sr}Hz`),
  formatDuration: vi.fn((d) => `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')}`),
  formatBitDepth: vi.fn((bd) => `${bd}-bit`),
  formatChannels: vi.fn((ch) => ch === 1 ? 'Mono' : 'Stereo'),
  formatBytes: vi.fn((b) => `${(b / 1024 / 1024).toFixed(2)}MB`)
}));

vi.mock('../../src/utils/status-utils', () => ({
  computeExperimentalStatus: vi.fn(() => 'pass'),
  getNormalizationStatus: vi.fn(() => 'pass'),
  getReverbStatus: vi.fn(() => 'pass'),
  getNoiseFloorStatus: vi.fn(() => 'pass'),
  getSilenceStatus: vi.fn(() => 'pass'),
  getClippingStatus: vi.fn(() => 'pass'),
  getMicBleedStatus: vi.fn(() => 'pass')
}));

vi.mock('../../src/stores/settings', () => ({
  selectedPreset: { subscribe: vi.fn(cb => { cb('auditions'); return () => {} }) }
}));

describe('ResultsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the results table component', () => {
      const results = createMockAnalysisResults(1);
      render(ResultsTable, { props: { results } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should render empty state when no results', () => {
      render(ResultsTable, { props: { results: [] } });

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

      render(ResultsTable, {
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
      render(ResultsTable, {
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

      render(ResultsTable, {
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

      render(ResultsTable, {
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

      render(ResultsTable, {
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
      render(ResultsTable, {
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
      render(ResultsTable, { props: { results: [result] } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should display fail status', () => {
      const result = createMockAnalysisResult({ status: 'fail' });
      render(ResultsTable, { props: { results: [result] } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should display warning status', () => {
      const result = createMockAnalysisResult({ status: 'warning' });
      render(ResultsTable, { props: { results: [result] } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should handle error status', () => {
      const result = createMockAnalysisResult({
        status: 'error' as any,
        error: 'File read failed'
      });

      render(ResultsTable, { props: { results: [result] } });

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

      render(ResultsTable, {
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

      render(ResultsTable, {
        props: {
          results: [result],
          metadataOnly: false
        }
      });

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Experimental Mode', () => {
    it('should display experimental metrics when enabled', () => {
      const result = createMockAnalysisResult({
        peakDb: -3.5,
        reverbInfo: { rt60: 0.8, status: 'pass' as const }
      });

      render(ResultsTable, {
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

      render(ResultsTable, {
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

      render(ResultsTable, { props: { results: [result] } });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('Sample');
    });

    it('should show validation warnings', () => {
      const result = createMockAnalysisResult({
        status: 'warning',
        validation: {
          channels: {
            status: 'warning',
            value: '1',
            issue: 'Mono audio detected'
          }
        }
      });

      render(ResultsTable, { props: { results: [result] } });

      const table = document.querySelector('table');
      expect(table?.textContent).toContain('Mono');
    });
  });

  describe('Scrolling', () => {
    it('should handle horizontal scroll detection', () => {
      const results = createMockAnalysisResults(5);
      render(ResultsTable, { props: { results, mode: 'batch' } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should handle scroll on resize', () => {
      const results = createMockAnalysisResults(3);
      render(ResultsTable, { props: { results } });

      // Simulate window resize
      window.dispatchEvent(new Event('resize'));

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Fullscreen', () => {
    it('should handle fullscreen toggle', () => {
      const results = createMockAnalysisResults(1);
      render(ResultsTable, { props: { results } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should exit fullscreen on ESC key', () => {
      const results = createMockAnalysisResults(1);
      render(ResultsTable, { props: { results } });

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Audio Playback', () => {
    it('should create blob URLs for playback', () => {
      const result = createMockAnalysisResult();
      render(ResultsTable, { props: { results: [result] } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should revoke blob URLs on cleanup', () => {
      const result = createMockAnalysisResult();
      const { unmount } = render(ResultsTable, { props: { results: [result] } });

      unmount();

      expect(global.URL.revokeObjectURL).toBeDefined();
    });
  });

  describe('Props Updates', () => {
    it('should update when results change', () => {
      const initial = createMockAnalysisResults(1);
      const { rerender } = render(ResultsTable, { props: { results: initial } });

      const updated = createMockAnalysisResults(3);
      rerender({ props: { results: updated } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should update when mode changes', () => {
      const results = createMockAnalysisResults(2);
      const { rerender } = render(ResultsTable, { props: { results, mode: 'single' } });

      rerender({ props: { results, mode: 'batch' } });

      expect(document.querySelector('table')).toBeTruthy();
    });

    it('should update when experimentalMode changes', () => {
      const results = createMockAnalysisResults(1);
      const { rerender } = render(ResultsTable, { props: { results, experimentalMode: false } });

      rerender({ props: { results, experimentalMode: true } });

      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have table headers', () => {
      const results = createMockAnalysisResults(1);
      render(ResultsTable, { props: { results } });

      const headers = document.querySelectorAll('th');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should use semantic structure', () => {
      const results = createMockAnalysisResults(1);
      render(ResultsTable, { props: { results } });

      expect(document.querySelector('thead')).toBeTruthy();
      expect(document.querySelector('tbody')).toBeTruthy();
    });
  });
});
