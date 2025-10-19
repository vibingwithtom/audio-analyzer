import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAudioFile } from '../../src/services/audio-analysis-service';
import { AudioAnalyzer, LevelAnalyzer, CriteriaValidator } from '@audio-analyzer/core';
import { FilenameValidator } from '../../src/validation/filename-validator';

// Mock the core modules
vi.mock('@audio-analyzer/core', () => ({
  AudioAnalyzer: vi.fn(),
  LevelAnalyzer: vi.fn(),
  CriteriaValidator: {
    validateResults: vi.fn()
  },
  AnalysisCancelledError: class extends Error {
    constructor(message, stage) {
      super(message);
      this.name = 'AnalysisCancelledError';
      this.stage = stage;
    }
  }
}));

vi.mock('../../src/validation/filename-validator', () => ({
  FilenameValidator: {
    validateBilingual: vi.fn()
  }
}));

// Mock the analytics service
vi.mock('../../src/services/analytics-service', () => ({
  analyticsService: {
    track: vi.fn()
  }
}));

/**
 * Tests for audio-analysis-service.ts
 *
 * This service is the central analysis logic used by:
 * - LocalFileTab
 * - GoogleDriveTab
 * - BoxTab (future)
 *
 * Critical bugs found during Phase 5.11:
 * 1. Wrong method name (analyze vs analyzeFile)
 * 2. Missing criteria parameter (preset.criteria doesn't exist)
 */

