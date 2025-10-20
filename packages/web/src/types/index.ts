export interface ClippingAnalysis {
  clippedPercentage: number;
  clippingEventCount: number;
  nearClippingPercentage: number;
}

export interface ConversationalAnalysis {
  overlap?: {
    overlapPercentage: number;
  };
}

export interface AudioResults {
  filename: string;
  status: 'pass' | 'fail' | 'warning' | 'error';
  fileType?: string; // File type/extension
  sampleRate: number | 'Unknown';
  bitDepth: number | 'Unknown';
  channels: number | 'Unknown';
  duration: number | 'Unknown';
  fileSize: number;
  audioUrl?: string; // Blob URL for local playback
  externalUrl?: string; // External URL for Box/Google Drive
  validation?: ValidationResults;
  isMetadataOnly?: boolean;
  error?: string; // Error message for failed/error status
  // Experimental analysis properties
  peakDb?: number;
  noiseFloor?: number;
  noiseFloorDb?: number;
  reverbInfo?: any;
  silenceInfo?: any;
  normalizationStatus?: any;
  stereoSeparation?: any;
  micBleed?: any;
  // CSV export properties
  clippingAnalysis?: ClippingAnalysis;
  conversationalAnalysis?: ConversationalAnalysis;
  leadingSilence?: number;
  trailingSilence?: number;
  longestSilence?: number;
  digitalSilencePercentage?: number;
}

export interface ValidationResult {
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  value: string;
  issue?: string;
}

export interface ValidationResults {
  [key: string]: ValidationResult;
}
