import { describe, it, expect } from 'vitest';
import {
  getNormalizationStatus,
  getReverbStatus,
  getNoiseFloorStatus,
  getSilenceStatus,
  getClippingStatus,
  getMicBleedStatus,
  computeExperimentalStatus
} from '../../src/utils/status-utils';
import type { AudioResults, ClippingAnalysis } from '../../src/types';

describe('status-utils', () => {
  describe('getNormalizationStatus', () => {
    it('should return empty string for undefined normalization', () => {
      expect(getNormalizationStatus(undefined)).toBe('');
    });

    it('should return empty string for null normalization', () => {
      expect(getNormalizationStatus(null)).toBe('');
    });

    it('should return success for normalized status', () => {
      expect(getNormalizationStatus({ status: 'normalized' })).toBe('success');
    });

    it('should return warning for non-normalized status', () => {
      expect(getNormalizationStatus({ status: 'too_loud' })).toBe('warning');
      expect(getNormalizationStatus({ status: 'too_quiet' })).toBe('warning');
    });
  });

  describe('getReverbStatus', () => {
    it('should return empty string for undefined label', () => {
      expect(getReverbStatus(undefined)).toBe('');
    });

    it('should return empty string for empty label', () => {
      expect(getReverbStatus('')).toBe('');
    });

    it('should return success for excellent reverb', () => {
      expect(getReverbStatus('Excellent - Very Low Reverberation')).toBe('success');
    });

    it('should return success for good reverb', () => {
      expect(getReverbStatus('Good - Low Reverberation')).toBe('success');
    });

    it('should return success for fair reverb', () => {
      expect(getReverbStatus('Fair - Moderate Reverberation')).toBe('success');
    });

    it('should return warning for poor reverb', () => {
      expect(getReverbStatus('Poor - High Reverberation')).toBe('warning');
    });

    it('should return error for very poor reverb', () => {
      expect(getReverbStatus('Very Poor - Excessive Reverberation')).toBe('error');
    });
  });

  describe('getNoiseFloorStatus', () => {
    it('should return empty string for undefined noise floor', () => {
      expect(getNoiseFloorStatus(undefined)).toBe('');
    });

    it('should return empty string for -Infinity noise floor', () => {
      expect(getNoiseFloorStatus(-Infinity)).toBe('');
    });

    it('should return success for excellent noise floor (≤ -60 dB)', () => {
      expect(getNoiseFloorStatus(-70)).toBe('success');
      expect(getNoiseFloorStatus(-60)).toBe('success');
    });

    it('should return warning for fair noise floor (-60 to -50 dB)', () => {
      expect(getNoiseFloorStatus(-55)).toBe('warning');
      expect(getNoiseFloorStatus(-50)).toBe('warning');
    });

    it('should return error for poor noise floor (> -50 dB)', () => {
      expect(getNoiseFloorStatus(-40)).toBe('error');
      expect(getNoiseFloorStatus(-20)).toBe('error');
    });
  });

  describe('getSilenceStatus', () => {
    it('should return empty string for undefined silence', () => {
      expect(getSilenceStatus(undefined, 'lead-trail')).toBe('');
    });

    it('should classify leading/trailing silence correctly', () => {
      expect(getSilenceStatus(2, 'lead-trail')).toBe('success'); // < 5s
      expect(getSilenceStatus(5, 'lead-trail')).toBe('warning'); // 5-9s
      expect(getSilenceStatus(7, 'lead-trail')).toBe('warning');
      expect(getSilenceStatus(10, 'lead-trail')).toBe('error'); // >= 10s
    });

    it('should classify max silence gap correctly', () => {
      expect(getSilenceStatus(2, 'max')).toBe('success'); // < 5s
      expect(getSilenceStatus(5, 'max')).toBe('warning'); // 5-9s
      expect(getSilenceStatus(7, 'max')).toBe('warning');
      expect(getSilenceStatus(10, 'max')).toBe('error'); // >= 10s
    });
  });

  describe('getClippingStatus', () => {
    it('should return empty string for undefined clipping analysis', () => {
      expect(getClippingStatus(undefined)).toBe('');
    });

    it('should return empty string for null clipping analysis', () => {
      expect(getClippingStatus(null as any)).toBe('');
    });

    it('should return success for no clipping detected', () => {
      const analysis: ClippingAnalysis = {
        clippedPercentage: 0,
        clippingEventCount: 0,
        nearClippingPercentage: 0
      };
      expect(getClippingStatus(analysis)).toBe('success');
    });

    it('should return error for hard clipping > 1%', () => {
      const analysis: ClippingAnalysis = {
        clippedPercentage: 1.5,
        clippingEventCount: 5,
        nearClippingPercentage: 0
      };
      expect(getClippingStatus(analysis)).toBe('error');
    });

    it('should return error for hard clipping > 50 events', () => {
      const analysis: ClippingAnalysis = {
        clippedPercentage: 0.5,
        clippingEventCount: 60,
        nearClippingPercentage: 0
      };
      expect(getClippingStatus(analysis)).toBe('error');
    });

    it('should return warning for hard clipping 0.1-1%', () => {
      const analysis: ClippingAnalysis = {
        clippedPercentage: 0.5,
        clippingEventCount: 5,
        nearClippingPercentage: 0
      };
      expect(getClippingStatus(analysis)).toBe('warning');
    });

    it('should return warning for hard clipping 10-50 events', () => {
      const analysis: ClippingAnalysis = {
        clippedPercentage: 0.05,
        clippingEventCount: 30,
        nearClippingPercentage: 0
      };
      expect(getClippingStatus(analysis)).toBe('warning');
    });

    it('should return warning for near clipping > 1%', () => {
      const analysis: ClippingAnalysis = {
        clippedPercentage: 0,
        clippingEventCount: 0,
        nearClippingPercentage: 1.5
      };
      expect(getClippingStatus(analysis)).toBe('warning');
    });
  });

  describe('getMicBleedStatus', () => {
    it('should return empty string for undefined mic bleed', () => {
      expect(getMicBleedStatus(undefined)).toBe('');
    });

    it('should return empty string for null mic bleed', () => {
      expect(getMicBleedStatus(null as any)).toBe('');
    });

    it('should return success when no bleed detected (old method)', () => {
      const micBleed = {
        old: {
          leftChannelBleedDb: -70,
          rightChannelBleedDb: -70
        },
        new: {
          percentageConfirmedBleed: 0
        }
      };
      expect(getMicBleedStatus(micBleed)).toBe('success');
    });

    it('should return warning when bleed detected (old method)', () => {
      const micBleed = {
        old: {
          leftChannelBleedDb: -50,
          rightChannelBleedDb: -70
        },
        new: {
          percentageConfirmedBleed: 0
        }
      };
      expect(getMicBleedStatus(micBleed)).toBe('warning');
    });

    it('should return warning when bleed detected (new method)', () => {
      const micBleed = {
        old: {
          leftChannelBleedDb: -70,
          rightChannelBleedDb: -70
        },
        new: {
          percentageConfirmedBleed: 1
        }
      };
      expect(getMicBleedStatus(micBleed)).toBe('warning');
    });

    it('should use OR logic - detect if either method detects', () => {
      const micBleed = {
        old: {
          leftChannelBleedDb: -50,
          rightChannelBleedDb: -70
        },
        new: {
          percentageConfirmedBleed: 0
        }
      };
      expect(getMicBleedStatus(micBleed)).toBe('warning');
    });
  });

  describe('computeExperimentalStatus', () => {
    const createBaseResult = (): AudioResults => ({
      filename: 'test.wav',
      status: 'pass',
      sampleRate: 48000,
      bitDepth: 16,
      channels: 2,
      duration: 10,
      fileSize: 1000
    });

    it('should return fail when file type validation fails', () => {
      const result = createBaseResult();
      result.validation = {
        fileType: { status: 'fail', value: 'invalid', issue: 'Wrong file type' }
      };
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should return fail when sample rate validation fails', () => {
      const result = createBaseResult();
      result.validation = {
        sampleRate: { status: 'fail', value: '44100', issue: 'Wrong sample rate' }
      };
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should return fail when bit depth validation fails', () => {
      const result = createBaseResult();
      result.validation = {
        bitDepth: { status: 'fail', value: '8', issue: 'Wrong bit depth' }
      };
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should return fail when channels validation fails', () => {
      const result = createBaseResult();
      result.validation = {
        channels: { status: 'fail', value: '1', issue: 'Wrong channel count' }
      };
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should preserve error status', () => {
      const result = createBaseResult();
      result.status = 'error';
      expect(computeExperimentalStatus(result)).toBe('error');
    });

    it('should return pass when all metrics pass', () => {
      const result = createBaseResult();
      result.normalizationStatus = { status: 'normalized' };
      result.noiseFloorDb = -70;
      result.reverbInfo = { label: 'Good - Low Reverberation' };
      expect(computeExperimentalStatus(result)).toBe('pass');
    });

    it('should return warning when any metric has warning', () => {
      const result = createBaseResult();
      result.normalizationStatus = { status: 'normalized' };
      result.noiseFloorDb = -55; // warning threshold
      result.reverbInfo = { label: 'Good - Low Reverberation' };
      expect(computeExperimentalStatus(result)).toBe('warning');
    });

    it('should return fail when any metric has error', () => {
      const result = createBaseResult();
      result.normalizationStatus = { status: 'normalized' };
      result.noiseFloorDb = -70;
      result.reverbInfo = { label: 'Very Poor - Excessive Reverberation' }; // error
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should handle multiple metrics - worst status wins', () => {
      const result = createBaseResult();
      result.normalizationStatus = { status: 'normalized' }; // success
      result.noiseFloorDb = -55; // warning
      result.leadingSilence = 7; // warning
      expect(computeExperimentalStatus(result)).toBe('warning');
    });

    it('should handle multiple metrics - error beats warning and success', () => {
      const result = createBaseResult();
      result.normalizationStatus = { status: 'normalized' }; // success
      result.noiseFloorDb = -55; // warning
      result.reverbInfo = { label: 'Very Poor - Excessive Reverberation' }; // error
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should handle clipping analysis', () => {
      const result = createBaseResult();
      result.clippingAnalysis = {
        clippedPercentage: 1.5,
        clippingEventCount: 5,
        nearClippingPercentage: 0
      };
      expect(computeExperimentalStatus(result)).toBe('fail');
    });

    it('should handle mic bleed analysis', () => {
      const result = createBaseResult();
      result.micBleed = {
        old: {
          leftChannelBleedDb: -50,
          rightChannelBleedDb: -70
        },
        new: {
          percentageConfirmedBleed: 0
        }
      };
      expect(computeExperimentalStatus(result)).toBe('warning');
    });

    it('should handle undefined metrics gracefully', () => {
      const result = createBaseResult();
      expect(computeExperimentalStatus(result)).toBe('pass');
    });

    it('should skip speech overlap and stereo type validation', () => {
      const result = createBaseResult();
      // These should NOT affect the computed status
      result.conversationalAnalysis = {
        overlap: {
          overlapPercentage: 50 // Would normally be error
        }
      };
      // Without explicit handling in computeExperimentalStatus, this should pass
      // (these are preset-aware validations handled by ResultsTable)
      expect(computeExperimentalStatus(result)).toBe('pass');
    });

    it('should handle complex real-world scenario', () => {
      const result = createBaseResult();
      result.normalizationStatus = { status: 'too_loud' }; // warning
      result.noiseFloorDb = -65; // success
      result.reverbInfo = { label: 'Fair - Moderate Reverberation' }; // warning
      result.leadingSilence = 2; // success
      result.trailingSilence = 2; // success
      result.longestSilence = 3; // success
      result.clippingAnalysis = {
        clippedPercentage: 0,
        clippingEventCount: 0,
        nearClippingPercentage: 0
      }; // success
      result.micBleed = {
        old: { leftChannelBleedDb: -70, rightChannelBleedDb: -70 },
        new: { percentageConfirmedBleed: 0 }
      }; // success

      expect(computeExperimentalStatus(result)).toBe('warning');
    });
  });
});
