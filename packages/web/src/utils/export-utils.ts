import type { AudioResults } from '../types';
import type { AudioCriteria, PresetConfig } from '@audio-analyzer/core';
import { formatDuration, formatSampleRate as formatSampleRateUI, formatBytes, formatChannels, formatBitDepth } from '@audio-analyzer/core';
import { analyticsService } from '../services/analytics-service';
import { CriteriaValidator } from '@audio-analyzer/core';

// Type definitions for validation results from CriteriaValidator
interface StereoValidationResult {
  status: 'pass' | 'fail';
  message: string;
}

interface SpeechOverlapValidationResult {
  status: 'pass' | 'warning' | 'fail';
  message: string;
  percentage: number;
  longestSegment: number;
}

export interface ExportOptions {
  mode: 'standard' | 'experimental' | 'metadata-only';
  includeTimestamps?: boolean;
  dateFormat?: 'iso' | 'locale';
  includeFailureAnalysis?: boolean;
  includeRecommendations?: boolean;
}

export interface FailureAnalysis {
  filenameValidationIssues: string;
  qualityIssues: string;
  failureSummary: string;
  recommendations: string;
  hasFilenameValidation: boolean;
}

export interface EnhancedExportOptions extends ExportOptions {
  includeFilenameValidation: boolean;
  currentPresetCriteria?: AudioCriteria | null;
  currentPreset?: PresetConfig | null;
  analysisMode: 'standard' | 'experimental' | 'metadata-only';
  includeFailureAnalysis?: boolean;
  includeRecommendations?: boolean;
}

/**
 * Escapes CSV values that contain commas, quotes, or newlines
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats numeric values with consistent precision
 * Fixed: -Infinity returns 'N/A' for better compatibility
 */
function formatNumber(value: number | 'Unknown' | undefined, precision: number = 2): string {
  if (value === undefined || value === null || value === 'Unknown') {
    return 'N/A';
  }

  if (value === -Infinity) {
    return 'N/A';  // Changed from '-∞' for Excel compatibility
  }

  if (typeof value === 'number') {
    return value.toFixed(precision);
  }

  return String(value);
}

/**
 * Generates CSV headers based on export mode
 */
function generateHeaders(mode: ExportOptions['mode']): string[] {
  const baseHeaders = ['Filename', 'Status'];

  if (mode === 'metadata-only') {
    return [...baseHeaders, 'Error Details'];
  }

  if (mode === 'standard') {
    return [
      ...baseHeaders,
      'File Type',
      'Sample Rate (Hz)',
      'Bit Depth',
      'Channels',
      'Duration',
      'File Size (Bytes)',
      'Source URL'
    ];
  }

  // Experimental mode - comprehensive data
  return [
    'Filename',
    'Status',
    'File Type',
    'Sample Rate (Hz)',
    'Bit Depth',
    'Channels',
    'Duration',
    'File Size (Bytes)',
    'Peak Level (dB)',
    'Noise Floor (dB)',
    'Normalization Status',
    'Normalization Peak (dB)',
    'Normalization Target (dB)',
    'Clipping Detected',
    'Clipping Percentage (%)',
    'Clipping Events',
    'Near Clipping Percentage (%)',
    'Reverb RT60 (s)',
    'Reverb Label',
    'Leading Silence (s)',
    'Trailing Silence (s)',
    'Longest Silence (s)',
    'Stereo Type',
    'Stereo Confidence (%)',
    'Speech Overlap (%)',
    'Speech Overlap Max Duration (s)',
    'Mic Bleed Detected',
    'Mic Bleed Severity',
    'Digital Silence (%)'
  ];
}

/**
 * Extracts data row for a single AudioResults object
 */
