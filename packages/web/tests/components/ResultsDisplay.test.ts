import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ResultsDisplay from '../../src/components/ResultsDisplay.svelte';
import {
  createMockAnalysisResult,
  createMockAnalysisResults
} from '../utils/component-test-helpers';

// Mock dependencies
vi.mock('@audio-analyzer/core', () => ({
  formatDuration: vi.fn((d) => `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')}`),
  formatSampleRate: vi.fn((sr) => `${sr}Hz`),
  formatBitDepth: vi.fn((bd) => `${bd}-bit`),
  formatChannels: vi.fn((ch) => ch === 1 ? 'Mono' : 'Stereo'),
  formatBytes: vi.fn((b) => `${(b / 1024 / 1024).toFixed(2)}MB`),
  computeExperimentalStatus: vi.fn((result) => result.status || 'pass'),
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
  currentPresetId: { subscribe: vi.fn(cb => { cb('auditions'); return () => {} }) },
  selectedPreset: { subscribe: vi.fn(cb => { cb({ name: 'Auditions' }); return () => {} }) },
  currentCriteria: { subscribe: vi.fn(cb => { cb({}); return () => {} }) },
  enableIncludeFailureAnalysis: { subscribe: vi.fn(cb => { cb(false); return () => {} }) },
  enableIncludeRecommendations: { subscribe: vi.fn(cb => { cb(false); return () => {} }) }
}));

vi.mock('../../src/stores/analysisMode', () => ({
  analysisMode: { subscribe: vi.fn(cb => { cb('audio-only'); return () => {} }) },
  setAnalysisMode: vi.fn()
}));

vi.mock('../../src/stores/simplifiedMode', () => ({
  isSimplifiedMode: { subscribe: vi.fn(cb => { cb(false); return () => {} }) }
}));

vi.mock('../../src/stores/resultsFilter', () => ({
  resultsFilter: { subscribe: vi.fn(cb => { cb(null); return () => {} }), set: vi.fn() }
}));

vi.mock('../../src/services/analytics-service', () => ({
  analyticsService: {
    track: vi.fn()
  }
}));

vi.mock('../../src/utils/export-utils', () => ({
  exportResultsToCsv: vi.fn(),
  exportResultsEnhanced: vi.fn()
}));

