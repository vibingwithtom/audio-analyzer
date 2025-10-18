import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelAnalyzer, AnalysisCancelledError } from '@audio-analyzer/core';

/**
 * Tests for LevelAnalyzer progress callbacks and cancellation behavior
 *
 * These tests verify:
 * 1. Progress callbacks are invoked at appropriate stages
 * 2. Progress values are within expected ranges (0-1)
 * 3. Cancellation properly interrupts analysis
 * 4. AnalysisCancelledError is thrown with correct stage information
 */

describe('LevelAnalyzer - Progress Callbacks', () => {
  let analyzer;
  let mockAudioBuffer;
  let progressCallback;

  beforeEach(() => {
    analyzer = new LevelAnalyzer();
    progressCallback = vi.fn();

    // Create a mock AudioBuffer with actual data
    const sampleRate = 48000;
    const duration = 0.1; // 100ms of audio
    const length = Math.floor(sampleRate * duration);
    const channels = 2;

    mockAudioBuffer = {
      sampleRate,
      numberOfChannels: channels,
      length,
      getChannelData: vi.fn((channel) => {
        // Generate some test audio data with varying levels
        const data = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          // Generate a simple sine wave with some noise
          const t = i / sampleRate;
          data[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) + 0.01 * Math.random();
        }
        return data;
      })
    };
  });

  describe('Basic Progress Reporting', () => {
    it('should invoke progress callback during analysis', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      // Progress callback should be called multiple times
      expect(progressCallback.mock.calls.length).toBeGreaterThan(0);
    });

    it('should provide progress messages and values', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      // Check that all calls have valid structure
      progressCallback.mock.calls.forEach(call => {
        const [message, progress] = call;
        expect(typeof message).toBe('string');
        expect(typeof progress).toBe('number');
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      });
    });

    it('should report progress stages in order', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      const messages = progressCallback.mock.calls.map(call => call[0]);

      // Should contain key stages for base analysis
      expect(messages).toContain('Analyzing peak levels...');
      expect(messages).toContain('Analyzing noise floor...');
      expect(messages).toContain('Checking normalization...');
      expect(messages).toContain('Analysis complete!');
    });

    it('should have increasing progress values', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      const progressValues = progressCallback.mock.calls.map(call => call[1]);

      // Progress should generally increase (allowing for minor rounding)
      for (let i = 1; i < progressValues.length; i++) {
        // Allow small decreases due to stage transitions
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1] - 0.01);
      }
    });

    it('should end at 100% progress (1.0)', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
      expect(lastCall[1]).toBe(1.0);
      expect(lastCall[0]).toBe('Analysis complete!');
    });
  });

  describe('Experimental Analysis Progress', () => {
    it('should report additional stages when includeExperimental is true', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, true);

      const messages = progressCallback.mock.calls.map(call => call[0]);

      // Should include experimental stages
      expect(messages).toContain('Estimating reverb...');
      expect(messages).toContain('Analyzing silence...');
      // OPTIMIZATION: Peak + Clipping combined into single pass
      expect(messages).toContain('Analyzing peak levels and clipping...');
    });

    it('should not report experimental stages when includeExperimental is false', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      const messages = progressCallback.mock.calls.map(call => call[0]);

      // Should NOT include experimental stages
      expect(messages).not.toContain('Estimating reverb...');
      expect(messages).not.toContain('Analyzing silence...');
      // OPTIMIZATION: When experimental is disabled, only peak detection is done (not combined)
      expect(messages).not.toContain('Analyzing peak levels and clipping...');
    });

    it('should have more progress updates with experimental analysis', async () => {
      const progressCallbackBase = vi.fn();
      const progressCallbackExperimental = vi.fn();

      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallbackBase, false);

      // Create new analyzer for experimental
      const analyzerExperimental = new LevelAnalyzer();
      await analyzerExperimental.analyzeAudioBuffer(mockAudioBuffer, progressCallbackExperimental, true);

      // Experimental should have significantly more progress updates
      expect(progressCallbackExperimental.mock.calls.length).toBeGreaterThan(
        progressCallbackBase.mock.calls.length
      );
    });
  });

  describe('Progress Stage Allocation', () => {
    it('should respect PROGRESS_STAGES boundaries', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);

      const calls = progressCallback.mock.calls;

      // Find peak analysis calls
      const peakCalls = calls.filter(call => call[0].includes('peak'));
      if (peakCalls.length > 0) {
        peakCalls.forEach(call => {
          expect(call[1]).toBeGreaterThanOrEqual(LevelAnalyzer.PROGRESS_STAGES.PEAK_START);
          expect(call[1]).toBeLessThanOrEqual(LevelAnalyzer.PROGRESS_STAGES.PEAK_END);
        });
      }

      // Find noise floor analysis calls
      const noiseFloorCalls = calls.filter(call => call[0].includes('noise floor'));
      if (noiseFloorCalls.length > 0) {
        noiseFloorCalls.forEach(call => {
          expect(call[1]).toBeGreaterThanOrEqual(LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_START);
          expect(call[1]).toBeLessThanOrEqual(LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_END);
        });
      }
    });

    it('should use scaleProgress correctly', () => {
      const scaled = analyzer.scaleProgress(0.5, 0.2, 0.4);
      expect(scaled).toBeCloseTo(0.3, 10); // Midpoint between 0.2 and 0.4

      const scaledStart = analyzer.scaleProgress(0, 0.2, 0.4);
      expect(scaledStart).toBeCloseTo(0.2, 10);

      const scaledEnd = analyzer.scaleProgress(1, 0.2, 0.4);
      expect(scaledEnd).toBeCloseTo(0.4, 10);
    });
  });

  describe('No Progress Callback', () => {
    it('should complete analysis without progress callback', async () => {
      const result = await analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);

      expect(result).toBeDefined();
      expect(result.peakDb).toBeDefined();
      expect(result.noiseFloorDb).toBeDefined();
    });

    it('should complete analysis with undefined progress callback', async () => {
      const result = await analyzer.analyzeAudioBuffer(mockAudioBuffer, undefined, false);

      expect(result).toBeDefined();
      expect(result.peakDb).toBeDefined();
      expect(result.noiseFloorDb).toBeDefined();
    });
  });
});

