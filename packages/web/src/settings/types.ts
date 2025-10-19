/**
 * Settings Module - Type Definitions
 *
 * TypeScript interfaces for all application settings including
 * criteria validation, presets, filename validation, and preferences.
 */

/**
 * Audio validation criteria for file properties
 */
export interface AudioCriteria {
  fileType: string[];
  sampleRate: string[];
  bitDepth: string[];
  channels: string[];
  minDuration: string;
}

/**
 * Preset configuration for audio validation
 */
export interface PresetConfig {
  name: string;
  fileType?: string[];
  sampleRate?: string[];
  bitDepth?: string[];
  channels?: string[];
  minDuration?: string;
  supportsFilenameValidation?: boolean;
  filenameValidationType?: 'script-match' | 'bilingual-pattern';
  gdriveOnly?: boolean;
  stereoType?: string[];                // Required stereo types for this preset
  maxOverlapWarning?: number;           // Overlap percentage threshold for warning (optional)
  maxOverlapFail?: number;              // Overlap percentage threshold for failure (optional)
  maxOverlapSegmentWarning?: number;    // Longest overlap segment duration (seconds) for warning (optional)
  maxOverlapSegmentFail?: number;       // Longest overlap segment duration (seconds) for failure (optional)
}

/**
 * Map of preset IDs to their configurations
 */
export interface PresetConfigurations {
  'auditions-character-recordings': PresetConfig;
  'auditions-studio-ai': PresetConfig;
  'auditions-bilingual-partner': PresetConfig;
  'auditions-emotional-voice': PresetConfig;
  'character-recordings': PresetConfig;
  'p2b2-pairs-mono': PresetConfig;
  'p2b2-pairs-stereo': PresetConfig;
  'p2b2-pairs-mixed': PresetConfig;
  'three-hour': PresetConfig;
  'bilingual-conversational': PresetConfig;
  'custom': PresetConfig;
  [key: string]: PresetConfig;
}

/**
 * Filename validation settings for Google Drive
 */
export interface FilenameValidationSettings {
  enableAudioAnalysis: boolean;
  enableFilenameValidation: boolean;
  speakerId: string;
  scriptsFolderUrl: string;
}

/**
 * Filename validation settings for Box
 */
export interface BoxFilenameValidationSettings {
  enableAudioAnalysis: boolean;
  enableFilenameValidation: boolean;
}

/**
 * Filename validation settings for Local files
 */
export interface LocalFilenameValidationSettings {
  enableAudioAnalysis: boolean;
  enableFilenameValidation: boolean;
}

/**
 * Peak detection mode for experimental analysis
 * - 'accurate': Full sample-by-sample scan (slower, 100% accurate)
 * - 'fast': Samples every 5th sample (60% faster, ~0.3-0.5dB typical error)
 */
export type PeakDetectionMode = 'accurate' | 'fast';

/**
 * Main application settings stored in localStorage
 */
export interface AppSettings {
  criteria?: AudioCriteria;
  includeFailureAnalysis?: boolean; // Include failure analysis in enhanced exports (default: true)
  includeRecommendations?: boolean; // Include recommendations in enhanced exports (default: true)
  peakDetectionMode?: PeakDetectionMode; // Peak detection: 'accurate' (every sample) or 'fast' (every 5th sample, 60% faster)
}

/**
 * Storage keys used for localStorage
 */
export const STORAGE_KEYS = {
  SETTINGS: 'audio-analyzer-settings',
  SELECTED_PRESET: 'audio-analyzer-selected-preset',
  FILENAME_VALIDATION: 'audio-analyzer-filename-validation',
  BOX_FILENAME_VALIDATION: 'audio-analyzer-box-filename-validation',
  LOCAL_FILENAME_VALIDATION: 'audio-analyzer-local-filename-validation',
  DARK_MODE: 'darkMode',
  BOX_JUST_AUTHENTICATED: 'box_just_authenticated',
  INCLUDE_FAILURE_ANALYSIS: 'audio-analyzer-include-failure-analysis',
  INCLUDE_RECOMMENDATIONS: 'audio-analyzer-include-recommendations'
} as const;

/**
 * Default preset configurations
 */
export const DEFAULT_PRESETS: PresetConfigurations = {
  'auditions-character-recordings': {
    name: 'Auditions: Character Recordings',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['24'],
    channels: ['1'],
    minDuration: '120' // 2 minutes
  },
  'auditions-studio-ai': {
    name: 'Auditions: Studio AI',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['24'],
    channels: ['1'],
    minDuration: '120' // 2 minutes
  },
  'auditions-bilingual-partner': {
    name: 'Auditions: Bilingual Partner',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['24'],
    channels: ['1'],
    minDuration: '150' // 2 minutes 30 seconds
  },
  'auditions-emotional-voice': {
    name: 'Auditions: Emotional Voice',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['16', '24'],
    channels: ['1', '2'],
    minDuration: '5'
  },
  'character-recordings': {
    name: 'Character Recordings',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['24'],
    channels: ['1'],
    minDuration: '' // No requirement
  },
  'p2b2-pairs-mono': {
    name: 'P2B2 Pairs (Mono)',
    fileType: ['wav'],
    sampleRate: ['44100', '48000'],
    bitDepth: ['16', '24'],
    channels: ['1'],
    minDuration: ''
  },
  'p2b2-pairs-stereo': {
    name: 'P2B2 Pairs (Stereo)',
    fileType: ['wav'],
    sampleRate: ['44100', '48000'],
    bitDepth: ['16', '24'],
    channels: ['2'],
    minDuration: '',
    stereoType: ['Conversational Stereo'],
    maxOverlapWarning: 3,
    maxOverlapFail: 8,
    maxOverlapSegmentWarning: 2,
    maxOverlapSegmentFail: 5
  },
  'p2b2-pairs-mixed': {
    name: 'P2B2 Pairs (Mixed)',
    fileType: ['wav'],
    sampleRate: ['44100', '48000'],
    bitDepth: ['16', '24'],
    channels: ['1', '2'],
    minDuration: '',
    // Note: stereoType validation only applies to 2-channel files
    // Mono files (1 channel) skip stereo validation entirely
    stereoType: ['Conversational Stereo'],
    maxOverlapWarning: 3,
    maxOverlapFail: 8,
    maxOverlapSegmentWarning: 2,
    maxOverlapSegmentFail: 5
  },
  'three-hour': {
    name: 'Three Hour',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['24'],
    channels: ['1'],
    minDuration: '',
    supportsFilenameValidation: true,
    filenameValidationType: 'script-match', // Requires matching .txt script file
    gdriveOnly: true // Only available on Google Drive tab
  },
  'bilingual-conversational': {
    name: 'Bilingual Conversational',
    fileType: ['wav'],
    sampleRate: ['48000'],
    bitDepth: ['16', '24'],
    channels: ['2'],
    minDuration: '',
    supportsFilenameValidation: true,
    filenameValidationType: 'bilingual-pattern', // Validates [ConversationID]-[LangCode]-user-[UserID]-agent-[AgentID]
    stereoType: ['Conversational Stereo'],
    maxOverlapWarning: 5,
    maxOverlapFail: 10,
    maxOverlapSegmentWarning: 2,
    maxOverlapSegmentFail: 5
  },
  'custom': {
    name: 'Custom'
    // Custom allows manual selection of individual criteria
  }
};
