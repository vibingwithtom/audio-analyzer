/**
 * Audio Analyzer Core Package
 * Shared functionality for Chrome extension and desktop application
 */

// Existing exports for backward compatibility
export { AudioAnalyzer } from './audio-analyzer.js';
export { LevelAnalyzer, AnalysisCancelledError } from './level-analyzer.js';
export { CriteriaValidator } from './criteria-validator.js';
export { GoogleDriveHandler } from './google-drive.js';
export { StreamingAudioAnalyzer, BatchProcessor } from './batch-processor.js';

// NEW exports from TypeScript modules (after build)
export * from './dist/index.js';

// Convenience class that combines all functionality
export class AudioAnalyzerEngine {
  constructor() {
    this.audioAnalyzer = new AudioAnalyzer();
    this.levelAnalyzer = new LevelAnalyzer();
    this.googleDrive = new GoogleDriveHandler();
  }

  async analyzeFile(file) {
    return await this.audioAnalyzer.analyzeFile(file);
  }

  async analyzeAdvanced(audioBuffer, progressCallback) {
    return await this.levelAnalyzer.analyzeAudioBuffer(audioBuffer, progressCallback);
  }

  validateCriteria(results, criteria) {
    return CriteriaValidator.validateResults(results, criteria);
  }

  formatResults(results) {
    return CriteriaValidator.formatDisplayText(results);
  }

  formatAdvancedResults(results) {
    return CriteriaValidator.formatAdvancedResults(results);
  }

  cancelAdvancedAnalysis() {
    this.levelAnalyzer.cancelAnalysis();
  }

  // Google Drive functionality
  async downloadGoogleDriveFile(url, accessToken = null) {
    if (accessToken) {
      this.googleDrive.setAccessToken(accessToken);
    }

    // For desktop app without OAuth, try to download directly
    if (!accessToken && typeof window !== 'undefined' && !window.chrome) {
      return await this.downloadGoogleDriveFileDirect(url);
    }

    const result = await this.googleDrive.processUrl(url);
    return result.file;
  }

  // Direct download for publicly shared files (desktop app fallback)
  async downloadGoogleDriveFileDirect(url) {
    const fileId = this.googleDrive.parseGoogleDriveUrl(url);
    if (!fileId) {
      throw new Error('Invalid Google Drive URL');
    }

    // Try direct download URL format for publicly shared files
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Try to get filename from response headers or generate one
      let filename = 'audio-file';
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="?([^"]+)"?/);
        if (matches) {
          filename = matches[1];
        }
      }

      // If no extension, add a default one based on MIME type
      if (!filename.includes('.')) {
        const mimeType = blob.type;
        if (mimeType.includes('wav')) filename += '.wav';
        else if (mimeType.includes('mp3')) filename += '.mp3';
        else if (mimeType.includes('flac')) filename += '.flac';
        else filename += '.audio';
      }

      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      throw new Error(`Failed to download Google Drive file: ${error.message}`);
    }
  }

  // Set Google Drive access token (for Chrome extension)
  setGoogleDriveToken(token) {
    this.googleDrive.setAccessToken(token);
  }
}