describe('LevelAnalyzer - Cancellation Behavior', () => {
  let analyzer;
  let mockAudioBuffer;

  beforeEach(() => {
    analyzer = new LevelAnalyzer();

    // Create a larger mock AudioBuffer to ensure cancellation can be tested
    const sampleRate = 48000;
    const duration = 1; // 1 second of audio for more processing time
    const length = Math.floor(sampleRate * duration);
    const channels = 2;

    mockAudioBuffer = {
      sampleRate,
      numberOfChannels: channels,
      length,
      getChannelData: vi.fn((channel) => {
        const data = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) + 0.01 * Math.random();
        }
        return data;
      })
    };
  });

  describe('cancelAnalysis()', () => {
    it('should set analysisInProgress to false', () => {
      analyzer.analysisInProgress = true;
      analyzer.cancelAnalysis();
      expect(analyzer.analysisInProgress).toBe(false);
    });

    it('should throw AnalysisCancelledError when cancelled during analysis', async () => {
      // Start analysis
      const analysisPromise = analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);

      // Cancel immediately (before first cancellation check)
      analyzer.cancelAnalysis();

      // Should throw AnalysisCancelledError
      await expect(analysisPromise).rejects.toThrow(AnalysisCancelledError);
    });

    it('should include stage information in AnalysisCancelledError', async () => {
      const analysisPromise = analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);
      analyzer.cancelAnalysis();

      try {
        await analysisPromise;
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AnalysisCancelledError);
        expect(error.name).toBe('AnalysisCancelledError');
        expect(error.stage).toBeDefined();
        expect(typeof error.stage).toBe('string');
      }
    });

    it('should reset analysisInProgress after cancellation', async () => {
      const analysisPromise = analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);
      analyzer.cancelAnalysis();

      try {
        await analysisPromise;
      } catch (error) {
        // After cancellation, analysisInProgress should be false
        expect(analyzer.analysisInProgress).toBe(false);
      }
    });

    it('should reset analysisInProgress after successful analysis', async () => {
      await analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);
      expect(analyzer.analysisInProgress).toBe(false);
    });
  });

  describe('Cancellation Timing', () => {
    it('should respect CANCELLATION_CHECK_INTERVALS', () => {
      // Verify the intervals are reasonable
      expect(LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.SAMPLE_LOOP).toBe(10000);
      expect(LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.WINDOW_LOOP).toBe(1000);
      expect(LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.BLOCK_LOOP).toBe(50);
      expect(LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.ONSET_LOOP).toBe(100);
      expect(LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.CHUNK_LOOP).toBe(1000);
      expect(LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.SEGMENT_LOOP).toBe(1);
    });

    it('should cancel during peak level analysis', async () => {
      const progressCallback = vi.fn((message) => {
        // Cancel when we detect peak analysis
        if (message.includes('peak')) {
          analyzer.cancelAnalysis();
        }
      });

      await expect(
        analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false)
      ).rejects.toThrow(AnalysisCancelledError);
    });

    it('should cancel during noise floor analysis', async () => {
      const progressCallback = vi.fn((message) => {
        // Cancel when we detect noise floor analysis
        if (message.includes('noise floor')) {
          analyzer.cancelAnalysis();
        }
      });

      await expect(
        analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false)
      ).rejects.toThrow(AnalysisCancelledError);
    });

    it('should cancel during experimental analysis', async () => {
      const progressCallback = vi.fn((message) => {
        // Cancel when we detect reverb analysis
        if (message.includes('reverb')) {
          analyzer.cancelAnalysis();
        }
      });

      await expect(
        analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, true)
      ).rejects.toThrow(AnalysisCancelledError);
    });
  });

  describe('Cancellation Error Details', () => {
    it('should indicate peak-levels stage when cancelled during peak analysis', async () => {
      const progressCallback = vi.fn((message) => {
        if (message.includes('peak')) {
          analyzer.cancelAnalysis();
        }
      });

      try {
        await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.stage).toBe('peak-levels');
      }
    });

    it('should indicate noise-floor stage when cancelled during noise floor analysis', async () => {
      const progressCallback = vi.fn((message) => {
        if (message.includes('noise floor')) {
          analyzer.cancelAnalysis();
        }
      });

      try {
        await analyzer.analyzeAudioBuffer(mockAudioBuffer, progressCallback, false);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.stage).toBe('noise-floor');
      }
    });
  });

  describe('Multiple Cancellations', () => {
    it('should handle multiple cancellation calls gracefully', async () => {
      const analysisPromise = analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);

      analyzer.cancelAnalysis();
      analyzer.cancelAnalysis();
      analyzer.cancelAnalysis();

      await expect(analysisPromise).rejects.toThrow(AnalysisCancelledError);
    });

    it('should allow new analysis after cancellation', async () => {
      // First analysis - cancelled
      const firstPromise = analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);
      analyzer.cancelAnalysis();
      await expect(firstPromise).rejects.toThrow(AnalysisCancelledError);

      // Second analysis - should complete
      const secondResult = await analyzer.analyzeAudioBuffer(mockAudioBuffer, null, false);
      expect(secondResult).toBeDefined();
      expect(secondResult.peakDb).toBeDefined();
    });
  });
});

describe('LevelAnalyzer - AnalysisCancelledError', () => {
  it('should be a proper Error subclass', () => {
    const error = new AnalysisCancelledError('Test message', 'test-stage');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AnalysisCancelledError);
    expect(error.name).toBe('AnalysisCancelledError');
  });

  it('should accept message and stage parameters', () => {
    const error = new AnalysisCancelledError('Custom message', 'custom-stage');

    expect(error.message).toBe('Custom message');
    expect(error.stage).toBe('custom-stage');
  });

  it('should use default message when none provided', () => {
    const error = new AnalysisCancelledError();

    expect(error.message).toBe('Analysis was cancelled by user');
    expect(error.stage).toBe(null);
  });

  it('should have a stack trace', () => {
    const error = new AnalysisCancelledError('Test', 'test-stage');

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });
});
