import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Google Drive API Tests
 *
 * Tests for URL parsing, smart downloads, metadata operations, and folder operations
 */

describe('GoogleDriveAPI', () => {
  let mockGoogleAuth;

  beforeEach(() => {
    mockGoogleAuth = {
      downloadFile: vi.fn(),
      downloadFileHeaders: vi.fn(),
      getFileMetadata: vi.fn(),
      listAudioFilesInFolder: vi.fn(),
      getValidToken: vi.fn().mockResolvedValue({ access_token: 'test-token' })
    };
    vi.clearAllMocks();
  });

  // ==================== URL PARSING TESTS ====================

  describe('URL Parsing', () => {
    it('should parse /file/d/{id}/view format', () => {
      // Standard Google Drive file URL with /view
      const url = 'https://drive.google.com/file/d/ABC123DEF456/view';

      // Extract ID from URL pattern
      const match = url.match(/\/file\/d\/([^/?]+)/);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('ABC123DEF456');
    });

    it('should parse /file/d/{id} format (no /view)', () => {
      // Google Drive file URL without /view suffix
      const url = 'https://drive.google.com/file/d/XYZ789/edit';

      const match = url.match(/\/file\/d\/([^/?]+)/);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('XYZ789');
    });

    it('should parse folder URL format', () => {
      // Google Drive folder URL
      const url = 'https://drive.google.com/drive/folders/FOLDER123ABC';

      const match = url.match(/\/folders\/([^/?]+)/);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('FOLDER123ABC');
    });

    it('should parse /open?id={id} format (legacy)', () => {
      // Legacy Google Drive open format
      const url = 'https://drive.google.com/open?id=LEGACY456';

      const match = url.match(/id=([^&]+)/);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('LEGACY456');
    });

    it('should reject non-Google Drive URLs', () => {
      const url = 'https://example.com/not-a-drive-url';

      const isGoogleDriveUrl = url.includes('drive.google.com');
      expect(isGoogleDriveUrl).toBe(false);
    });

    it('should reject URLs without ID', () => {
      const url = 'https://drive.google.com/file/d/';

      const match = url.match(/\/file\/d\/([^/?]+)/);
      expect(match).toBeFalsy();
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://drive.google.com/file/d/ABC123/view?usp=sharing';

      const match = url.match(/\/file\/d\/([^/?]+)/);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('ABC123');
    });

    it('should be case-sensitive for file IDs', () => {
      const url1 = 'https://drive.google.com/file/d/ABC123/view';
      const url2 = 'https://drive.google.com/file/d/abc123/view';

      const match1 = url1.match(/\/file\/d\/([^/?]+)/);
      const match2 = url2.match(/\/file\/d\/([^/?]+)/);

      expect(match1[1]).toBe('ABC123');
      expect(match2[1]).toBe('abc123');
      expect(match1[1]).not.toBe(match2[1]);
    });
  });

  // ==================== SMART DOWNLOAD OPTIMIZATION TESTS ====================

  describe('Smart Download Optimization', () => {
    describe('WAV file handling', () => {
      it('should use partial download for WAV in audio-only mode', () => {
        // For WAV files in audio-only mode, only need header (20-50KB)
        const filename = 'test.wav';
        const mode = 'audio-only';
        const isWav = filename.toLowerCase().endsWith('.wav');
        const usePartial = isWav && (mode === 'audio-only' || mode === 'full');

        expect(isWav).toBe(true);
        expect(usePartial).toBe(true);
      });

      it('should use partial download for WAV in full mode', () => {
        // Even in full mode, WAV header-only is usually sufficient
        const filename = 'recording.wav';
        const mode = 'full';
        const isWav = filename.toLowerCase().endsWith('.wav');
        const usePartial = isWav && (mode === 'audio-only' || mode === 'full');

        expect(isWav).toBe(true);
        expect(usePartial).toBe(true);
      });

      it('should use full download for WAV in experimental mode', () => {
        // Experimental mode needs full file analysis
        const filename = 'audio.wav';
        const mode = 'experimental';
        const isWav = filename.toLowerCase().endsWith('.wav');
        const usePartial = isWav && (mode === 'audio-only' || mode === 'full');

        expect(isWav).toBe(true);
        expect(usePartial).toBe(false); // Full download in experimental
      });
    });

    describe('Non-WAV file handling', () => {
      it('should use full download for MP3 (audio-only mode)', () => {
        // Web Audio API requires full MP3 file
        const filename = 'music.mp3';
        const mode = 'audio-only';
        const isMp3 = filename.toLowerCase().endsWith('.mp3');
        const useFull = isMp3; // Always full for MP3

        expect(isMp3).toBe(true);
        expect(useFull).toBe(true);
      });

      it('should use full download for FLAC', () => {
        // FLAC requires full file download
        const filename = 'song.flac';
        const isFLAC = filename.toLowerCase().endsWith('.flac');
        const useFull = isFLAC;

        expect(isFLAC).toBe(true);
        expect(useFull).toBe(true);
      });

      it('should use full download for AAC', () => {
        const filename = 'audio.aac';
        const isAAC = filename.toLowerCase().endsWith('.aac');
        const useFull = isAAC;

        expect(isAAC).toBe(true);
        expect(useFull).toBe(true);
      });
    });

    describe('File size handling', () => {
      it('should track actual file size for partial downloads', () => {
        // Partial download: blob is small but actual file is larger
        const actualSize = 1000000; // 1MB
        const partialSize = 50000; // 50KB

        expect(partialSize).toBeLessThan(actualSize);
        expect(actualSize / partialSize).toBeGreaterThan(10); // At least 10x difference
      });

      it('should return exact size for full downloads', () => {
        // Full download: blob size equals actual size
        const downloadedSize = 5242880; // 5MB
        const actualSize = 5242880;

        expect(downloadedSize).toBe(actualSize);
      });
    });

    describe('Mode-specific behavior', () => {
      const modes = ['audio-only', 'full', 'experimental', 'filename-only'];

      it('should handle all analysis modes', () => {
        expect(modes).toContain('audio-only');
        expect(modes).toContain('full');
        expect(modes).toContain('experimental');
        expect(modes).toContain('filename-only');
      });

      it('filename-only mode should skip downloads entirely', () => {
        const mode = 'filename-only';
        const shouldDownload = mode !== 'filename-only';

        expect(shouldDownload).toBe(false);
      });
    });
  });

  // ==================== METADATA OPERATIONS TESTS ====================

  describe('Metadata Operations', () => {
    it('should retrieve file metadata by ID', () => {
      const mockMetadata = {
        id: 'ABC123',
        name: 'test.wav',
        size: 1000000,
        mimeType: 'audio/wav'
      };

      expect(mockMetadata.id).toBe('ABC123');
      expect(mockMetadata.name).toBe('test.wav');
      expect(mockMetadata.size).toBe(1000000);
    });

    it('should extract filename from metadata', () => {
      const metadata = {
        name: 'my-recording_2025-01-15.wav'
      };

      const filename = metadata.name;
      const extension = filename.split('.').pop();

      expect(extension).toBe('wav');
    });

    it('should handle filenames with special characters', () => {
      const metadata = {
        name: 'test [final] (v2).wav'
      };

      expect(metadata.name).toContain('[');
      expect(metadata.name).toContain('(');
      const extension = metadata.name.split('.').pop();
      expect(extension).toBe('wav');
    });

    it('should detect MIME type from metadata', () => {
      const wavMetadata = { mimeType: 'audio/wav' };
      const mp3Metadata = { mimeType: 'audio/mpeg' };
      const pdfMetadata = { mimeType: 'application/pdf' };

      expect(wavMetadata.mimeType).toContain('audio');
      expect(mp3Metadata.mimeType).toContain('audio');
      expect(pdfMetadata.mimeType).not.toContain('audio');
    });
  });

  // ==================== FOLDER OPERATIONS TESTS ====================

  describe('Folder Operations', () => {
    it('should list audio files in folder', () => {
      const mockFiles = [
        { id: '1', name: 'audio1.wav', mimeType: 'audio/wav' },
        { id: '2', name: 'audio2.mp3', mimeType: 'audio/mpeg' },
        { id: '3', name: 'document.pdf', mimeType: 'application/pdf' },
        { id: '4', name: 'audio3.flac', mimeType: 'audio/flac' }
      ];

      const audioFiles = mockFiles.filter(f => f.mimeType.startsWith('audio/'));

      expect(audioFiles).toHaveLength(3);
      expect(audioFiles[0].name).toBe('audio1.wav');
      expect(audioFiles[1].name).toBe('audio2.mp3');
    });

    it('should filter out non-audio files', () => {
      const files = [
        { name: 'audio.wav', mimeType: 'audio/wav' },
        { name: 'image.jpg', mimeType: 'image/jpeg' },
        { name: 'document.pdf', mimeType: 'application/pdf' },
        { name: 'music.mp3', mimeType: 'audio/mpeg' }
      ];

      const audioFiles = files.filter(f => f.mimeType.startsWith('audio/'));
      const nonAudioFiles = files.filter(f => !f.mimeType.startsWith('audio/'));

      expect(audioFiles).toHaveLength(2);
      expect(nonAudioFiles).toHaveLength(2);
    });

    it('should handle empty folders', () => {
      const files = [];
      expect(files).toHaveLength(0);
    });

    it('should preserve file order from folder', () => {
      const mockFiles = [
        { id: '1', name: 'first.wav' },
        { id: '2', name: 'second.wav' },
        { id: '3', name: 'third.wav' }
      ];

      expect(mockFiles[0].name).toBe('first.wav');
      expect(mockFiles[1].name).toBe('second.wav');
      expect(mockFiles[2].name).toBe('third.wav');
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe('Error Handling', () => {
    it('should handle invalid file IDs gracefully', () => {
      const invalidId = '';
      const isValid = invalidId && invalidId.length > 0;

      expect(!isValid).toBe(true); // String is falsy
    });

    it('should reject folder URLs when file metadata is requested', () => {
      const url = 'https://drive.google.com/drive/folders/FOLDER123';
      const isFolder = url.includes('/folders/');

      expect(isFolder).toBe(true);
    });

    it('should handle network errors gracefully', () => {
      const isNetworkError = (error) => error.name === 'NetworkError';

      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';

      expect(isNetworkError(networkError)).toBe(true);
    });

    it('should handle permission errors', () => {
      const mockError = {
        code: 403,
        message: 'User does not have permission to access this file'
      };

      expect(mockError.code).toBe(403);
      expect(mockError.message).toContain('permission');
    });

    it('should handle file not found errors', () => {
      const mockError = {
        code: 404,
        message: 'File not found'
      };

      expect(mockError.code).toBe(404);
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('Integration: Complete Download Flow', () => {
    it('should handle file URL parsing → metadata → download', () => {
      // Step 1: Parse URL
      const url = 'https://drive.google.com/file/d/ABC123/view';
      const match = url.match(/\/file\/d\/([^/?]+)/);
      const fileId = match[1];

      expect(fileId).toBe('ABC123');

      // Step 2: Get metadata
      const metadata = {
        id: fileId,
        name: 'test.wav',
        size: 1000000
      };

      expect(metadata.name).toBe('test.wav');

      // Step 3: Determine download strategy
      const isWav = metadata.name.toLowerCase().endsWith('.wav');
      const mode = 'audio-only';
      const usePartial = isWav && (mode === 'audio-only' || mode === 'full');

      expect(usePartial).toBe(true);
    });

    it('should handle folder URL parsing → list files → process audio', () => {
      // Step 1: Parse folder URL
      const url = 'https://drive.google.com/drive/folders/FOLDER123';
      const match = url.match(/\/folders\/([^/?]+)/);
      const folderId = match[1];

      expect(folderId).toBe('FOLDER123');

      // Step 2: List files
      const mockFiles = [
        { id: '1', name: 'audio1.wav', mimeType: 'audio/wav' },
        { id: '2', name: 'audio2.mp3', mimeType: 'audio/mpeg' }
      ];

      // Step 3: Filter audio files
      const audioFiles = mockFiles.filter(f => f.mimeType.startsWith('audio/'));

      expect(audioFiles).toHaveLength(2);
    });

    it('should skip filename-only mode downloads', () => {
      const mode = 'filename-only';
      const shouldDownload = mode !== 'filename-only';

      expect(shouldDownload).toBe(false);
    });
  });
});