function extractDataRow(result: AudioResults, mode: ExportOptions['mode']): string[] {
  const baseRow = [
    result.filename,
    result.status
  ];

  if (mode === 'metadata-only') {
    // Extract validation issues for metadata-only mode
    const validationIssues: string[] = [];
    if (result.validation) {
      Object.entries(result.validation).forEach(([field, validation]) => {
        if (validation.issue) {
          validationIssues.push(`${field}: ${validation.issue}`);
        }
      });
    }
    return [...baseRow, validationIssues.join('; ') || '—'];
  }

  if (mode === 'standard') {
    return [
      ...baseRow,
      result.fileType || 'Unknown',
      formatSampleRateUI(result.sampleRate || 'Unknown'),
      formatBitDepth(result.bitDepth || 'Unknown'),
      formatChannels(result.channels || 'Unknown'),
      formatDuration(result.duration),
      formatBytes(result.fileSize || 0),
      result.externalUrl || ''
    ];
  }

  // Experimental mode - comprehensive data extraction
  return [
    result.filename,
    result.status,
    result.fileType || 'Unknown',
    formatSampleRateUI(result.sampleRate || 'Unknown'),
    formatBitDepth(result.bitDepth || 'Unknown'),
    formatChannels(result.channels || 'Unknown'),
    formatDuration(result.duration),
    formatBytes(result.fileSize || 0),
    formatNumber(result.peakDb),
    formatNumber(result.noiseFloorDb),
    result.normalizationStatus?.status || 'N/A',
    formatNumber(result.normalizationStatus?.peakDb),
    formatNumber(result.normalizationStatus?.targetDb),
    result.clippingAnalysis && result.clippingAnalysis.clippingEventCount > 0 ? 'Yes' : 'No',
    formatNumber(result.clippingAnalysis?.clippedPercentage),
    formatNumber(result.clippingAnalysis?.clippingEventCount, 0),
    formatNumber(result.clippingAnalysis?.nearClippingPercentage),
    formatNumber(result.reverbInfo?.time),
    result.reverbInfo?.label || 'N/A',
    formatNumber(result.leadingSilence),
    formatNumber(result.trailingSilence),
    formatNumber(result.longestSilence),
    result.stereoSeparation?.stereoType || 'N/A',
    formatNumber(result.stereoSeparation?.stereoConfidence ? result.stereoSeparation.stereoConfidence * 100 : undefined, 1),
    formatNumber(result.conversationalAnalysis?.overlap?.overlapPercentage, 1),
    formatNumber(getLongestOverlapDuration(result), 1),
    getMicBleedDetected(result),
    formatNumber(result.micBleed?.new?.severityScore, 1),
    formatNumber(result.digitalSilencePercentage, 1)
  ];
}

/**
 * Quality analysis thresholds
 * Centralized constants for maintainability and consistency with UI
 */
const QUALITY_THRESHOLDS = {
  clipping: {
    CRITICAL_PERCENTAGE: 1,      // > 1% is critical
    CRITICAL_EVENTS: 50,          // > 50 events is critical
    MAJOR_PERCENTAGE: 0.1,        // > 0.1% is major
    MAJOR_EVENTS: 10,             // > 10 events is major
    NEAR_CLIPPING: 1              // > 1% near-clipping is major
  },
  noiseFloor: {
    WARNING_DB: -50,              // > -50 dB is concerning
    CRITICAL_DB: -40              // > -40 dB is critical
  },
  reverb: {
    POOR_TIME: 1.2,               // > 1.2s is poor
    EXCESSIVE_TIME: 1.5           // > 1.5s is excessive
  },
  silence: {
    LEADING_THRESHOLD: 1,         // > 1s leading silence
    TRAILING_THRESHOLD: 1,        // > 1s trailing silence
    GAP_THRESHOLD: 2              // > 2s silence gap
  },
  speechOverlap: {
    WARNING_PERCENTAGE: 5,        // > 5% is concerning
    CRITICAL_PERCENTAGE: 15       // > 15% is critical
  },
  micBleed: {
    OLD_THRESHOLD_DB: -60,        // > -60 dB old method
    NEW_THRESHOLD_PERCENTAGE: 0.5, // > 0.5% new method
    SEVERE_SCORE: 70              // > 70 severity score is severe
  }
} as const;

/**
 * Static recommendation templates for different issue types
 */
const RECOMMENDATION_TEMPLATES = {
  filename: {
    generic: "Filename must match the required format."
  },
  sampleRate: {
    generic: "File must use the required sample rate.",
    tooLow: "Sample rate too low - re-encode with the required sample rate.",
    tooHigh: "Sample rate too high - re-encode with the required sample rate."
  },
  bitDepth: {
    generic: "File must use the required bit depth.",
    tooLow: "Bit depth too low - re-encode with the required bit depth.",
    unsupported: "File must use the required bit depth."
  },
  channels: {
    generic: "File must use the required channel configuration.",
    needStereo: "File must be stereo (two channels), not mono.",
    needMono: "File must be mono (single channel), not stereo.",
    tooManyChannels: "Too many channels - file must use the required channel configuration."
  },
  fileType: {
    unsupported: "File must be in a supported audio format.",
    compressed: "File must be uncompressed.",
    generic: "File must be in a supported audio format."
  },
  normalization: {
    notNormalized: "Normalize audio to target level before submission.",
    generic: "Check normalization settings and re-process audio."
  },
  clipping: {
    minor: "Reduce recording gain slightly to avoid clipping.",
    major: "Significantly reduce input levels and re-record.",
    critical: "Audio severely clipped - re-record with proper gain staging."
  },
  noiseFloor: {
    high: "Record in quieter environment or use noise reduction.",
    veryHigh: "Improve recording setup - check microphone and preamp settings.",
    critical: "Recording environment too noisy - find quieter location."
  },
  reverb: {
    excessive: "Record in more acoustically treated space.",
    poor: "Improve room acoustics or use closer microphone placement."
  },
  silence: {
    leadingExcess: "Trim leading silence to improve user experience.",
    trailingExcess: "Trim trailing silence.",
    gapsExcess: "Edit out long silent gaps in recording."
  },
  micBleed: {
    detected: "Improve microphone isolation or use directional microphones.",
    severe: "Increase physical separation between speakers and microphones."
  },
  speechOverlap: {
    high: "Encourage better turn-taking in conversations.",
    excessive: "Implement stricter speaking protocols to reduce simultaneous speech."
  }
} as const;

