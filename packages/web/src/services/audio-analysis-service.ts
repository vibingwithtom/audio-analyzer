import { AudioAnalyzer, LevelAnalyzer, CriteriaValidator, AnalysisCancelledError } from '@audio-analyzer/core';
import { FilenameValidator } from '../validation/filename-validator';
import type { AudioResults, ValidationResults } from '../types';
import type { AnalysisMode } from '../stores/analysisMode';
import type { PresetConfig } from '../settings/types';
import { analyticsService } from './analytics-service';

// Track all active LevelAnalyzer instances for concurrent batch processing
const activeLevelAnalyzers = new Set<LevelAnalyzer>();

export function cancelCurrentAnalysis() {
  // Cancel all active analyzers (for batch processing)
  activeLevelAnalyzers.forEach(analyzer => analyzer.cancelAnalysis());
  activeLevelAnalyzers.clear();
}

export interface AnalysisOptions {
  analysisMode: AnalysisMode;
  preset?: PresetConfig | null;
  presetId?: string;
  criteria?: any; // AudioCriteria from core
  // Three Hour configuration (for script-match validation)
  scriptsList?: string[];
  speakerId?: string;
  // Skip individual file tracking during batch operations (to save Umami events)
  skipIndividualTracking?: boolean;
  // NEW: Progress callback for UI feedback
  progressCallback?: (message: string, progress: number) => void;
}

/**
 * Analyzes an audio file and returns comprehensive results.
 *
 * This service encapsulates all file analysis logic used by LocalFileTab,
 * GoogleDriveTab, and future BoxTab.
 *
 * @param file - The audio file to analyze (File or Blob)
 * @param options - Analysis configuration options
 * @returns Promise resolving to AudioResults
 * @throws Error if analysis fails (caller should handle errors)
 */
export async function analyzeAudioFile(
  file: File | Blob,
  options: AnalysisOptions
): Promise<AudioResults> {
  const startTime = Date.now();
  let result: AudioResults | null = null;
  const { analysisMode: mode, preset, presetId, criteria, scriptsList, speakerId, skipIndividualTracking, progressCallback } = options;
  const filename = file instanceof File ? file.name : 'unknown';

  try {
    // Only track individual files if not in batch mode (to save Umami events)
    if (!skipIndividualTracking) {
      analyticsService.track('analysis_started', {
        filename,
        fileSize: file.size,
        analysisMode: mode,
        presetId,
      });
    }

    // For empty files (filename-only mode with Google Drive metadata)
    if (file.size === 0) {
      result = await analyzeMetadataOnly(file, filename, options);
    } else {
      // Full audio analysis
      result = await analyzeFullFile(file, filename, mode, preset, presetId, criteria, scriptsList, speakerId, progressCallback);
    }

    return result;
  } catch (error) {
    // Handle cancellation gracefully (don't track as error)
    if (error instanceof AnalysisCancelledError) {
      analyticsService.track('analysis_cancelled', {
        filename,
        stage: (error as any).stage,
        analysisMode: options.analysisMode,
        fileSize: file.size,
      });
      throw error; // Re-throw for UI to handle
    }

    // Always track other errors
    analyticsService.track('analysis_error', {
      filename,
      error: error instanceof Error ? error.message : String(error),
      analysisMode: options.analysisMode,
      presetId: options.presetId,
      fileSize: file.size,
      fileType: file instanceof File ? file.name.split('.').pop()?.toLowerCase() : 'unknown',
    });
    throw error; // Re-throw the error to be handled by the caller
  } finally {
    if (result && !skipIndividualTracking) {
      const processingTime = Date.now() - startTime;
      analyticsService.track('analysis_completed', {
        filename: result.filename,
        status: result.status,
        processingTime,
        fileSize: result.fileSize,
        fileType: result.fileType,
        analysisMode: options.analysisMode,
        presetId: options.presetId,
      });
    }
  }
}

/**
 * Analyzes only file metadata (no audio decoding).
 * Used in filename-only mode when file hasn't been downloaded.
 */
async function analyzeMetadataOnly(
  file: File | Blob,
  filename: string,
  options: AnalysisOptions
): Promise<AudioResults> {
  const { analysisMode: mode, preset, presetId, scriptsList, speakerId } = options;
  // Extract file type from filename extension
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const fileType = extension || 'unknown';

  // Use actualSize if available (for partial downloads), otherwise use file.size
  const actualSize = (file as any).actualSize || file.size;

  const result: AudioResults = {
    filename,
    fileSize: actualSize,
    fileType,
    channels: 0,
    sampleRate: 0,
    bitDepth: 0,
    duration: 0,
    status: 'pass'
  };

  // Validate filename if preset supports it
  if (preset?.filenameValidationType && (mode === 'filename-only' || mode === 'full')) {
    const validation = validateFilename(filename, preset, presetId, scriptsList, speakerId);
    if (validation) {
      result.validation = { filename: validation };
      result.status = validation.status;
    }
  }

  return result;
}

/**
 * Performs full audio analysis including decoding and advanced metrics.
 */
