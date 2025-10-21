/**
 * Mock Data Fixtures
 *
 * Centralized mock data for testing across all component tests
 */

/**
 * Mock audio file data
 */
export const MOCK_AUDIO_FILES = {
  wav: {
    name: 'interview.wav',
    size: 5242880, // 5MB
    type: 'audio/wav',
    duration: 180,
    sampleRate: 48000,
    bitDepth: 16,
    channels: 2,
  },
  mp3: {
    name: 'music.mp3',
    size: 2097152, // 2MB
    type: 'audio/mpeg',
    duration: 240,
    sampleRate: 44100,
    bitDepth: 128,
    channels: 2,
  },
  flac: {
    name: 'recording.flac',
    size: 8388608, // 8MB
    type: 'audio/flac',
    duration: 300,
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
  },
};

/**
 * Mock analysis results for testing
 */
export const MOCK_ANALYSIS_RESULTS = [
  {
    filename: 'interview-01.wav',
    status: 'pass',
    duration: 180,
    sampleRate: 48000,
    bitDepth: 16,
    channels: 2,
    criteria: 'Auditions',
    timestamp: new Date().toISOString(),
  },
  {
    filename: 'interview-02.wav',
    status: 'fail',
    duration: 90,
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    criteria: 'Auditions',
    errors: ['Duration is too short (90s < 120s required)'],
    timestamp: new Date().toISOString(),
  },
  {
    filename: 'interview-03.wav',
    status: 'warning',
    duration: 180,
    sampleRate: 48000,
    bitDepth: 16,
    channels: 1,
    criteria: 'Auditions',
    warnings: ['Mono audio detected (stereo recommended)'],
    timestamp: new Date().toISOString(),
  },
];

/**
 * Mock presets
 */
export const MOCK_PRESETS = {
  auditions: {
    id: 'auditions',
    name: 'Auditions',
    description: 'Standard audition requirements',
    criteria: {
      fileType: ['wav', 'mp3'],
      sampleRate: [44100, 48000],
      bitDepth: [16, 24],
      channels: [1, 2],
      duration: { min: 120, max: 300 },
    },
  },
  conversational: {
    id: 'conversational',
    name: 'Bilingual Conversational',
    description: 'Bilingual conversation audio',
    criteria: {
      fileType: ['wav'],
      sampleRate: [16000, 44100, 48000],
      bitDepth: [16],
      channels: [1, 2],
      duration: { min: 60, max: 3600 },
    },
  },
  threehour: {
    id: 'threehour',
    name: 'Three Hour',
    description: 'Three hour session recordings',
    criteria: {
      fileType: ['wav'],
      sampleRate: [48000],
      bitDepth: [16, 24],
      channels: [2],
      duration: { min: 10800, max: null },
    },
  },
};

/**
 * Mock Google Drive files
 */
export const MOCK_GOOGLE_DRIVE_FILES = [
  {
    id: 'file-123',
    name: 'Interview_John_Doe.wav',
    mimeType: 'audio/wav',
    size: 5242880,
    createdTime: '2025-10-01T10:00:00Z',
    webViewLink: 'https://drive.google.com/file/d/file-123/view',
  },
  {
    id: 'file-456',
    name: 'Interview_Jane_Smith.wav',
    mimeType: 'audio/wav',
    size: 4194304,
    createdTime: '2025-10-02T11:30:00Z',
    webViewLink: 'https://drive.google.com/file/d/file-456/view',
  },
  {
    id: 'file-789',
    name: 'Conversation_Session_001.wav',
    mimeType: 'audio/wav',
    size: 10737418240, // 10GB
    createdTime: '2025-10-03T14:15:00Z',
    webViewLink: 'https://drive.google.com/file/d/file-789/view',
  },
];

/**
 * Mock Google Drive folder
 */
export const MOCK_GOOGLE_DRIVE_FOLDER = {
  id: 'folder-123',
  name: 'Audio Files - Auditions',
  mimeType: 'application/vnd.google-apps.folder',
  webViewLink: 'https://drive.google.com/drive/folders/folder-123',
  files: MOCK_GOOGLE_DRIVE_FILES,
};

/**
 * Mock settings state
 */
export const MOCK_SETTINGS = {
  selectedPreset: 'auditions',
  customCriteria: null,
  analyzeMode: 'audio-only',
  exportFormat: 'csv',
  theme: 'light',
  notifications: true,
  autoExport: false,
  exportPath: null,
};

/**
 * Mock application state
 */
export const MOCK_APP_STATE = {
  currentTab: 'local',
  files: [],
  results: [],
  isProcessing: false,
  progress: 0,
  selectedPreset: 'auditions',
  theme: 'light',
};

/**
 * Mock error messages
 */
export const MOCK_ERROR_MESSAGES = {
  FILE_TYPE_NOT_SUPPORTED: 'File type not supported. This preset accepts: WAV, MP3',
  DURATION_TOO_SHORT: 'Duration is too short (90s < 120s required)',
  SAMPLE_RATE_INVALID: 'Sample rate not supported (32kHz, expected 44.1kHz or 48kHz)',
  BIT_DEPTH_INVALID: 'Bit depth not supported (8-bit, expected 16-bit or 24-bit)',
  CHANNELS_INVALID: 'Channel count not supported (1 channel, expected 2 channels)',
  FILE_NOT_FOUND: 'File not found or access denied',
  NETWORK_ERROR: 'Network error - please check your connection',
};

/**
 * Mock OAuth responses
 */
export const MOCK_OAUTH_RESPONSES = {
  google: {
    access_token: 'ya29.a0AfH6SMBx...',
    expires_in: 3599,
    refresh_token: '1//0gF...',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    token_type: 'Bearer',
  },
  box: {
    access_token: 'T9cE5asXyFSAB...',
    expires_in: 3600,
    refresh_token: 'J7rxTiWaU...',
    token_type: 'bearer',
  },
};

/**
 * Mock file validation results
 */
export const MOCK_FILE_VALIDATION = {
  valid: {
    filename: 'interview.wav',
    extension: 'wav',
    isAllowed: true,
    errors: [],
  },
  invalid_type: {
    filename: 'document.pdf',
    extension: 'pdf',
    isAllowed: false,
    errors: ['File type not supported (PDF)'],
  },
  invalid_name: {
    filename: '',
    extension: '',
    isAllowed: false,
    errors: ['Invalid filename (empty)'],
  },
};

/**
 * Mock batch processing job
 */
export const MOCK_BATCH_JOB = {
  id: 'job-123',
  status: 'processing',
  totalFiles: 10,
  processedFiles: 7,
  failedFiles: 1,
  progress: 70,
  startTime: new Date(Date.now() - 60000).toISOString(),
  estimatedTimeRemaining: 25000, // ms
};

/**
 * Mock export data
 */
export const MOCK_EXPORT_DATA = {
  csv: 'filename,status,duration,sampleRate,bitDepth,channels\ninterview.wav,pass,180,48000,16,2',
  json: [
    {
      filename: 'interview.wav',
      status: 'pass',
      duration: 180,
      sampleRate: 48000,
      bitDepth: 16,
      channels: 2,
    },
  ],
  xlsx: 'binary_encoded_data',
};