/**
 * Converts channel count to human-readable format (e.g., 1 -> "Mono (1 channel)")
 */
function formatChannelName(channels: string | number): string {
  const num = typeof channels === 'string' ? parseInt(channels, 10) : channels;
  if (num === 1) return 'Mono (1 channel)';
  if (num === 2) return 'Stereo (2 channels)';
  return `${num} channels`;
}

/**
 * Converts Hz to kHz for readable display
 */
function formatSampleRate(hz: string | number): string {
  const num = typeof hz === 'string' ? parseInt(hz, 10) : hz;
  const khz = num / 1000;
  return khz % 1 === 0 ? `${khz} kHz` : `${khz.toFixed(1)} kHz`;
}

/**
 * Formats channel layout for display
 * Returns stereoType if available, otherwise infers from channel count
 */
function formatChannelLayout(result: AudioResults): string {
  // Try to use stereoType first if available
  if (result.stereoSeparation?.stereoType) {
    return result.stereoSeparation.stereoType;
  }

  // Fall back to inferring from channel count
  if (result.channels === 1) return 'Mono';
  if (result.channels === 2) return 'Stereo';
  if (result.channels) return `${result.channels} Channels`;

  return 'N/A';
}

/**
 * Type-safe template lookup for recommendations
 */
type RecommendationTemplate = typeof RECOMMENDATION_TEMPLATES;
type IssueType = keyof RecommendationTemplate;
type SubType<T extends IssueType> = keyof RecommendationTemplate[T];

/**
 * Generates context-aware recommendations based on criteria and failure types
 */
function generateDynamicRecommendation(
  issueType: IssueType,
  subType: string,
  actualValue: number | string | null,
  criteria: AudioCriteria | null | undefined
): string {
  // Type-safe template lookup
  const templates = RECOMMENDATION_TEMPLATES[issueType];

  // Handle missing template gracefully
  if (!templates) {
    return "Please review file properties.";
  }

  const template = (templates as Record<string, string>)[subType] ||
                   (templates as Record<string, string>).generic ||
                   templates;

  if (typeof template !== 'string') {
    return "Please review file properties.";
  }

  // Add criteria-specific context without mentioning preset name
  if (issueType === 'sampleRate' && criteria?.sampleRate?.length) {
    const allowedRates = criteria.sampleRate.map(formatSampleRate).join(' or ');
    return `File must be ${allowedRates}.`;
  }

  if (issueType === 'bitDepth' && criteria?.bitDepth?.length) {
    const allowedDepths = criteria.bitDepth.join(' or ');
    return `File must be ${allowedDepths}-bit.`;
  }

  if (issueType === 'channels' && criteria?.channels?.length) {
    const allowedChannels = criteria.channels.map(formatChannelName).join(' or ');
    return `File must be ${allowedChannels}.`;
  }

  if (issueType === 'fileType' && criteria?.fileType?.length) {
    const allowedTypes = criteria.fileType.join(', ');
    return `File must be in a supported audio format (${allowedTypes}).`;
  }

  return template;
}

/**
 * Analyzes a single AudioResults object and extracts failure information with recommendations
 */
