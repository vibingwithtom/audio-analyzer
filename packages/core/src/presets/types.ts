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
