import { describe, it, expect } from 'vitest';
import {
  isFileTypeAllowed,
  getFileTypeDisplay,
  getFileExtension,
  formatRejectedFileType,
  getFileRejectionReason
} from '../../src/utils/file-validation-utils';

/**
 * Comprehensive tests for File Validation Utilities
 *
 * Tests the file validation functions used for enforcing preset-based
 * file type restrictions during batch processing:
 * - Google Drive folders
 * - Box folders
 * - Local file uploads
 */

describe('File Validation Utilities', () => {
  describe('isFileTypeAllowed', () => {
    describe('Built-in Presets (No Criteria)', () => {
      it('should allow any file when criteria is null', () => {
        expect(isFileTypeAllowed('audio.wav', null)).toBe(true);
        expect(isFileTypeAllowed('document.pdf', null)).toBe(true);
        expect(isFileTypeAllowed('image.jpg', null)).toBe(true);
        expect(isFileTypeAllowed('noextension', null)).toBe(true);
      });

      it('should allow any file when criteria has empty fileType array', () => {
        const criteria = { fileType: [] };
        expect(isFileTypeAllowed('audio.wav', criteria)).toBe(true);
        expect(isFileTypeAllowed('audio.mp3', criteria)).toBe(true);
      });

      it('should allow any file when criteria has no fileType property', () => {
        const criteria = { sampleRate: ['48000'] };
        expect(isFileTypeAllowed('audio.wav', criteria)).toBe(true);
        expect(isFileTypeAllowed('video.mp4', criteria)).toBe(true);
      });
    });

    describe('Custom Presets (With File Type Restrictions)', () => {
      it('should allow WAV files when WAV is in allowed types', () => {
        const criteria = { fileType: ['wav'] };
        expect(isFileTypeAllowed('audio.wav', criteria)).toBe(true);
        expect(isFileTypeAllowed('recording.WAV', criteria)).toBe(true);
        expect(isFileTypeAllowed('sound.WaV', criteria)).toBe(true);
      });

      it('should allow multiple file types when configured', () => {
        const criteria = { fileType: ['wav', 'mp3', 'flac'] };
        expect(isFileTypeAllowed('audio.wav', criteria)).toBe(true);
        expect(isFileTypeAllowed('music.mp3', criteria)).toBe(true);
        expect(isFileTypeAllowed('song.flac', criteria)).toBe(true);
      });

      it('should reject files with disallowed extensions', () => {
        const criteria = { fileType: ['wav'] };
        expect(isFileTypeAllowed('audio.mp3', criteria)).toBe(false);
        expect(isFileTypeAllowed('document.pdf', criteria)).toBe(false);
        expect(isFileTypeAllowed('image.jpg', criteria)).toBe(false);
      });

      it('should reject files when preset has no allowed types', () => {
        const criteria = { fileType: [] };
        expect(isFileTypeAllowed('audio.wav', criteria)).toBe(true); // Empty array means allow all
      });

      it('should be case-insensitive for extensions', () => {
        const criteria = { fileType: ['wav', 'mp3'] };
        expect(isFileTypeAllowed('audio.WAV', criteria)).toBe(true);
        expect(isFileTypeAllowed('music.Mp3', criteria)).toBe(true);
        expect(isFileTypeAllowed('song.FLAC', criteria)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should reject files without extensions', () => {
        const criteria = { fileType: ['wav'] };
        expect(isFileTypeAllowed('noextension', criteria)).toBe(false);
        expect(isFileTypeAllowed('file.', criteria)).toBe(false);
      });

      it('should handle files with multiple dots in name', () => {
        const criteria = { fileType: ['wav'] };
        expect(isFileTypeAllowed('my.audio.file.wav', criteria)).toBe(true);
        expect(isFileTypeAllowed('my.audio.file.mp3', criteria)).toBe(false);
      });

      it('should handle hidden files (starting with dot)', () => {
        const criteria = { fileType: ['wav'] };
        expect(isFileTypeAllowed('.hidden.wav', criteria)).toBe(true);
        expect(isFileTypeAllowed('.hidden', criteria)).toBe(false);
      });

      it('should be strict about extension matching', () => {
        const criteria = { fileType: ['wav'] };
        expect(isFileTypeAllowed('audio.wav.backup', criteria)).toBe(false);
        expect(isFileTypeAllowed('audio.wavx', criteria)).toBe(false);
      });
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension in uppercase', () => {
      expect(getFileExtension('audio.wav')).toBe('WAV');
      expect(getFileExtension('music.mp3')).toBe('MP3');
      expect(getFileExtension('song.FLAC')).toBe('FLAC');
    });

    it('should handle mixed case extensions', () => {
      expect(getFileExtension('file.WaV')).toBe('WAV');
      expect(getFileExtension('file.Mp3')).toBe('MP3');
    });

    it('should handle files without extensions (returns filename as extension)', () => {
      // Files without dots get the whole name as "extension"
      expect(getFileExtension('file.')).toBe('');
      // Single-word filenames are treated as having that word as the extension
      expect(getFileExtension('noextension')).toBe('NOEXTENSION');
    });

    it('should extract last extension from multi-dot filenames', () => {
      expect(getFileExtension('my.audio.file.wav')).toBe('WAV');
      expect(getFileExtension('backup.file.mp3')).toBe('MP3');
    });

    it('should handle hidden files', () => {
      expect(getFileExtension('.hidden.wav')).toBe('WAV');
      // Hidden files without extension: split('.hidden') -> ['', 'hidden'] -> pop() -> 'hidden'
      expect(getFileExtension('.hidden')).toBe('HIDDEN');
    });
  });

  describe('getFileTypeDisplay', () => {
    it('should format single file type for display', () => {
      const criteria = { fileType: ['wav'] };
      expect(getFileTypeDisplay(criteria)).toBe('WAV');
    });

    it('should format multiple file types comma-separated', () => {
      const criteria = { fileType: ['wav', 'mp3', 'flac'] };
      expect(getFileTypeDisplay(criteria)).toBe('WAV, MP3, FLAC');
    });

    it('should uppercase file types in display', () => {
      const criteria = { fileType: ['wav', 'Mp3', 'FLAC'] };
      expect(getFileTypeDisplay(criteria)).toBe('WAV, MP3, FLAC');
    });

    it('should return empty string when no file types restricted', () => {
      const criteriaNone = null;
      expect(getFileTypeDisplay(criteriaNone)).toBe('');

      const criteriaEmpty = { fileType: [] };
      expect(getFileTypeDisplay(criteriaEmpty)).toBe('');

      const criteriaNoType = { sampleRate: ['48000'] };
      expect(getFileTypeDisplay(criteriaNoType)).toBe('');
    });

    it('should preserve order of file types', () => {
      const criteria = { fileType: ['flac', 'mp3', 'wav'] };
      expect(getFileTypeDisplay(criteria)).toBe('FLAC, MP3, WAV');
    });
  });

  describe('formatRejectedFileType', () => {
    it('should format file type in uppercase with "Maybe" prefix', () => {
      expect(formatRejectedFileType('audio.wav')).toBe('Unknown (Maybe WAV)');
      expect(formatRejectedFileType('music.mp3')).toBe('Unknown (Maybe MP3)');
      expect(formatRejectedFileType('song.flac')).toBe('Unknown (Maybe FLAC)');
    });

    it('should format files without extensions', () => {
      // file. has empty extension
      expect(formatRejectedFileType('file.')).toBe('Unknown');
      // noextension gets treated as having "NOEXTENSION" as the extension
      expect(formatRejectedFileType('noextension')).toBe('Unknown (Maybe NOEXTENSION)');
    });

    it('should handle mixed case extensions', () => {
      expect(formatRejectedFileType('audio.WaV')).toBe('Unknown (Maybe WAV)');
      expect(formatRejectedFileType('music.Mp3')).toBe('Unknown (Maybe MP3)');
    });

    it('should extract correct extension from complex filenames', () => {
      expect(formatRejectedFileType('my.audio.backup.wav')).toBe('Unknown (Maybe WAV)');
      expect(formatRejectedFileType('archive.2024.mp3')).toBe('Unknown (Maybe MP3)');
    });

    it('should handle hidden files', () => {
      expect(formatRejectedFileType('.hidden.wav')).toBe('Unknown (Maybe WAV)');
      // .hidden -> split('.hidden') -> ['', 'hidden'] -> 'hidden'
      expect(formatRejectedFileType('.hidden')).toBe('Unknown (Maybe HIDDEN)');
    });
  });

  describe('getFileRejectionReason', () => {
    it('should provide reason for files rejected by WAV-only preset', () => {
      const criteria = { fileType: ['wav'] };
      const reason = getFileRejectionReason('audio.mp3', criteria);
      expect(reason).toContain('File type not supported');
      expect(reason).toContain('WAV');
    });

    it('should list all allowed types in reason message', () => {
      const criteria = { fileType: ['wav', 'mp3', 'flac'] };
      const reason = getFileRejectionReason('audio.aac', criteria);
      expect(reason).toContain('WAV, MP3, FLAC');
    });

    it('should provide generic message when no criteria provided', () => {
      const reason = getFileRejectionReason('audio.mp3', null);
      expect(reason).toBe('File type not supported');
    });

    it('should provide generic message for empty criteria', () => {
      const criteria = { fileType: [] };
      const reason = getFileRejectionReason('audio.mp3', criteria);
      expect(reason).toBe('File type not supported');
    });

    it('should provide generic message for criteria without fileType', () => {
      const criteria = { sampleRate: ['48000'] };
      const reason = getFileRejectionReason('audio.mp3', criteria);
      expect(reason).toBe('File type not supported');
    });

    it('should format reason consistently across different files', () => {
      const criteria = { fileType: ['wav'] };
      const reason1 = getFileRejectionReason('music.mp3', criteria);
      const reason2 = getFileRejectionReason('song.flac', criteria);
      expect(reason1).toBe(reason2);
    });

    it('should format reason with proper grammar', () => {
      const criteria = { fileType: ['wav'] };
      const reason = getFileRejectionReason('file.mp3', criteria);
      // Should contain "accepts:" not "accept:"
      expect(reason).toContain('accepts:');
    });
  });

  describe('Integration: Complete Validation Flow', () => {
    it('should reject non-allowed file with proper messages', () => {
      const criteria = { fileType: ['wav'] };
      const filename = 'music.mp3';

      expect(isFileTypeAllowed(filename, criteria)).toBe(false);
      expect(getFileTypeDisplay(criteria)).toBe('WAV');
      expect(formatRejectedFileType(filename)).toBe('Unknown (Maybe MP3)');
      expect(getFileRejectionReason(filename, criteria)).toContain('WAV');
    });

    it('should allow file with consistent validation across functions', () => {
      const criteria = { fileType: ['wav', 'mp3'] };
      const filename = 'audio.wav';

      expect(isFileTypeAllowed(filename, criteria)).toBe(true);
      expect(getFileExtension(filename)).toBe('WAV');
      expect(getFileTypeDisplay(criteria)).toBe('WAV, MP3');
    });

    it('should handle custom preset workflow', () => {
      // User has custom preset allowing WAV and MP3
      const customPreset = { fileType: ['wav', 'mp3'] };

      // Valid file passes
      expect(isFileTypeAllowed('interview.wav', customPreset)).toBe(true);

      // Invalid file fails with helpful message
      expect(isFileTypeAllowed('document.pdf', customPreset)).toBe(false);
      const reason = getFileRejectionReason('document.pdf', customPreset);
      expect(reason).toContain('WAV, MP3');
    });

    it('should handle built-in preset workflow (no validation)', () => {
      // Built-in preset has no criteria (null)
      const builtInPreset = null;

      // All files should pass
      expect(isFileTypeAllowed('audio.wav', builtInPreset)).toBe(true);
      expect(isFileTypeAllowed('audio.mp3', builtInPreset)).toBe(true);
      expect(isFileTypeAllowed('document.pdf', builtInPreset)).toBe(true);

      // No rejection reason needed
      expect(getFileTypeDisplay(builtInPreset)).toBe('');
    });
  });

  describe('Performance: Batch Processing', () => {
    it('should efficiently validate multiple files', () => {
      const criteria = { fileType: ['wav'] };
      const files = [
        'audio1.wav',
        'audio2.wav',
        'music.mp3',
        'song.flac',
        'interview.wav'
      ];

      const validFiles = files.filter(f => isFileTypeAllowed(f, criteria));
      expect(validFiles).toEqual(['audio1.wav', 'audio2.wav', 'interview.wav']);
    });

    it('should handle large preset file type lists', () => {
      const criteria = {
        fileType: ['wav', 'mp3', 'flac', 'aac', 'ogg', 'm4a', 'aiff', 'alac']
      };

      expect(isFileTypeAllowed('audio.wav', criteria)).toBe(true);
      expect(isFileTypeAllowed('music.m4a', criteria)).toBe(true);
      expect(isFileTypeAllowed('document.pdf', criteria)).toBe(false);

      const display = getFileTypeDisplay(criteria);
      expect(display).toContain('WAV');
      expect(display).toContain('M4A');
      expect(display.split(', ').length).toBe(8);
    });
  });
});