export function analyzeFailuresWithRecommendations(
  result: AudioResults,
  options: EnhancedExportOptions
): FailureAnalysis {
  const analysis: FailureAnalysis = {
    filenameValidationIssues: '',
    qualityIssues: '',
    failureSummary: '',
    recommendations: '',
    hasFilenameValidation: options.includeFilenameValidation
  };

  const issues: string[] = [];
  const recommendations: string[] = [];
  let issueCount = 0;

  // 1. Filename Validation Issues
  if (options.includeFilenameValidation && result.validation?.filename) {
    const filenameValidation = result.validation.filename;
    if (filenameValidation.status === 'fail' || filenameValidation.status === 'warning') {
      analysis.filenameValidationIssues = `filename: ${filenameValidation.issue}`;
      issueCount++;

      // Use standardized recommendation that references the validation issues column
      recommendations.push(generateDynamicRecommendation(
        'filename', 'generic', result.filename, options.currentPresetCriteria
      ));
    }
  }

  // 2. Technical Specification Issues
  const validationIssues: string[] = [];

  if (result.validation) {
    Object.entries(result.validation).forEach(([field, validation]) => {
      if (field === 'filename') return;

      if (validation.status === 'fail' || validation.status === 'warning') {
        // Include the issue message if available, otherwise include the actual value
        const actualValue = (result as any)[field];
        const issueMessage = validation.issue || String(actualValue);
        validationIssues.push(`${field}: ${issueMessage}`);
        issueCount++;

        let subType: string = 'generic';
        const issue = validation.issue?.toLowerCase() || '';

        if (field === 'sampleRate') {
          if (issue.includes('low') || issue.includes('minimum')) subType = 'tooLow';
          if (issue.includes('high') || issue.includes('maximum')) subType = 'tooHigh';
        } else if (field === 'channels') {
          if (issue.includes('mono') || issue.includes('stereo')) {
            subType = result.channels === 1 ? 'needStereo' : 'needMono';
          }
        } else if (field === 'fileType') {
          if (issue.includes('compressed')) subType = 'compressed';
          else subType = 'unsupported';
        }

        recommendations.push(generateDynamicRecommendation(
          field as keyof typeof RECOMMENDATION_TEMPLATES,
          subType,
          (result as any)[field],
          options.currentPresetCriteria
        ));
      }
    });
  }

  // 3. Quality/Experimental Issues
  // Only include experimental quality issues when analysis mode is 'experimental'
  const qualityIssues: string[] = [];

  if (options.analysisMode === 'experimental') {
    // Normalization Analysis
    if (result.normalizationStatus && result.normalizationStatus.status !== 'normalized') {
      qualityIssues.push(`Normalization: ${result.normalizationStatus.status}`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('normalization', 'notNormalized', null, null));
    }

    // Clipping Analysis (aligned with UI thresholds)
    if (result.clippingAnalysis) {
      const { clippedPercentage, clippingEventCount, nearClippingPercentage } = result.clippingAnalysis;
      let clipSeverity = '';

      // Hard clipping > CRITICAL_PERCENTAGE% OR > CRITICAL_EVENTS events → error
      if (clippedPercentage > QUALITY_THRESHOLDS.clipping.CRITICAL_PERCENTAGE ||
          clippingEventCount > QUALITY_THRESHOLDS.clipping.CRITICAL_EVENTS) {
        clipSeverity = 'critical';
      }
      // Hard clipping > MAJOR_PERCENTAGE% OR > MAJOR_EVENTS events → warning
      else if (clippedPercentage > QUALITY_THRESHOLDS.clipping.MAJOR_PERCENTAGE ||
               clippingEventCount > QUALITY_THRESHOLDS.clipping.MAJOR_EVENTS) {
        clipSeverity = 'major';
      }
      // Any hard clipping → warning
      else if (clippedPercentage > 0 && clippingEventCount > 0) {
        clipSeverity = 'major';
      }
      // Near clipping > NEAR_CLIPPING% → warning
      else if (nearClippingPercentage > QUALITY_THRESHOLDS.clipping.NEAR_CLIPPING) {
        clipSeverity = 'major';
      }

      if (clipSeverity) {
        qualityIssues.push(`Clipping: ${clippedPercentage.toFixed(2)}% (${clipSeverity})`);
        issueCount++;
        recommendations.push(generateDynamicRecommendation('clipping', clipSeverity, clippedPercentage, null));
      }
    }

    // Noise Floor Analysis (aligned with UI thresholds)
    if (result.noiseFloorDb !== undefined && result.noiseFloorDb > QUALITY_THRESHOLDS.noiseFloor.WARNING_DB) {
      const severity = result.noiseFloorDb > QUALITY_THRESHOLDS.noiseFloor.CRITICAL_DB ? 'critical' : 'high';
      qualityIssues.push(`High noise floor: ${result.noiseFloorDb.toFixed(1)} dB`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('noiseFloor', severity, result.noiseFloorDb, null));
    }

    // Reverb Analysis
    if (result.reverbInfo?.label &&
        (result.reverbInfo.label.includes('Poor') || result.reverbInfo.time > QUALITY_THRESHOLDS.reverb.POOR_TIME)) {
      const severity = result.reverbInfo.time > QUALITY_THRESHOLDS.reverb.EXCESSIVE_TIME ? 'excessive' : 'poor';
      qualityIssues.push(`${result.reverbInfo.label}: ${result.reverbInfo.time.toFixed(2)}s RT60`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('reverb', severity, result.reverbInfo.time, null));
    }

    // Silence Analysis (aligned with UI thresholds)
    if (result.leadingSilence !== undefined && result.leadingSilence > QUALITY_THRESHOLDS.silence.LEADING_THRESHOLD) {
      qualityIssues.push(`Leading silence: ${result.leadingSilence.toFixed(1)}s`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('silence', 'leadingExcess', result.leadingSilence, null));
    }

    if (result.trailingSilence !== undefined && result.trailingSilence > QUALITY_THRESHOLDS.silence.TRAILING_THRESHOLD) {
      qualityIssues.push(`Trailing silence: ${result.trailingSilence.toFixed(1)}s`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('silence', 'trailingExcess', result.trailingSilence, null));
    }

    if (result.longestSilence !== undefined && result.longestSilence > QUALITY_THRESHOLDS.silence.GAP_THRESHOLD) {
      qualityIssues.push(`Silence gap: ${result.longestSilence.toFixed(1)}s`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('silence', 'gapsExcess', result.longestSilence, null));
    }

    // Mic Bleed Analysis
    const micBleedDetected = result.micBleed && (
      (result.micBleed.old?.leftChannelBleedDb > QUALITY_THRESHOLDS.micBleed.OLD_THRESHOLD_DB ||
       result.micBleed.old?.rightChannelBleedDb > QUALITY_THRESHOLDS.micBleed.OLD_THRESHOLD_DB) ||
      (result.micBleed.new?.percentageConfirmedBleed > QUALITY_THRESHOLDS.micBleed.NEW_THRESHOLD_PERCENTAGE)
    );
    if (micBleedDetected) {
      const severity = (result.micBleed.new?.severityScore || 0) > QUALITY_THRESHOLDS.micBleed.SEVERE_SCORE ? 'severe' : 'detected';
      qualityIssues.push(`Mic bleed detected`);
      issueCount++;
      recommendations.push(generateDynamicRecommendation('micBleed', severity, null, null));
    }
  }

  // Stereo Type Validation (preset-based, binary: pass/fail)
  // Only validate stereo type in experimental mode
  if (options.analysisMode === 'experimental' && options.currentPreset && options.currentPreset.stereoType) {
    const stereoValidation = CriteriaValidator.validateStereoType(result.stereoSeparation, options.currentPreset) as StereoValidationResult | null;
    if (stereoValidation && stereoValidation.status === 'fail') {
      qualityIssues.push(`Stereo type: ${stereoValidation.message}`);
      issueCount++;
      recommendations.push(`File must have ${options.currentPreset.stereoType.join(' or ')} stereo separation pattern.`);
    }
  }

  // Speech Overlap Analysis (preset-based thresholds)
  // Only validate speech overlap in experimental mode
  if (options.analysisMode === 'experimental') {
    if (options.currentPreset && result.conversationalAnalysis) {
      const overlapValidation = CriteriaValidator.validateSpeechOverlap(result.conversationalAnalysis, options.currentPreset) as SpeechOverlapValidationResult | null;
      if (overlapValidation) {
        if (overlapValidation.status === 'warning') {
          qualityIssues.push(`Speech overlap: ${overlapValidation.message}`);
          issueCount++;
          recommendations.push(generateDynamicRecommendation('speechOverlap', 'high', overlapValidation.percentage, null));
        } else if (overlapValidation.status === 'fail') {
          qualityIssues.push(`Speech overlap: ${overlapValidation.message}`);
          issueCount++;
          recommendations.push(generateDynamicRecommendation('speechOverlap', 'excessive', overlapValidation.percentage, null));
        }
      }
    } else if (result.conversationalAnalysis?.overlap) {
      // Fallback to generic thresholds if no preset is provided
      const percentage = result.conversationalAnalysis.overlap.overlapPercentage;
      if (percentage > QUALITY_THRESHOLDS.speechOverlap.WARNING_PERCENTAGE) {
        const severity = percentage > QUALITY_THRESHOLDS.speechOverlap.CRITICAL_PERCENTAGE ? 'excessive' : 'high';
        qualityIssues.push(`Speech overlap: ${percentage.toFixed(1)}%`);
        issueCount++;
        recommendations.push(generateDynamicRecommendation('speechOverlap', severity, percentage, null));
      }
    }
  }

  // Compile results - combine both validation and quality issues (only if includeFailureAnalysis is enabled)
  const shouldIncludeFailureAnalysis = options.includeFailureAnalysis !== false; // Default to true
  if (shouldIncludeFailureAnalysis) {
    const allIssues = [...validationIssues, ...qualityIssues];
    analysis.qualityIssues = allIssues.join(' | ');

    // Generate failure summary
    if (issueCount === 0) {
      analysis.failureSummary = 'No issues detected';
    } else {
      const issueTypes: string[] = [];

      // Determine critical vs warning counts
      let criticalCount = qualityIssues.filter(q => q.includes('critical')).length +
                         validationIssues.filter(v => result.validation &&
                           Object.values(result.validation).some(val => val.status === 'fail')).length;

      // In filename-only mode, filename validation failures are CRITICAL
      const isFilenameOnlyMode = options.analysisMode === 'metadata-only' && options.includeFilenameValidation;
      if (isFilenameOnlyMode && result.validation?.filename) {
        const filenameValidation = result.validation.filename;
        if (filenameValidation.status === 'fail') {
          criticalCount++;
        }
      }

      const warningCount = issueCount - criticalCount;

      if (criticalCount > 0) issueTypes.push(`${criticalCount} critical`);
      if (warningCount > 0) issueTypes.push(`${warningCount} warning`);

      analysis.failureSummary = issueTypes.length > 0 ?
        `${issueTypes.join(', ')} issue${issueCount > 1 ? 's' : ''}` :
        `${issueCount} issue${issueCount > 1 ? 's' : ''} detected`;
    }
  } else {
    analysis.qualityIssues = '';
    analysis.failureSummary = '';
  }

  // Compile unique recommendations (only if includeRecommendations is enabled)
  const shouldIncludeRecommendations = options.includeRecommendations !== false; // Default to true
  if (shouldIncludeRecommendations) {
    analysis.recommendations = Array.from(new Set(recommendations)).join(' ');
  } else {
    analysis.recommendations = '';
  }

  return analysis;
}

