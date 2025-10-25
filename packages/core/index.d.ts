// Type definitions for @audio-analyzer/core

// Existing JavaScript module exports
export { AudioAnalyzer } from './audio-analyzer.js';
export { LevelAnalyzer, AnalysisCancelledError } from './level-analyzer.js';
export { CriteriaValidator } from './criteria-validator.js';
export { GoogleDriveHandler } from './google-drive.js';
export { StreamingAudioAnalyzer, BatchProcessor } from './batch-processor.js';

// NEW TypeScript module exports
export type { AudioCriteria, PresetConfig, PresetConfigurations } from './dist/presets/index.js';
export { DEFAULT_PRESETS } from './dist/presets/index.js';

export { formatSampleRate, formatDuration, formatBitDepth, formatChannels, formatBytes } from './dist/formatters/index.js';

export {
  getNormalizationStatus,
  getReverbStatus,
  getNoiseFloorStatus,
  getSilenceStatus,
  getClippingStatus,
  getMicBleedStatus,
  computeExperimentalStatus
} from './dist/evaluators/index.js';

export type { ValidationResult, BilingualValidationData } from './dist/validation/index.js';
export { FilenameValidator } from './dist/validation/index.js';

// AudioAnalyzerEngine convenience class
export class AudioAnalyzerEngine {
  constructor();
  audioAnalyzer: AudioAnalyzer;
  levelAnalyzer: LevelAnalyzer;
  googleDrive: GoogleDriveHandler;
  analyzeFile(file: File): Promise<any>;
  analyzeAdvanced(audioBuffer: AudioBuffer, progressCallback?: (message: string, progress: number) => void): Promise<any>;
  validateCriteria(results: any, criteria: any): any;
  formatResults(results: any): any;
  formatAdvancedResults(results: any): any;
  cancelAdvancedAnalysis(): void;
  downloadGoogleDriveFile(url: string, accessToken?: string | null): Promise<File>;
  downloadGoogleDriveFileDirect(url: string): Promise<File>;
  setGoogleDriveToken(token: string): void;
}