async function analyzeFullFile(
  file: File | Blob,
  filename: string,
  mode: AnalysisMode,
  preset?: PresetConfig | null,
  presetId?: string,
  criteria?: any,
  scriptsList?: string[],
  speakerId?: string,
  progressCallback?: (message: string, progress: number) => void
): Promise<AudioResults> {
  // Report progress for basic analysis
  if (progressCallback) {
    progressCallback('Reading file...', 0);
  }

  // Basic audio analysis
  const audioAnalyzer = new AudioAnalyzer();
  const basicResults = await audioAnalyzer.analyzeFile(file);

  // Use actualSize if available (for partial downloads), otherwise use file.size
  const actualSize = (file as any).actualSize || file.size;

  let result: AudioResults = {
    filename,
    status: 'pass',
    sampleRate: 0,
    bitDepth: 0,
    channels: 0,
    duration: 0,
    fileSize: actualSize,
    ...(basicResults as any)  // Spread after defaults so basicResults can override
  };

  // Report progress after basic analysis
  if (progressCallback) {
    progressCallback('Validating properties...', 0.5);
  }

  // Advanced/Experimental analysis
  if (mode === 'experimental') {
    const arrayBuffer = await file.arrayBuffer();
    const advancedResults = await analyzeExperimental(arrayBuffer, progressCallback);
    result = { ...result, ...advancedResults };

    // Track experimental feature usage
    analyticsService.track('experimental_analysis_used', {
      hasStereoSeparation: !!advancedResults.stereoSeparation,
      stereoType: advancedResults.stereoSeparation?.stereoType,
      hasMicBleed: !!advancedResults.micBleed,
      hasReverb: !!advancedResults.reverbInfo,
      hasNoiseFloor: advancedResults.noiseFloorDb !== undefined,
      hasSilenceDetection: !!advancedResults.silenceInfo,
    });
  }

  // Validation against preset criteria
  if (criteria) {
    const skipAudioValidation = mode === 'filename-only';
    const validation = CriteriaValidator.validateResults(result, criteria, skipAudioValidation) as unknown as ValidationResults;

    // Add filename validation if preset supports it
    if (preset?.filenameValidationType && (mode === 'filename-only' || mode === 'full')) {
      const filenameValidation = validateFilename(filename, preset, presetId, scriptsList, speakerId);
      if (filenameValidation && validation) {
        (validation as any).filename = filenameValidation;
      }
    }

    result.validation = validation;
    result.status = determineOverallStatus(validation);
  }

  // Report completion
  if (progressCallback) {
    progressCallback('Analysis complete', 1.0);
  }

  return result;
}

/**
 * Runs experimental analysis: peak levels, reverb, noise floor, stereo separation, mic bleed.
 */
async function analyzeExperimental(
  arrayBuffer: ArrayBuffer,
  progressCallback?: (message: string, progress: number) => void
): Promise<Partial<AudioResults>> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create a new LevelAnalyzer instance for this analysis (not shared with other concurrent analyses)
  const levelAnalyzer = new LevelAnalyzer();
  activeLevelAnalyzers.add(levelAnalyzer);

  try {
    // Run level analysis with experimental features (reverb, noise floor, silence)
    const advancedResults = await (levelAnalyzer as any).analyzeAudioBuffer(audioBuffer, progressCallback ?? null, true);

    // Re-enable analysisInProgress for additional analyses
    (levelAnalyzer as any).analysisInProgress = true;

    // Add stereo separation analysis
    const stereoSeparation = levelAnalyzer.analyzeStereoSeparation(audioBuffer) as any;
    if (stereoSeparation) {
      advancedResults.stereoSeparation = stereoSeparation;

      // Add mic bleed analysis (only meaningful for conversational stereo files)
      if (stereoSeparation.stereoType === 'Conversational Stereo') {
        const micBleed = levelAnalyzer.analyzeMicBleed(audioBuffer);
        if (micBleed) {
          advancedResults.micBleed = micBleed;
        }

        // Add conversational audio analysis (overlap, consistency, sync)
        const conversationalAnalysis = levelAnalyzer.analyzeConversationalAudio(
          audioBuffer,
          {
            overall: advancedResults.noiseFloorDb,
            perChannel: advancedResults.noiseFloorPerChannel
          },
          advancedResults.peakDb
        );
        if (conversationalAnalysis) {
          advancedResults.conversationalAnalysis = conversationalAnalysis;
        }
      }
    }

    return advancedResults as Partial<AudioResults>;
  } finally {
    (levelAnalyzer as any).analysisInProgress = false;
    activeLevelAnalyzers.delete(levelAnalyzer);
  }
}

/**
 * Validates filename against preset rules.
 */
function validateFilename(
  filename: string,
  preset: PresetConfig,
  presetId?: string,
  scriptsList?: string[],
  speakerId?: string
): { status: 'pass' | 'warning' | 'fail'; value: string; issue?: string } | null {
  if (!preset.filenameValidationType) return null;

  if (preset.filenameValidationType === 'bilingual-pattern') {
    const validation = FilenameValidator.validateBilingual(filename);
    return {
      status: validation.status as 'pass' | 'warning' | 'fail',
      value: filename,
      issue: validation.issue
    };
  }

  if (preset.filenameValidationType === 'script-match') {
    // Three Hour validation - requires scripts list and speaker ID
    if (!scriptsList || scriptsList.length === 0 || !speakerId) {
      return {
        status: 'fail',
        value: filename,
        issue: 'Three Hour validation requires configuration: scripts folder and speaker ID must be set'
      };
    }

    const validation = FilenameValidator.validateThreeHour(filename, scriptsList, speakerId);

    return {
      status: validation.status as 'pass' | 'warning' | 'fail',
      value: filename,
      issue: validation.issue
    };
  }

  return null;
}

/**
 * Determines overall status based on validation results.
 */
function determineOverallStatus(validation: ValidationResults): 'pass' | 'warning' | 'fail' {
  let hasFailure = false;
  let hasWarning = false;

  Object.values(validation).forEach((v: any) => {
    if (v.status === 'fail') hasFailure = true;
    if (v.status === 'warning') hasWarning = true;
  });

  if (hasFailure) return 'fail';
  if (hasWarning) return 'warning';
  return 'pass';
}