/**
 * Generates CSV headers for enhanced export
 */
function generateEnhancedHeaders(options: EnhancedExportOptions): string[] {
  const baseHeaders = ['Filename', 'Overall Status'];
  const includeFailureAnalysis = options.includeFailureAnalysis !== false; // Default to true
  const includeRecommendations = options.includeRecommendations !== false; // Default to true

  if (options.mode === 'metadata-only') {
    const headers = [...baseHeaders];
    if (options.includeFilenameValidation) {
      headers.push('Filename Validation Issues');
    }
    if (includeFailureAnalysis) {
      headers.push('Failure Summary');
    }
    if (includeRecommendations) {
      headers.push('Recommendations');
    }
    return headers;
  }

  if (options.mode === 'standard') {
    const headers = [
      ...baseHeaders,
      'File Type',
      'Sample Rate (Hz)',
      'Bit Depth',
      'Channels',
      'Duration',
      'File Size (Bytes)'
    ];

    if (options.includeFilenameValidation) {
      headers.push('Filename Validation Issues');
    }

    if (includeFailureAnalysis) {
      headers.push('Quality Issues', 'Failure Summary');
    }
    if (includeRecommendations) {
      headers.push('Recommendations');
    }
    return headers;
  }

  // Experimental mode
  const headers = [
    'Filename',
    'Overall Status',
    'File Type',
    'Sample Rate (Hz)',
    'Bit Depth',
    'Channels',
    'Duration (s)',
    'File Size (Bytes)',
    'Peak Level (dB)',
    'Noise Floor (dB)',
    'Normalization Status',
    'Clipping Detected',
    'Clipping Percentage (%)',
    'Reverb RT60 (s)',
    'Leading Silence (s)',
    'Trailing Silence (s)',
    'Longest Silence (s)',
    'Channel Layout',
    'Speech Overlap (%)',
    'Speech Overlap Max Duration (s)',
    'Mic Bleed Detected'
  ];

  if (options.includeFilenameValidation) {
    headers.push('Filename Validation Issues');
  }

  if (includeFailureAnalysis) {
    headers.push('Quality Issues', 'Failure Summary');
  }
  if (includeRecommendations) {
    headers.push('Recommendations');
  }
  return headers;
}

