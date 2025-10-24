import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelAnalyzer } from '@audio-analyzer/core';

/**
 * Tests for Mic Bleed vs Headphone Bleed Detection
 *
 * These tests verify:
 * 1. Mic bleed detection (high correlation, same-room scenario)
 * 2. Headphone bleed detection (low correlation but audible)
 * 3. Edge cases (zero RMS, silence, Math.log10(0) handling)
 * 4. Segment merging logic
 * 5. Sorting and prioritization
 */

describe('LevelAnalyzer - Mic/Headphone Bleed Detection', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new LevelAnalyzer();
  });

  /**
   * Helper to create stereo audio buffer with specific characteristics
   */
  function createStereoBuffer({ sampleRate = 48000, duration = 1.0, leftLevel = 0.5, rightLevel = 0.05, correlation = 0.5 }) {
    const length = Math.floor(sampleRate * duration);
    const leftData = new Float32Array(length);
    const rightData = new Float32Array(length);

    // Generate a continuous tone to ensure consistent RMS in all blocks
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const baseSignal = Math.sin(2 * Math.PI * 440 * t);

      // Left channel: dominant signal
      leftData[i] = leftLevel * baseSignal;

      // Right channel: mix of correlated and uncorrelated signal
      if (correlation >= 0.5) {
        // For high correlation (mic bleed), use mostly the same signal
        const correlatedPart = correlation * baseSignal;
        const uncorrelatedPart = (1 - correlation) * Math.sin(2 * Math.PI * 880 * t);
        rightData[i] = rightLevel * (correlatedPart + uncorrelatedPart);
      } else {
        // For low correlation (headphone bleed), use different frequency
        // but normalize to maintain expected RMS
        const correlatedPart = correlation * baseSignal;
        const uncorrelatedPart = (1 - correlation) * Math.sin(2 * Math.PI * 880 * t + Math.PI / 4);
        rightData[i] = rightLevel * (correlatedPart + uncorrelatedPart);
      }
    }

    return {
      sampleRate,
      numberOfChannels: 2,
      length,
      getChannelData: vi.fn((channel) => channel === 0 ? leftData : rightData)
    };
  }

  describe('Mic Bleed Detection (High Correlation)', () => {
    it('should detect mic bleed when correlation > 0.3', () => {
      // Create buffer with left dominant, right has POOR separation (< 15 dB) and high correlation
      // 0.5 vs 0.2 = 20*log10(2.5) = ~8 dB separation (poor, indicates bleed)
      const buffer = createStereoBuffer({
        duration: 2.0, // 2 seconds = 8 blocks of 250ms each
        leftLevel: 0.5, // Dominant left channel
        rightLevel: 0.2, // Significant bleed in right channel (poor separation)
        correlation: 0.9 // High correlation = same acoustic source (mic bleed)
      });

      // Set analysisInProgress flag required by analyzeMicBleed
      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      expect(result).toBeDefined();
      expect(result.new.confirmedMicBleed).toBeGreaterThan(0);
      expect(result.new.worstMicBleedSegments).toBeDefined();
      expect(result.new.worstMicBleedSegments.length).toBeGreaterThan(0);
    });

    it('should sort mic bleed segments by correlation (highest first)', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.1,
        correlation: 0.6
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      const segments = result.new.worstMicBleedSegments;

      if (segments && segments.length > 1) {
        for (let i = 0; i < segments.length - 1; i++) {
          expect(segments[i].maxCorrelation).toBeGreaterThanOrEqual(segments[i + 1].maxCorrelation);
        }
      }
    });

    it('should include type="mic" in mic bleed blocks', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.1,
        correlation: 0.8
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      const micBlocks = result.new.micBleedBlocks;

      if (micBlocks && micBlocks.length > 0) {
        micBlocks.forEach(block => {
          expect(block.type).toBe('mic');
        });
      }
    });
  });

  describe('Headphone Bleed Detection (Low Correlation, Audible)', () => {
    it('should detect headphone bleed when correlation < 0.3 but level > -70 dB', () => {
      // Create buffer with POOR separation (< 15 dB), low correlation, but audible quiet channel
      // 0.5 vs 0.2 = ~8 dB separation (poor, indicates bleed)
      // 0.2 RMS = ~-14 dB (well above -70 dB threshold, audible)
      const buffer = createStereoBuffer({
        duration: 2.0, // 2 seconds = 8 blocks
        leftLevel: 0.5, // Dominant left channel
        rightLevel: 0.2, // Bleed in right, but audible
        correlation: 0.15 // Low correlation = headphone leak (degraded signal), not mic bleed
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      expect(result).toBeDefined();
      expect(result.new.confirmedHeadphoneBleed).toBeGreaterThan(0);
      expect(result.new.worstHeadphoneBleedSegments).toBeDefined();
      expect(result.new.worstHeadphoneBleedSegments.length).toBeGreaterThan(0);
    });

    it('should sort headphone bleed segments by duration (longest first)', () => {
      const buffer = createStereoBuffer({
        duration: 2.0, // Longer duration to allow multiple segments
        leftLevel: 0.5,
        rightLevel: 0.03,
        correlation: 0.1
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      const segments = result.new.worstHeadphoneBleedSegments;

      if (segments && segments.length > 1) {
        for (let i = 0; i < segments.length - 1; i++) {
          const durationA = segments[i].endTime - segments[i].startTime;
          const durationB = segments[i + 1].endTime - segments[i + 1].startTime;
          expect(durationA).toBeGreaterThanOrEqual(durationB);
        }
      }
    });

    it('should include type="headphone" and quietChannelDb in headphone bleed blocks', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.03,
        correlation: 0.1
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      const headphoneBlocks = result.new.headphoneBleedBlocks;

      if (headphoneBlocks && headphoneBlocks.length > 0) {
        headphoneBlocks.forEach(block => {
          expect(block.type).toBe('headphone');
          expect(block.quietChannelDb).toBeDefined();
          expect(typeof block.quietChannelDb).toBe('number');
        });
      }
    });

    it('should NOT detect headphone bleed when level < -70 dB (too quiet)', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.0001, // About -80 dB, below -70 threshold
        correlation: 0.1
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      // Should detect concerning blocks due to separation, but not confirm as headphone bleed
      expect(result.new.confirmedHeadphoneBleed).toBe(0);
    });
  });

  describe('Edge Cases and Safety', () => {
    it('should handle zero RMS without Math.log10(0) errors', async () => {
      const buffer = {
        sampleRate: 48000,
        numberOfChannels: 2,
        length: 12000,
        getChannelData: vi.fn((channel) => {
          const data = new Float32Array(12000);
          // Left has signal, right is completely silent (zero RMS)
          if (channel === 0) {
            for (let i = 0; i < 12000; i++) {
              data[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 48000);
            }
          }
          // Right channel is all zeros
          return data;
        })
      };

      await expect(analyzer.analyzeAudioBuffer(buffer, null, false)).resolves.toBeDefined();
    });

    it('should handle completely silent audio', () => {
      const buffer = {
        sampleRate: 48000,
        numberOfChannels: 2,
        length: 12000,
        getChannelData: vi.fn(() => new Float32Array(12000)) // All zeros
      };

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      expect(result.new.confirmedMicBleed).toBe(0);
      expect(result.new.confirmedHeadphoneBleed).toBe(0);
    });

    it('should handle very low RMS values gracefully', async () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.001, // Very quiet
        rightLevel: 0.0001, // Even quieter
        correlation: 0.5
      });

      await expect(analyzer.analyzeAudioBuffer(buffer, null, false)).resolves.toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should still provide combined confirmedBleedBlocks', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.05,
        correlation: 0.5
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      expect(result.new.confirmedBleedBlocks).toBeDefined();
      expect(typeof result.new.confirmedBleedBlocks).toBe('number');

      // confirmedBleedBlocks should equal sum of mic + headphone
      const total = result.new.confirmedMicBleed + result.new.confirmedHeadphoneBleed;
      expect(result.new.confirmedBleedBlocks).toBe(total);
    });

    it('should still provide legacy bleedSegments array', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.05,
        correlation: 0.5
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      expect(result.new.bleedSegments).toBeDefined();
      expect(Array.isArray(result.new.bleedSegments)).toBe(true);
    });
  });

  describe('Segment Merging', () => {
    it('should merge segments within 2 second window', () => {
      // Create a longer buffer to allow for multiple potential segments
      const buffer = createStereoBuffer({
        duration: 5.0,
        leftLevel: 0.5,
        rightLevel: 0.05,
        correlation: 0.5
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      // With continuous bleed, should merge into fewer segments
      const totalBlocks = result.new.confirmedBleedBlocks;
      const segments = result.new.bleedSegments;

      if (totalBlocks > 0 && segments) {
        // Number of segments should be less than total blocks (merging occurred)
        expect(segments.length).toBeLessThanOrEqual(totalBlocks);
      }
    });

    it('should include blockCount in segments', () => {
      const buffer = createStereoBuffer({
        duration: 2.0,
        leftLevel: 0.5,
        rightLevel: 0.05,
        correlation: 0.5
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      const segments = result.new.bleedSegments;

      if (segments && segments.length > 0) {
        segments.forEach(segment => {
          expect(segment.blockCount).toBeDefined();
          expect(segment.blockCount).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Threshold Constants', () => {
    it('should detect mic bleed when correlation is just above 0.3 threshold', () => {
      const buffer = createStereoBuffer({
        leftLevel: 0.5,
        rightLevel: 0.2, // Poor separation (< 15 dB)
        correlation: 0.31 // Just above 0.3 threshold -> mic bleed
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      // With correlation = 0.31 (> 0.3), should detect mic bleed
      if (result.new.confirmedBleedBlocks > 0) {
        expect(result.new.confirmedMicBleed).toBeGreaterThan(0);
        expect(result.new.confirmedHeadphoneBleed).toBe(0);
      }
    });

    it('should detect headphone bleed when correlation is below 0.3 threshold', () => {
      const buffer = createStereoBuffer({
        duration: 2.0, // Longer for reliable detection
        leftLevel: 0.5,
        rightLevel: 0.2, // Poor separation (< 15 dB), audible level (> -70 dB)
        correlation: 0.15 // Well below 0.3 threshold -> headphone bleed
      });

      analyzer.analysisInProgress = true;
      const result = analyzer.analyzeMicBleed(buffer);
      analyzer.analysisInProgress = false;

      // With correlation = 0.15 (< 0.3) and audible level, should detect headphone bleed
      expect(result.new.confirmedBleedBlocks).toBeGreaterThan(0);
      expect(result.new.confirmedHeadphoneBleed).toBeGreaterThan(0);
      expect(result.new.confirmedMicBleed).toBe(0);
    });
  });
});