describe('audio-analysis-service', () => {
  let mockAudioAnalyzer;
  let mockLevelAnalyzer;
  let mockFile;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock File object
    mockFile = new File(['test content'], 'test.wav', { type: 'audio/wav' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });
    // Add arrayBuffer method for experimental mode tests
    mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    // Mock AudioAnalyzer instance
    mockAudioAnalyzer = {
      analyzeFile: vi.fn().mockResolvedValue({
        fileType: 'WAV (PCM)',
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        duration: 120
      })
    };

    AudioAnalyzer.mockImplementation(() => mockAudioAnalyzer);

    // Mock LevelAnalyzer instance
    mockLevelAnalyzer = {
      analyzeAudioBuffer: vi.fn().mockResolvedValue({
        peakDb: -3.5,
        noiseFloorDb: -60,
        noiseFloorPerChannel: [
          { channelIndex: 0, channelName: 'left', noiseFloorDb: -60 },
          { channelIndex: 1, channelName: 'right', noiseFloorDb: -62 }
        ],
        hasDigitalSilence: false,
        digitalSilencePercentage: 0,
        normalizationStatus: { status: 'normalized', message: 'Properly normalized', peakDb: -3.5, targetDb: -6.0 },
        reverbInfo: { rt60: 0.5 }
      }),
      analyzeStereoSeparation: vi.fn().mockReturnValue({ stereoType: 'Conversational Stereo' }),
      analyzeMicBleed: vi.fn().mockReturnValue({ detected: false }),
      analyzeConversationalAudio: vi.fn().mockReturnValue({
        overlap: { overlapPercentage: 5.2 },
        consistency: { isConsistent: true, consistencyPercentage: 100 }
      }),
      analyzeClipping: vi.fn().mockResolvedValue({
        clippedSamples: 0,
        clippedPercentage: 0,
        nearClippingSamples: 0,
        nearClippingPercentage: 0,
        clippingEventCount: 0,
        nearClippingEventCount: 0,
        maxConsecutiveClipped: 0,
        avgClippingDuration: 0,
        perChannel: [],
        clippingRegions: [],
        hardClippingRegions: [],
        nearClippingRegions: []
      })
    };

    LevelAnalyzer.mockImplementation(() => mockLevelAnalyzer);

    // Mock CriteriaValidator
    CriteriaValidator.validateResults.mockReturnValue({
      fileType: { status: 'pass', matches: true, value: 'WAV (PCM)' },
      sampleRate: { status: 'pass', matches: true, value: '48.0 kHz' },
      bitDepth: { status: 'pass', matches: true, value: '24-bit' },
      channels: { status: 'pass', matches: true, value: 'Stereo' }
    });

    // Mock FilenameValidator
    FilenameValidator.validateBilingual.mockReturnValue({
      status: 'pass',
      issue: null
    });
  });

  describe('Basic Analysis (audio-only mode)', () => {
    it('should call audioAnalyzer.analyzeFile (not analyze)', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      // Critical: Must call analyzeFile, not analyze
      expect(mockAudioAnalyzer.analyzeFile).toHaveBeenCalledWith(mockFile);
      expect(mockAudioAnalyzer.analyzeFile).toHaveBeenCalledTimes(1);
    });

    it('should return audio properties from analyzer', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(result.fileType).toBe('WAV (PCM)');
      expect(result.sampleRate).toBe(48000);
      expect(result.bitDepth).toBe(24);
      expect(result.channels).toBe(2);
      expect(result.duration).toBe(120);
      expect(result.filename).toBe('test.wav');
      expect(result.fileSize).toBe(1024);
    });

    it('should include status as pass by default', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(result.status).toBe('pass');
    });

    it('should not include validation when no criteria provided', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(result.validation).toBeUndefined();
    });
  });

  describe('Validation with Criteria', () => {
    const mockCriteria = {
      fileType: 'WAV',
      sampleRate: 48000,
      bitDepth: [16, 24],
      channels: 2,
      minDuration: 60
    };

    it('should validate results when criteria provided', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: { name: 'Test Preset' },
        presetId: 'test-preset',
        criteria: mockCriteria
      });

      // Critical: Must use passed criteria, not preset.criteria
      expect(CriteriaValidator.validateResults).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'WAV (PCM)',
          sampleRate: 48000,
          bitDepth: 24
        }),
        mockCriteria,
        false // skipAudioValidation
      );
    });

    it('should include validation results in output', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: { name: 'Test Preset' },
        presetId: 'test-preset',
        criteria: mockCriteria
      });

      expect(result.validation).toBeDefined();
      expect(result.validation.fileType.status).toBe('pass');
      expect(result.validation.sampleRate.status).toBe('pass');
    });

    it('should validate custom preset when criteria provided', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: { name: 'Custom' },
        presetId: 'custom',
        criteria: mockCriteria
      });

      // Custom preset WITH criteria should validate
      expect(CriteriaValidator.validateResults).toHaveBeenCalled();
      expect(result.validation).toBeDefined();
    });

    it('should determine overall status from validation', async () => {
      CriteriaValidator.validateResults.mockReturnValue({
        fileType: { status: 'pass' },
        sampleRate: { status: 'fail' }
      });

      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: { name: 'Test' },
        presetId: 'test',
        criteria: mockCriteria
      });

      expect(result.status).toBe('fail');
    });

    it('should set warning status when validation has warnings', async () => {
      CriteriaValidator.validateResults.mockReturnValue({
        fileType: { status: 'pass' },
        duration: { status: 'warning' }
      });

      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: { name: 'Test' },
        presetId: 'test',
        criteria: mockCriteria
      });

      expect(result.status).toBe('warning');
    });
  });

  describe('Filename Validation', () => {
    const mockPreset = {
      name: 'Bilingual Conversational',
      filenameValidationType: 'bilingual-pattern'
    };

    it('should validate filename in full mode', async () => {
      const bilingualFile = new File(
        ['test'],
        'vdlg1_001_topic-en_us-user-123-agent-456.wav',
        { type: 'audio/wav' }
      );

      await analyzeAudioFile(bilingualFile, {
        analysisMode: 'full',
        preset: mockPreset,
        presetId: 'bilingual-conversational',
        criteria: { fileType: 'WAV' }
      });

      expect(FilenameValidator.validateBilingual).toHaveBeenCalledWith(
        'vdlg1_001_topic-en_us-user-123-agent-456.wav'
      );
    });

    it('should add filename validation to results', async () => {
      FilenameValidator.validateBilingual.mockReturnValue({
        status: 'pass',
        issue: null
      });

      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'full',
        preset: mockPreset,
        presetId: 'bilingual-conversational',
        criteria: { fileType: 'WAV' }
      });

      expect(result.validation.filename).toBeDefined();
      expect(result.validation.filename.status).toBe('pass');
    });

    it('should not validate filename in audio-only mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: mockPreset,
        presetId: 'bilingual-conversational',
        criteria: { fileType: 'WAV' }
      });

      expect(FilenameValidator.validateBilingual).not.toHaveBeenCalled();
    });

    it('should validate filename in filename-only mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'filename-only',
        preset: mockPreset,
        presetId: 'bilingual-conversational',
        criteria: { fileType: 'WAV' }
      });

      expect(FilenameValidator.validateBilingual).toHaveBeenCalled();
    });
  });

  describe('Experimental Analysis Mode', () => {
    beforeEach(() => {
      // Mock AudioContext and decodeAudioData
      global.AudioContext = vi.fn().mockImplementation(() => ({
        decodeAudioData: vi.fn().mockResolvedValue({
          sampleRate: 48000,
          numberOfChannels: 2,
          duration: 120
        }),
        close: vi.fn()
      }));
    });

    it('should perform advanced analysis in experimental mode', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'experimental',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockLevelAnalyzer.analyzeAudioBuffer).toHaveBeenCalled();
      expect(result.peakDb).toBe(-3.5);
      expect(result.noiseFloorDb).toBe(-60);
      expect(result.noiseFloorPerChannel).toBeDefined();
      expect(result.reverbInfo).toBeDefined();
    });

    it('should include stereo separation analysis', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'experimental',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockLevelAnalyzer.analyzeStereoSeparation).toHaveBeenCalled();
      expect(result.stereoSeparation).toBeDefined();
    });

    it('should include mic bleed analysis', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'experimental',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockLevelAnalyzer.analyzeMicBleed).toHaveBeenCalled();
      expect(result.micBleed).toBeDefined();
    });

    it('should not perform advanced analysis in audio-only mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockLevelAnalyzer.analyzeAudioBuffer).not.toHaveBeenCalled();
    });
  });

  describe('Filename-Only Mode (Metadata Analysis)', () => {
    it('should skip audio decoding for empty files', async () => {
      const emptyFile = new File([], 'test.wav', { type: 'audio/wav' });
      Object.defineProperty(emptyFile, 'size', { value: 0 });

      const result = await analyzeAudioFile(emptyFile, {
        analysisMode: 'filename-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(mockAudioAnalyzer.analyzeFile).not.toHaveBeenCalled();
      expect(result.fileType).toBe('wav');
      expect(result.channels).toBe(0);
      expect(result.sampleRate).toBe(0);
    });

    it('should extract file type from extension', async () => {
      const emptyFile = new File([], 'test.mp3', { type: 'audio/mp3' });
      Object.defineProperty(emptyFile, 'size', { value: 0 });

      const result = await analyzeAudioFile(emptyFile, {
        analysisMode: 'filename-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(result.fileType).toBe('mp3');
    });

    it('should still validate filename for empty files', async () => {
      const emptyFile = new File(
        [],
        'vdlg1_001-en_us-user-123-agent-456.wav',
        { type: 'audio/wav' }
      );
      Object.defineProperty(emptyFile, 'size', { value: 0 });

      const preset = {
        filenameValidationType: 'bilingual-pattern'
      };

      await analyzeAudioFile(emptyFile, {
        analysisMode: 'filename-only',
        preset,
        presetId: 'bilingual',
        criteria: null
      });

      expect(FilenameValidator.validateBilingual).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from audioAnalyzer', async () => {
      mockAudioAnalyzer.analyzeFile.mockRejectedValue(new Error('Decode failed'));

      await expect(
        analyzeAudioFile(mockFile, {
          analysisMode: 'audio-only',
          preset: null,
          presetId: null,
          criteria: null
        })
      ).rejects.toThrow('Decode failed');
    });

    it('should handle Blob without filename', async () => {
      const blob = new Blob(['test content'], { type: 'audio/wav' });

      const result = await analyzeAudioFile(blob, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(result.filename).toBe('unknown');
    });
  });

  describe('skipAudioValidation Parameter', () => {
    it('should skip audio validation in filename-only mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'filename-only',
        preset: { name: 'Test' },
        presetId: 'test',
        criteria: { fileType: 'WAV', sampleRate: 48000 }
      });

      expect(CriteriaValidator.validateResults).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        true // skipAudioValidation = true
      );
    });

    it('should not skip audio validation in audio-only mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: { name: 'Test' },
        presetId: 'test',
        criteria: { fileType: 'WAV', sampleRate: 48000 }
      });

      expect(CriteriaValidator.validateResults).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        false // skipAudioValidation = false
      );
    });

    it('should not skip audio validation in full mode', async () => {
      await analyzeAudioFile(mockFile, {
        analysisMode: 'full',
        preset: { name: 'Test' },
        presetId: 'test',
        criteria: { fileType: 'WAV', sampleRate: 48000 }
      });

      expect(CriteriaValidator.validateResults).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        false // skipAudioValidation = false
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle bilingual conversational preset in full mode', async () => {
      const bilingualFile = new File(
        ['test'],
        'vdlg1_088-fr_fr-user-5452-agent-138222.wav',
        { type: 'audio/wav' }
      );

      const preset = {
        name: 'Bilingual Conversational',
        filenameValidationType: 'bilingual-pattern'
      };

      const criteria = {
        fileType: ['WAV', 'MP3'],
        sampleRate: [44100, 48000],
        bitDepth: [16, 24],
        channels: [1, 2],
        minDuration: 30
      };

      const result = await analyzeAudioFile(bilingualFile, {
        analysisMode: 'full',
        preset,
        presetId: 'bilingual-conversational',
        criteria
      });

      // Should have both audio validation and filename validation
      expect(mockAudioAnalyzer.analyzeFile).toHaveBeenCalled();
      expect(CriteriaValidator.validateResults).toHaveBeenCalled();
      expect(FilenameValidator.validateBilingual).toHaveBeenCalled();
      expect(result.validation).toBeDefined();
      expect(result.validation.filename).toBeDefined();
    });

    it('should handle no preset scenario', async () => {
      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'audio-only',
        preset: null,
        presetId: null,
        criteria: null
      });

      expect(result.validation).toBeUndefined();
      expect(result.status).toBe('pass');
    });

    it('should handle experimental mode with validation', async () => {
      global.AudioContext = vi.fn().mockImplementation(() => ({
        decodeAudioData: vi.fn().mockResolvedValue({
          sampleRate: 48000,
          numberOfChannels: 2,
          duration: 120
        }),
        close: vi.fn()
      }));

      const result = await analyzeAudioFile(mockFile, {
        analysisMode: 'experimental',
        preset: { name: 'Test' },
        presetId: 'test',
        criteria: { fileType: 'WAV', sampleRate: 48000 }
      });

      // Should have both experimental analysis and validation
      expect(mockLevelAnalyzer.analyzeAudioBuffer).toHaveBeenCalled();
      expect(CriteriaValidator.validateResults).toHaveBeenCalled();
      expect(result.peakDb).toBeDefined();
      expect(result.validation).toBeDefined();
    });
  });
});