/**
 * Extracts enhanced data row for a single AudioResults object
 */
function extractEnhancedDataRow(
  result: AudioResults,
  options: EnhancedExportOptions
): string[] {
  const failureAnalysis = analyzeFailuresWithRecommendations(result, options);
  const includeFailureAnalysis = options.includeFailureAnalysis !== false; // Default to true
  const includeRecommendations = options.includeRecommendations !== false; // Default to true

  const baseRow = [result.filename, result.status];

  if (options.mode === 'metadata-only') {
    const row = [...baseRow];
    if (options.includeFilenameValidation) {
      row.push(failureAnalysis.filenameValidationIssues || '');
    }
    if (includeFailureAnalysis) {
      row.push(failureAnalysis.failureSummary);
    }
    if (includeRecommendations) {
      row.push(failureAnalysis.recommendations);
    }
    return row;
  }

  if (options.mode === 'standard') {
    const row = [
      ...baseRow,
      result.fileType || 'Unknown',
      formatSampleRateUI(result.sampleRate || 'Unknown'),
      formatBitDepth(result.bitDepth || 'Unknown'),
      formatChannels(result.channels || 'Unknown'),
      formatDuration(result.duration),
      formatBytes(result.fileSize || 0)
    ];

    if (options.includeFilenameValidation) {
      row.push(failureAnalysis.filenameValidationIssues || '');
    }

    if (includeFailureAnalysis) {
      row.push(
        failureAnalysis.qualityIssues || '',
        failureAnalysis.failureSummary
      );
    }
    if (includeRecommendations) {
      row.push(failureAnalysis.recommendations);
    }
    return row;
  }

  // Experimental mode
  const row = [
    result.filename,
    result.status,
    result.fileType || 'Unknown',
    formatSampleRateUI(result.sampleRate || 'Unknown'),
    formatBitDepth(result.bitDepth || 'Unknown'),
    formatChannels(result.channels || 'Unknown'),
    formatDuration(result.duration),
    formatBytes(result.fileSize || 0),
    formatNumber(result.peakDb),
    formatNumber(result.noiseFloorDb),
    result.normalizationStatus?.status || 'N/A',
    result.clippingAnalysis && result.clippingAnalysis.clippingEventCount > 0 ? 'Yes' : 'No',
    formatNumber(result.clippingAnalysis?.clippedPercentage),
    formatNumber(result.reverbInfo?.time),
    formatNumber(result.leadingSilence),
    formatNumber(result.trailingSilence),
    formatNumber(result.longestSilence),
    formatChannelLayout(result),
    formatNumber(result.conversationalAnalysis?.overlap?.overlapPercentage, 1),
    formatNumber(getLongestOverlapDuration(result), 1),
    getMicBleedDetected(result)
  ];

  if (options.includeFilenameValidation) {
    row.push(failureAnalysis.filenameValidationIssues || '');
  }

  if (includeFailureAnalysis) {
    row.push(
      failureAnalysis.qualityIssues || '',
      failureAnalysis.failureSummary
    );
  }
  if (includeRecommendations) {
    row.push(failureAnalysis.recommendations);
  }

  return row;
}