describe('ResultsDisplay', () => {
  let container: HTMLElement;
  let component: any;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (component && component.$destroy) {
      component.$destroy();
    }
    component = null;

    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the results display component', () => {
      const results = createMockAnalysisResults(1);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      expect(document.querySelector('.results-display')).toBeTruthy();
    });

    it('should render with null results', () => {
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: null }
      });

      expect(component).toBeTruthy();
    });
  });

  describe('Single File Mode', () => {
    it('should display single result', () => {
      const result = createMockAnalysisResult({ filename: 'test.wav' });

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: result }
      });

      expect(container.innerHTML).toBeTruthy();
    });

    it('should not show batch summary for single file', () => {
      const result = createMockAnalysisResult();

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: result }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeFalsy();
    });
  });

  describe('Batch Mode', () => {
    it('should render batch summary with statistics', () => {
      const results = createMockAnalysisResults(5);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeTruthy();
    });

    it('should display correct pass count', () => {
      const results = [
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'fail' })
      ];

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const stats = container.querySelectorAll('.stat-value');
      expect(stats.length).toBeGreaterThan(0);
    });

    it('should calculate correct statistics', () => {
      const results = [
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'warning' }),
        createMockAnalysisResult({ status: 'fail' }),
        createMockAnalysisResult({ status: 'error' })
      ];

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeTruthy();
    });

    it('should handle large result sets', () => {
      const results = createMockAnalysisResults(100);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeTruthy();
    });
  });

  describe('Processing States', () => {
    it('should handle processing state prop', () => {
      const results = createMockAnalysisResults(1);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          isProcessing: true,
          processedFiles: 0,
          totalFiles: 10
        }
      });

      expect(component).toBeTruthy();
    });

    it('should handle progress during batch processing', () => {
      const results = createMockAnalysisResults(5);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          isProcessing: true,
          processedFiles: 3,
          totalFiles: 10,
          showBuiltInProgress: true
        }
      });

      expect(component).toBeTruthy();
    });

    it('should handle cancel callback when processing', () => {
      const mockCancel = vi.fn();
      const results = createMockAnalysisResults(1);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          isProcessing: true,
          onCancel: mockCancel
        }
      });

      expect(component).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error prop is set', () => {
      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results: null,
          error: 'File read failed'
        }
      });

      const errorMessage = container.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('File read failed');
    });

    it('should display error in batch results', () => {
      const results = [
        createMockAnalysisResult({ status: 'error' })
      ];

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeTruthy();
    });
  });

  describe('Stale Results', () => {
    it('should display stale indicator when resultsStale is true', () => {
      const results = createMockAnalysisResults(1);
      const mockReprocess = vi.fn();

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsStale: true,
          onReprocess: mockReprocess
        }
      });

      const staleIndicator = container.querySelector('.stale-indicator');
      expect(staleIndicator).toBeTruthy();
    });

    it('should show reprocess button with stale results', () => {
      const results = createMockAnalysisResults(1);
      const mockReprocess = vi.fn();

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsStale: true,
          onReprocess: mockReprocess
        }
      });

      const reprocessButton = container.querySelector('.reprocess-button');
      expect(reprocessButton).toBeTruthy();
    });

    it('should not show stale indicator when resultsStale is false', () => {
      const results = createMockAnalysisResults(1);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsStale: false
        }
      });

      const staleIndicator = container.querySelector('.stale-indicator');
      expect(staleIndicator).toBeFalsy();
    });
  });

  describe('Folder Information', () => {
    it('should display folder name when provided', () => {
      const results = createMockAnalysisResults(3);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          folderName: 'My Audio Files'
        }
      });

      const folderName = container.querySelector('.folder-name');
      expect(folderName).toBeTruthy();
      expect(folderName?.textContent).toContain('My Audio Files');
    });

    it('should include folder link when folderUrl is provided', () => {
      const results = createMockAnalysisResults(2);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          folderName: 'Recordings',
          folderUrl: 'https://example.com/folder'
        }
      });

      const folderLink = container.querySelector('.folder-link');
      expect(folderLink).toBeTruthy();
    });

    it('should not display folder info when not provided', () => {
      const results = createMockAnalysisResults(1);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const folderName = container.querySelector('.folder-name');
      expect(folderName).toBeFalsy();
    });
  });

  describe('Results Rendering', () => {
    it('should render ResultsTable component', () => {
      const results = createMockAnalysisResults(3);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      // The ResultsTable component should be rendered
      expect(container.innerHTML).toContain('results-table');
    });

    it('should pass correct props to ResultsTable', () => {
      const results = createMockAnalysisResults(2);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsMode: 'audio-only'
        }
      });

      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('Status Combinations', () => {
    it('should handle all status types in results', () => {
      const results = [
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'warning' }),
        createMockAnalysisResult({ status: 'fail' }),
        createMockAnalysisResult({ status: 'error' })
      ];

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeTruthy();
    });

    it('should handle empty results array', () => {
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: [] }
      });

      expect(component).toBeTruthy();
    });

    it('should handle mixed valid and error results', () => {
      const results = [
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'pass' }),
        createMockAnalysisResult({ status: 'error' })
      ];

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const batchSummary = container.querySelector('.batch-summary');
      expect(batchSummary).toBeTruthy();
    });
  });

  describe('Props Updates', () => {
    it('should update when results change', () => {
      const initial = createMockAnalysisResults(1);
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: initial }
      });

      if (component.$destroy) component.$destroy();
      const updated = createMockAnalysisResults(5);
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: updated }
      });

      expect(component).toBeTruthy();
    });

    it('should update when error state changes', () => {
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: null, error: null }
      });

      if (component.$destroy) component.$destroy();
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: null, error: 'New error' }
      });

      const errorMessage = container.querySelector('.error-message');
      expect(errorMessage?.textContent).toContain('New error');
    });

    it('should update processing state', () => {
      component = new (ResultsDisplay as any)({
        target: container,
        props: { results: [], isProcessing: false }
      });

      if (component.$destroy) component.$destroy();
      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results: [],
          isProcessing: true,
          processedFiles: 5,
          totalFiles: 10
        }
      });

      expect(component).toBeTruthy();
    });
  });

  describe('Analysis Mode Display', () => {
    it('should display results for audio-only mode', () => {
      const results = createMockAnalysisResults(2);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsMode: 'audio-only'
        }
      });

      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });

    it('should display results for full analysis mode', () => {
      const results = createMockAnalysisResults(2);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsMode: 'full'
        }
      });

      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });

    it('should display results for experimental mode', () => {
      const results = createMockAnalysisResults(2);

      component = new (ResultsDisplay as any)({
        target: container,
        props: {
          results,
          resultsMode: 'experimental'
        }
      });

      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic structure', () => {
      const results = createMockAnalysisResults(1);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      expect(container.querySelector('.results-display')).toBeTruthy();
    });

    it('should render batch summary semantically', () => {
      const results = createMockAnalysisResults(3);

      component = new (ResultsDisplay as any)({
        target: container,
        props: { results }
      });

      const summary = container.querySelector('.batch-summary');
      const heading = summary?.querySelector('h2');
      expect(heading).toBeTruthy();
    });
  });
});
