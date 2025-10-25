import type { PresetConfigurations } from './types';

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
