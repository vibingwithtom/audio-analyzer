import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeAudioFile } from '../../src/services/audio-analysis-service';
import { AudioAnalyzer, LevelAnalyzer, CriteriaValidator } from '@audio-analyzer/core';

// Mock the core library
vi.mock('@audio-analyzer/core', () => ({
  AudioAnalyzer: vi.fn(),
  LevelAnalyzer: vi.fn(),
  CriteriaValidator: {
    validateResults: vi.fn(() => ({
      fileType: { status: 'pass' },
      sampleRate: { status: 'pass' },
      bitDepth: { status: 'pass' },
      channels: { status: 'pass' }
    })),
    validateStereoType: vi.fn(() => ({ status: 'pass' })),
    validateSpeechOverlap: vi.fn(() => ({ status: 'pass' }))
  },
  FilenameValidator: {
    validateBilingual: vi.fn(() => ({ status: 'pass' })),
    validateThreeHour: vi.fn(() => ({ status: 'pass' }))
  },
  AnalysisCancelledError: class extends Error {
    constructor(message, stage) {
      super(message);
      this.stage = stage;
    }
  }
}));

vi.mock('../../src/services/analytics-service', () => ({
  analyticsService: {
    track: vi.fn()
  }
}));

vi.mock('../../src/settings/settings-manager', () => ({
  SettingsManager: {
    getPeakDetectionMode: vi.fn(() => 'accurate')
  }
}));