/**
 * Helper to get longest overlap segment duration
 */
function getLongestOverlapDuration(result: AudioResults): number | undefined {
  const overlap = result.conversationalAnalysis?.overlap as any;
  if (!overlap?.overlapSegments || overlap.overlapSegments.length === 0) {
    return undefined;
  }
  return Math.max(...overlap.overlapSegments.map((seg: any) => seg.duration));
}

/**
 * Helper to determine mic bleed detection status
 */
function getMicBleedDetected(result: AudioResults): string {
  if (!result.micBleed) return 'N/A';

  const oldDetected = result.micBleed.old &&
    (result.micBleed.old.leftChannelBleedDb > -60 || result.micBleed.old.rightChannelBleedDb > -60);
  const newDetected = result.micBleed.new &&
    (result.micBleed.new.percentageConfirmedBleed > 0.5);

  if (oldDetected || newDetected) return 'Yes';
  return 'No';
}

/**
 * Determines the source of the results (for analytics)
 */
function determineSource(results: AudioResults[]): 'local' | 'box' | 'google-drive' | 'unknown' {
  if (!results || results.length === 0) return 'unknown';

  const firstResult = results[0];
  if (firstResult.externalUrl?.includes('box.com')) return 'box';
  if (firstResult.externalUrl?.includes('drive.google.com')) return 'google-drive';
  if (firstResult.audioUrl) return 'local'; // Blob URLs are local files

  return 'unknown';
}

/**
 * Generates filename with timestamp
 */
