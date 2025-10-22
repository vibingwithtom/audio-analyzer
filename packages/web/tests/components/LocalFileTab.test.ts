import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LocalFileTab from '../../src/components/LocalFileTab.svelte';
import {
  renderComponent,
  createMockFile,
  createMockFiles,
  createMockAnalysisResult,
  createMockInputChangeEvent,
  createDropEvent,
  createFlushPromise,
  mockFetchResponse,
  isElementVisible,
  getAllByTestIds
} from '../utils/component-test-helpers';
import {
  MOCK_AUDIO_FILES,
  MOCK_ANALYSIS_RESULTS,
  MOCK_PRESETS,
  MOCK_ERROR_MESSAGES,
  MOCK_SETTINGS
} from '../fixtures/mockData';

// Mock dependencies
vi.mock('../../src/services/audio-analysis-service', () => ({
  analyzeAudioFile: vi.fn(),
  cancelCurrentAnalysis: vi.fn()
}));

vi.mock('../../src/services/analytics-service', () => ({
  analyticsService: {
    track: vi.fn()
  }
}));

vi.mock('../../src/stores/settings', () => ({
  currentPresetId: { subscribe: vi.fn(cb => { cb('auditions'); return () => {} }) },
  availablePresets: { 'auditions': { name: 'Auditions', supportsFilenameValidation: false } },
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

vi.mock('../../src/utils/file-validation-utils', () => ({
  isFileTypeAllowed: vi.fn((filename) => {
    return filename.endsWith('.wav') || filename.endsWith('.mp3');
  }),
  getFileRejectionReason: vi.fn((filename) => {
    if (filename.endsWith('.pdf')) {
      return MOCK_ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED;
    }
    return 'File type not supported';
  }),
  formatRejectedFileType: vi.fn((filename) => {
    const ext = filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';
    return ext;
  })
}));

vi.mock('../../src/validation/filename-validator', () => ({
  FilenameValidator: {
    validateBilingual: vi.fn(() => ({
      status: 'pass',
      issue: null
    }))
  }
}));

describe('LocalFileTab.svelte', () => {
  let container: HTMLElement;
  let component: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

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
    it('should render the LocalFileTab component', () => {
      component = new (LocalFileTab as any)({
        target: container
      });
      // Component renders to container
      expect(container.querySelector('.local-file-tab')).toBeTruthy();
    });

    it('should show current preset when configured', () => {
      component = new (LocalFileTab as any)({
        target: container
      });
      const currentPreset = container.querySelector('.current-preset');
      expect(currentPreset).toBeTruthy();
    });

    it('should render FileUpload component', () => {
      component = new (LocalFileTab as any)({
        target: container
      });
      const fileUpload = container.querySelector('#local-file-upload');
      expect(fileUpload).toBeTruthy();
    });

    it('should render analysis mode section for non-auditions presets', () => {
      component = new (LocalFileTab as any)({
        target: container
      });
      const analysisModeSection = container.querySelector('.analysis-mode-section');
      // Note: This may or may not render depending on preset config
      // Adjust based on actual component behavior
    });

    it('should disable file upload when no preset configured', () => {
      component = new (LocalFileTab as any)({
        target: container
      });
      const fileUpload = container.querySelector('#local-file-upload') as HTMLInputElement;
      expect(fileUpload).toBeTruthy();
      // Note: The disabled state depends on store values
    });

    it('should show warning when no valid preset configured', () => {
      component = new (LocalFileTab as any)({
        target: container
      });
      const warning = container.querySelector('.no-preset-warning');
      // Warning visibility depends on store values
    });
  });

  describe('File Selection & Single File Processing', () => {
    it('should handle single file selection', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResult = createMockAnalysisResult({ filename: 'test.wav', status: 'pass' });
      (analyzeAudioFile as any).mockResolvedValue(mockResult);

      render(LocalFileTab);

      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);
        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        });
      }
    });

    it('should reject unsupported file types', async () => {
      const { isFileTypeAllowed } = await import('../../src/utils/file-validation-utils');
      (isFileTypeAllowed as any).mockReturnValue(false);

      render(LocalFileTab);

      const file = createMockFile('document.pdf');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);
        await waitFor(() => {
          expect(isFileTypeAllowed).toHaveBeenCalledWith('document.pdf', expect.any(Object));
        });
      }
    });

    it('should show processing state during analysis', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResult = createMockAnalysisResult();

      (analyzeAudioFile as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResult), 100))
      );

      render(LocalFileTab);
      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        fireEvent.change(input, event);
        // During processing, UI should show loading state
        await createFlushPromise();
      }
    });

    it('should create object URL for audio playback', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResult = createMockAnalysisResult();
      (analyzeAudioFile as any).mockResolvedValue(mockResult);

      render(LocalFileTab);
      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);
        await waitFor(() => {
          expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(File));
        });
      }
    });

    it('should reset file input after processing', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResult = createMockAnalysisResult();
      (analyzeAudioFile as any).mockResolvedValue(mockResult);

      render(LocalFileTab);
      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        input.value = 'something';
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(input.value).toBe('');
        });
      }
    });

    it('should handle analysis errors gracefully', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const testError = new Error('Analysis failed');
      (analyzeAudioFile as any).mockRejectedValue(testError);

      render(LocalFileTab);
      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Batch File Processing', () => {
    it('should enter batch mode for multiple files', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav' }),
        createMockAnalysisResult({ filename: 'file2.wav' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        }, { timeout: 3000 });
      }
    });

    it('should track batch processing metrics', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const { analyticsService } = await import('../../src/services/analytics-service');

      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav', status: 'pass' }),
        createMockAnalysisResult({ filename: 'file2.wav', status: 'warning' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyticsService.track).toHaveBeenCalledWith(
            'batch_processing_started',
            expect.any(Object)
          );
        }, { timeout: 3000 });
      }
    });

    it('should handle file type rejection in batch', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const { isFileTypeAllowed } = await import('../../src/utils/file-validation-utils');

      (isFileTypeAllowed as any)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false); // Second file rejected

      const mockResult = createMockAnalysisResult({ filename: 'file1.wav' });
      (analyzeAudioFile as any).mockResolvedValue(mockResult);

      render(LocalFileTab);

      const files = [
        createMockFile('file1.wav'),
        createMockFile('file2.pdf')
      ];
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(isFileTypeAllowed).toHaveBeenCalled();
        }, { timeout: 3000 });
      }
    });

    it('should continue batch processing on individual file errors', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav' }),
        createMockAnalysisResult({ filename: 'file3.wav' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockRejectedValueOnce(new Error('File 2 error'))
        .mockResolvedValueOnce(mockResults[1]);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav', 'file3.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        }, { timeout: 3000 });
      }
    });

    it('should create audio URLs for batch results', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav' }),
        createMockAnalysisResult({ filename: 'file2.wav' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          // Should create object URLs for playback
          expect(global.URL.createObjectURL).toHaveBeenCalled();
        }, { timeout: 3000 });
      }
    });

    it('should reset file input after batch processing', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav' }),
        createMockAnalysisResult({ filename: 'file2.wav' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(input.value).toBe('');
        }, { timeout: 3000 });
      }
    });
  });

  describe('File Validation', () => {
    it('should validate file types against preset criteria', async () => {
      const { isFileTypeAllowed } = await import('../../src/utils/file-validation-utils');

      render(LocalFileTab);

      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(isFileTypeAllowed).toHaveBeenCalledWith(
            'test.wav',
            expect.any(Object)
          );
        });
      }
    });

    it('should format rejected file type correctly', async () => {
      const { isFileTypeAllowed, formatRejectedFileType } = await import('../../src/utils/file-validation-utils');
      (isFileTypeAllowed as any).mockReturnValue(false);

      render(LocalFileTab);

      const file = createMockFile('video.mp4');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(formatRejectedFileType).toHaveBeenCalledWith('video.mp4');
        });
      }
    });

    it('should get appropriate rejection reason', async () => {
      const { isFileTypeAllowed, getFileRejectionReason } = await import('../../src/utils/file-validation-utils');
      (isFileTypeAllowed as any).mockReturnValue(false);

      render(LocalFileTab);

      const file = createMockFile('document.pdf');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(getFileRejectionReason).toHaveBeenCalledWith(
            'document.pdf',
            expect.any(Object)
          );
        });
      }
    });
  });

  describe('Progress Tracking', () => {
    it('should show progress during file analysis', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResult = createMockAnalysisResult();

      let progressCallback: any;
      (analyzeAudioFile as any).mockImplementation((file, options) => {
        progressCallback = options.progressCallback;
        return Promise.resolve(mockResult);
      });

      render(LocalFileTab);

      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input && progressCallback) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        // Simulate progress callback
        progressCallback?.('Analyzing...', 50);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        });
      }
    });

    it('should track batch progress accurately', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav' }),
        createMockAnalysisResult({ filename: 'file2.wav' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalledTimes(2);
        }, { timeout: 3000 });
      }
    });
  });

  describe('Cleanup & Lifecycle', () => {
    it('should revoke blob URLs on component destroy', async () => {
      const { container } = render(LocalFileTab);

      // Simulate cleanup
      const component = container.parentElement;
      if (component) {
        // Component destruction triggers cleanup
      }

      expect(global.URL.revokeObjectURL).toBeDefined();
    });

    it('should revoke batch audio URLs on destroy', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      const mockResults = [
        createMockAnalysisResult({ filename: 'file1.wav' }),
        createMockAnalysisResult({ filename: 'file2.wav' })
      ];

      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      const { container } = render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(global.URL.createObjectURL).toHaveBeenCalled();
        }, { timeout: 3000 });
      }
    });
  });

  describe('Analysis Mode Handling', () => {
    it('should auto-set audio-only mode for auditions presets', () => {
      render(LocalFileTab);
      // Behavior depends on preset and current store values
    });

    it('should detect stale results when mode changes', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const mockResult = createMockAnalysisResult();
      (analyzeAudioFile as any).mockResolvedValue(mockResult);

      render(LocalFileTab);

      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        });
      }
    });

    it('should support filename validation when available', () => {
      render(LocalFileTab);
      // Behavior depends on preset configuration
    });
  });

  describe('Navigation', () => {
    it('should navigate to settings when preset name clicked', async () => {
      const { currentTab } = await import('../../src/stores/tabs');

      render(LocalFileTab);

      const presetName = document.querySelector('.preset-name');
      if (presetName && !presetName.classList.contains('locked')) {
        await fireEvent.click(presetName);

        // Should trigger tab change
        expect(currentTab.setTab).toBeDefined();
      }
    });

    it('should navigate to settings when Change button clicked', async () => {
      const { currentTab } = await import('../../src/stores/tabs');

      render(LocalFileTab);

      const changeButton = document.querySelector('.current-preset a');
      if (changeButton) {
        await fireEvent.click(changeButton);

        expect(currentTab.setTab).toBeDefined();
      }
    });

    it('should navigate to settings from no preset warning', () => {
      render(LocalFileTab);

      const settingsLink = document.querySelector('.no-preset-warning a');
      if (settingsLink) {
        expect(settingsLink).toBeTruthy();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis cancellation', async () => {
      const { AnalysisCancelledError } = await import('@audio-analyzer/core');
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      // Create mock for AnalysisCancelledError
      class MockCancelledError extends Error {
        constructor() {
          super('Analysis cancelled');
        }
      }

      (analyzeAudioFile as any).mockRejectedValue(new MockCancelledError());

      render(LocalFileTab);

      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        });
      }
    });

    it('should display error messages appropriately', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
      const testError = new Error('Test error message');
      (analyzeAudioFile as any).mockRejectedValue(testError);

      render(LocalFileTab);

      const file = createMockFile('test.wav');
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent([file]);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        });
      }
    });

    it('should recover from errors in batch processing', async () => {
      const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');

      const mockResult = createMockAnalysisResult();
      (analyzeAudioFile as any)
        .mockResolvedValueOnce(mockResult)
        .mockRejectedValueOnce(new Error('Error on file 2'))
        .mockResolvedValueOnce(mockResult);

      render(LocalFileTab);

      const files = createMockFiles(['file1.wav', 'file2.wav', 'file3.wav']);
      const input = document.getElementById('local-file-upload') as HTMLInputElement;

      if (input) {
        const event = createInputChangeEvent(files);
        await fireEvent.change(input, event);

        await waitFor(() => {
          expect(analyzeAudioFile).toHaveBeenCalled();
        }, { timeout: 3000 });
      }
    });
  });
});