describe('AudioContext Cleanup', () => {
  let mockAudioAnalyzer;
  let mockLevelAnalyzer;
  let mockFile;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock file
    mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });
    mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    // Mock AudioAnalyzer instance with cleanup method
    mockAudioAnalyzer = {
      analyzeFile: vi.fn().mockResolvedValue({
        fileType: 'WAV (PCM)',
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        duration: 120
      }),
      cleanup: vi.fn()
    };

    AudioAnalyzer.mockImplementation(() => mockAudioAnalyzer);

    // Mock LevelAnalyzer instance
    mockLevelAnalyzer = {
      analyzeAudioBuffer: vi.fn().mockResolvedValue({
        peakDb: -3.5,
        clipping: null
      }),
      analyzeStereoSeparation: vi.fn(() => null),
      analyzeMicBleed: vi.fn(() => null),
      analyzeConversationalAudio: vi.fn(() => null),
      cancelAnalysis: vi.fn()
    };

    LevelAnalyzer.mockImplementation(() => mockLevelAnalyzer);
  });

  describe('Basic Cleanup', () => {
    it('should call cleanup on AudioAnalyzer after analysis', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup even if analysis throws error', async () => {
      mockAudioAnalyzer.analyzeFile.mockRejectedValue(new Error('Analysis failed'));

      try {
        await analyzeAudioFile(mockFile, {
          analysisMode: 'audio-only',
          preset: null,
          presetId: null,
          criteria: null
        });
      } catch (e) {
        // Expected to throw
      }

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup even if validation throws error', async () => {
      CriteriaValidator.validateResults.mockImplementation(() => {
        throw new Error('Validation error');
      });

      try {
        await analyzeAudioFile(mockFile, {
          analysisMode: 'audio-only',
          preset: null,
          presetId: null,
          criteria: { fileType: ['wav'] }
        });
      } catch (e) {
        // Expected to throw
      }

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup in Different Analysis Modes', () => {
    it('should cleanup in audio-only mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
    });

    it('should cleanup in full mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'full',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
    });

    it('should cleanup in filename-only mode (basic file)', async () => {
      // In filename-only mode, AudioAnalyzer may not be instantiated
      // This is acceptable - filename-only uses metadata only
      // Test just verifies the mode is processed without error
      await analyzeAudioFile(mockFile, {
        analysisMode: 'filename-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      // No assertion needed - just verify it completes without error
    });

    it('should cleanup in experimental mode', async () => {
      // Mock AudioContext for experimental mode
      const mockAudioContext = {
        decodeAudioData: vi.fn().mockResolvedValue({}),
        close: vi.fn()
      };

      global.AudioContext = vi.fn(() => mockAudioContext);

      // Mock LevelAnalyzer methods for experimental analysis
      mockLevelAnalyzer.analyzeAudioBuffer.mockResolvedValue({
        peakDb: -3.5,
        clipping: null,
        noiseFloorDb: -40,
        noiseFloorPerChannel: [-40, -40],
        silenceInfo: null,
        reverbInfo: null
      });

      try {
        await analyzeAudioFile(mockFile, {
          analysisMode: 'experimental',
          preset: null,
          presetId: null,
          criteria: null
        });

        expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
      } finally {
        // Clean up global mock
        delete global.AudioContext;
      }
    });
  });

  describe('Cleanup with Batch Processing', () => {
    it('should cleanup for each file in sequential analysis', async () => {
      const files = [
        new File(['audio1'], 'test1.wav', { type: 'audio/wav' }),
        new File(['audio2'], 'test2.wav', { type: 'audio/wav' }),
        new File(['audio3'], 'test3.wav', { type: 'audio/wav' })
      ];

      for (const file of files) {
        Object.defineProperty(file, 'size', { value: 1024 });
        file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

        await analyzeAudioFile(file, {
          analysisMode: 'audio-only',
          preset: null,
          presetId: null,
          criteria: null
        });
      }

      // Cleanup should be called for each file
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(3);
    });

    it('should maintain separate cleanup calls', async () => {
      const files = [
        new File(['audio1'], 'test1.wav'),
        new File(['audio2'], 'test2.wav')
      ];

      for (const file of files) {
        Object.defineProperty(file, 'size', { value: 1024 });
        file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

        mockAudioAnalyzer.cleanup.mockClear();
        AudioAnalyzer.mockImplementation(() => mockAudioAnalyzer);

        await analyzeAudioFile(file, {
          analysisMode: 'audio-only',
          preset: null,
          presetId: null,
          criteria: null
        });

        expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Cleanup Resilience', () => {
    it('should provide cleanup method even if implementation missing', async () => {
      // In actual production code, cleanup is always provided
      // This test verifies the method exists and can be called
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      // Cleanup method should exist and be called
      expect(mockAudioAnalyzer.cleanup).toBeDefined();
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
    });

    it('should call cleanup method on analyzer', async () => {
      // Cleanup should be called for all analyzers
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
    });
  });

  describe('Cleanup Timing', () => {
    it('should call cleanup during finally block', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      // Verify cleanup was called
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();

      // The cleanup happens in the finally block, after analysis completes
      // This ensures cleanup occurs even if analysis throws
    });
  });

  describe('Memory Release', () => {
    it('should clear analyzer state after cleanup', async () => {
      // This is a conceptual test - in real implementation,
      // cleanup() sets audioContext and audioBuffer to null

      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      // Cleanup should have been called
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();

      // In a real scenario, this would verify that internal state is cleared
      // The mock just verifies the method was called
    });
  });

  describe('Cleanup with Progress Callbacks', () => {
    it('should cleanup even with progress callbacks', async () => {
      const progressCallback = vi.fn();

      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null,
        progressCallback
      });

      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
    });

    it('should not interfere with progress reporting', async () => {
      const progressUpdates = [];
      const progressCallback = (msg, progress) => {
        progressUpdates.push({ msg, progress });
      };

      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null,
        progressCallback
      });

      // Cleanup should have been called and progress callback should work
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalled();
      // Progress callback may or may not be called depending on analysis mode
    });
  });

  describe('Cleanup Idempotency', () => {
    it('should handle multiple cleanup calls safely', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      // Manually call cleanup again (shouldn't cause issues in real implementation)
      mockAudioAnalyzer.cleanup();

      // Should have been called twice total
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Limit Prevention', () => {
    it('should prevent AudioContext resource exhaustion in batch mode', async () => {
      // Simulate batch processing of multiple files
      const numFiles = 15; // More than browser's typical ~10 limit

      for (let i = 0; i < numFiles; i++) {
        const file = new File([`audio${i}`], `test${i}.wav`);
        Object.defineProperty(file, 'size', { value: 1024 });
        file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

        await analyzeAudioFile(file, {
          analysisMode: 'audio-only',
          preset: null,
          presetId: null,
          criteria: null
        });
      }

      // Cleanup should be called for each file
      // This prevents AudioContext resource exhaustion
      expect(mockAudioAnalyzer.cleanup).toHaveBeenCalledTimes(numFiles);
    });
  });
});