function generateFilename(baseName: string = 'audio_analysis_results'): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${baseName}_${timestamp}.csv`;
}

/**
 * Main export function
 */
export function exportResultsToCsv(
  results: AudioResults[],
  options: ExportOptions,
  presetId?: string,
  analysisMode?: string,
  filename?: string
): void {
  const exportStartTime = Date.now();

  if (!results) {
    throw new Error('Results are null');
  }

  if (results.length === 0) {
    throw new Error('No results available to export');
  }

  try {
    const source = determineSource(results);
    const stats = getExportStats(results);

    // Track export started
    analyticsService.track('csv_export_started', {
      totalFiles: results.length,
      exportMode: options.mode,
      analysisMode,
      presetId,
      source,
    });

    // Generate headers
    const headers = generateHeaders(options.mode);

    // Generate data rows
    const dataRows = results.map(result => extractDataRow(result, options.mode));

    // Escape all values
    const csvHeaders = headers.map(escapeCsvValue).join(',');
    const csvRows = dataRows.map(row =>
      row.map(escapeCsvValue).join(',')
    );

    // Combine into final CSV string
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Add BOM for better Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create blob and download
    const blob = new Blob([csvWithBOM], {
      type: 'text/csv;charset=utf-8;'
    });

    const finalFilename = filename || generateFilename();

    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';

    // Append, click, and cleanup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup blob URL after 1 second (safer for slow browsers)
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Track export completed
    const exportTime = Date.now() - exportStartTime;
    analyticsService.track('csv_export_completed', {
      totalFiles: results.length,
      exportMode: options.mode,
      fileSize: blob.size,
      passCount: stats.passCount,
      warnCount: stats.warningCount,
      failCount: stats.failCount,
      errorCount: stats.errorCount,
      exportTime,
      source,
    });

  } catch (error) {
    console.error('Error exporting CSV:', error);

    // Track export failed
    analyticsService.track('csv_export_failed', {
      totalFiles: results.length,
      exportMode: options.mode,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: determineSource(results),
    });

    throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Enhanced export function with failure analysis and recommendations
 * Generates CSV with detailed quality analysis and actionable recommendations
 */
export function exportResultsEnhanced(
  results: AudioResults[],
  options: ExportOptions,
  presetId?: string,
  analysisMode?: string,
  currentPresetCriteria?: AudioCriteria | null,
  filename?: string,
  currentPreset?: PresetConfig | null
): void {
  const exportStartTime = Date.now();

  if (!results) {
    throw new Error('Results are null');
  }

  if (results.length === 0) {
    throw new Error('No results available to export');
  }

  try {
    const source = determineSource(results);
    const stats = getExportStats(results);

    // Determine if filename validation should be included
    // Include for 'full' and 'filename-only' modes when preset supports it
    // Exclude for 'audio-only' and 'experimental' modes (experimental is quality metrics only)
    const includeFilenameValidation = (analysisMode === 'full' || analysisMode === 'filename-only')
      ? Boolean(presetId && presetId !== 'custom')
      : false;

    // Create enhanced export options
    const enhancedOptions: EnhancedExportOptions = {
      mode: options.mode as 'standard' | 'experimental' | 'metadata-only',
      includeTimestamps: options.includeTimestamps,
      dateFormat: options.dateFormat,
      includeFilenameValidation,
      currentPresetCriteria,
      currentPreset,
      analysisMode: options.mode as 'standard' | 'experimental' | 'metadata-only',
      includeFailureAnalysis: options.includeFailureAnalysis,
      includeRecommendations: options.includeRecommendations
    };

    // Track export started
    analyticsService.track('csv_export_started', {
      totalFiles: results.length,
      exportMode: options.mode,
      analysisMode,
      presetId,
      source,
      enhanced: true,
      includeFilenameValidation
    });

    // Generate enhanced headers
    const headers = generateEnhancedHeaders(enhancedOptions);

    // Generate enhanced data rows
    const dataRows = results.map(result => extractEnhancedDataRow(result, enhancedOptions));

    // Escape all values
    const csvHeaders = headers.map(escapeCsvValue).join(',');
    const csvRows = dataRows.map(row =>
      row.map(escapeCsvValue).join(',')
    );

    // Combine into final CSV string
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Add BOM for better Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create blob and download
    const blob = new Blob([csvWithBOM], {
      type: 'text/csv;charset=utf-8;'
    });

    const finalFilename = filename || generateFilename('audio_analysis_enhanced');

    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';

    // Append, click, and cleanup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup blob URL after 1 second (safer for slow browsers)
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Track export completed
    const exportTime = Date.now() - exportStartTime;
    analyticsService.track('csv_export_completed', {
      totalFiles: results.length,
      exportMode: options.mode,
      fileSize: blob.size,
      passCount: stats.passCount,
      warnCount: stats.warningCount,
      failCount: stats.failCount,
      errorCount: stats.errorCount,
      exportTime,
      source,
      enhanced: true,
      includeFilenameValidation
    });

  } catch (error) {
    console.error('Error exporting enhanced CSV:', error);

    // Track export failed
    analyticsService.track('csv_export_failed', {
      totalFiles: results.length,
      exportMode: options.mode,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: determineSource(results),
      enhanced: true
    });

    throw new Error(`Failed to export enhanced CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Utility to get export statistics
 */
export function getExportStats(results: AudioResults[]): {
  totalFiles: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  errorCount: number;
} {
  return {
    totalFiles: results.length,
    passCount: results.filter(r => r.status === 'pass').length,
    warningCount: results.filter(r => r.status === 'warning').length,
    failCount: results.filter(r => r.status === 'fail').length,
    errorCount: results.filter(r => r.status === 'error').length
  };
}
