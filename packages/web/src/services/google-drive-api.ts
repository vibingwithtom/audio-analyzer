/**
 * Google Drive API Service
 *
 * Provides high-level methods for Google Drive file operations:
 * - URL parsing to extract file/folder IDs
 * - File download via Drive API
 * - Google Picker integration for file browsing
 *
 * Phase 5.7 - Google Drive Integration
 */

import type GoogleAuth from '../google-auth.js';
import { GOOGLE_CONFIG } from '../config.js';

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
}

export interface PickerResult {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes?: number;
    url?: string;
    type?: 'file' | 'folder';
  }>;
}

/**
 * Google Drive API Service
 *
 * Wraps GoogleAuth functionality and adds:
 * - URL parsing for various Drive URL formats
 * - Google Picker integration
 */
export class GoogleDriveAPI {
  private googleAuth: GoogleAuth;
  private pickerInited = false;

  constructor(googleAuth: GoogleAuth) {
    this.googleAuth = googleAuth;
  }

  /**
   * Parse a Google Drive URL and extract the file or folder ID
   *
   * Supports multiple URL formats:
   * - https://drive.google.com/file/d/{fileId}/view
   * - https://drive.google.com/open?id={fileId}
   * - https://drive.google.com/uc?id={fileId}
   * - https://drive.google.com/drive/folders/{folderId}
   *
   * @param url - Google Drive URL
   * @returns Object with id and type ('file' or 'folder')
   * @throws Error if URL is invalid or cannot be parsed
   */
  parseUrl(url: string): { id: string; type: 'file' | 'folder' } {
    try {
      const urlObj = new URL(url);

      // Check if it's a Google Drive URL
      if (!urlObj.hostname.includes('drive.google.com')) {
        throw new Error('Not a Google Drive URL');
      }

      // Pattern 1: /file/d/{fileId}/view or /file/d/{fileId}
      const fileMatch = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        return { id: fileMatch[1], type: 'file' };
      }

      // Pattern 2: /drive/folders/{folderId}
      const folderMatch = urlObj.pathname.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch) {
        return { id: folderMatch[1], type: 'folder' };
      }

      // Pattern 3: /open?id={id} or /uc?id={id}
      const idParam = urlObj.searchParams.get('id');
      if (idParam) {
        // Assume it's a file if using id parameter
        return { id: idParam, type: 'file' };
      }

      throw new Error('Could not extract file/folder ID from URL');
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  /**
   * Download a file from Google Drive with smart optimization
   *
   * Automatically uses partial download (100KB) for WAV files in non-experimental modes.
   * Falls back to full download for:
   * - Experimental mode (needs full audio data)
   * - Non-WAV files (MP3, FLAC, etc. - Web Audio API needs complete file)
   *
   * @param fileId - Google Drive file ID
   * @param options - Download options
   * @returns File object with correct name and mime type
   * @throws Error if download fails or user is not authenticated
   */
  async downloadFile(fileId: string, options?: {
    mode?: 'audio-only' | 'full' | 'filename-only' | 'experimental';
    filename?: string;
    signal?: AbortSignal;
  }): Promise<File> {
    const mode = options?.mode || 'audio-only';
    const filename = options?.filename || '';

    // Determine if we can use partial download optimization
    const isWav = filename.toLowerCase().endsWith('.wav');
    const needsFullFile = mode === 'experimental' || !isWav;

    if (needsFullFile) {
      // Full download needed for:
      // - Experimental mode (any format - needs full audio for analysis)
      // - Non-WAV files (MP3, FLAC, etc. - Web Audio API requires complete file)
      return await this.googleAuth.downloadFile(fileId, options?.signal || null);
    } else {
      // Partial download optimization for WAV files in audio-only/full mode
      // WAV headers contain all metadata, only need first ~100KB
      const partialBlob = await this.googleAuth.downloadFileHeaders(fileId, null, options?.signal || null);
      const metadata = await this.getFileMetadata(fileId);
      const file = new File([partialBlob], metadata.name, { type: metadata.mimeType });

      // Store actual file size as custom property (File.size reflects blob size)
      (file as any).actualSize = metadata.size;

      return file;
    }
  }

  /**
   * Download a file from Google Drive using a URL
   *
   * @param url - Google Drive file URL
   * @param options - Download options (mode and filename for optimization)
   * @returns File object
   * @throws Error if URL is invalid, not a file, or download fails
   */
  async downloadFileFromUrl(url: string, options?: {
    mode?: 'audio-only' | 'full' | 'filename-only' | 'experimental';
    filename?: string;
  }): Promise<File> {
    const parsed = this.parseUrl(url);

    if (parsed.type !== 'file') {
      throw new Error('URL is a folder, not a file. Use downloadFolderFiles() instead.');
    }

    return await this.downloadFile(parsed.id, options);
  }

  /**
   * List all files in a Google Drive folder (with optional extension filter)
   *
   * @param folderId - Google Drive folder ID
   * @param extension - Optional file extension filter (e.g., '.txt', '.pdf')
   * @returns Array of file metadata objects
   * @throws Error if listing fails
   */
  async listFilesInFolder(folderId: string, extension?: string): Promise<DriveFileMetadata[]> {
    return await this.googleAuth.listFilesInFolder(folderId, extension);
  }

  /**
   * List audio files in a Google Drive folder
   *
   * @param folderId - Google Drive folder ID
   * @returns Array of file metadata objects
   * @throws Error if listing fails
   */
  async listAudioFilesInFolder(folderId: string): Promise<DriveFileMetadata[]> {
    return await this.googleAuth.listAudioFilesInFolder(folderId);
  }

  /**
   * Recursively get all audio files from a folder
   *
   * @param folderId - Google Drive folder ID
   * @returns Array of audio file metadata
   * @throws Error if listing fails
   */
  async getAllAudioFilesInFolder(folderId: string): Promise<DriveFileMetadata[]> {
    // For now, just get direct children (non-recursive)
    // Recursive can be added in future enhancement
    return await this.listAudioFilesInFolder(folderId);
  }

  /**
   * Get file metadata
   *
   * @param fileId - Google Drive file ID
   * @returns File metadata
   */
  async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    return await this.googleAuth.getFileMetadata({ id: fileId });
  }

  /**
   * Get file metadata from a URL (without downloading the file)
   *
   * @param url - Google Drive file URL
   * @returns File metadata
   * @throws Error if URL is invalid or not a file
   */
  async getFileMetadataFromUrl(url: string): Promise<DriveFileMetadata> {
    const parsed = this.parseUrl(url);

    if (parsed.type !== 'file') {
      throw new Error('URL is a folder, not a file');
    }

    return await this.getFileMetadata(parsed.id);
  }

  /**
   * Initialize Google Picker API
   *
   * Must be called before using showPicker()
   * Automatically loads the Picker API script if needed
   */
  async initPicker(): Promise<void> {
    if (this.pickerInited) return;

    // Load Google Picker API
    return new Promise((resolve, reject) => {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('picker', {
          callback: () => {
            this.pickerInited = true;
            resolve();
          },
          onerror: () => reject(new Error('Failed to load Google Picker API'))
        });
      } else {
        reject(new Error('Google API not loaded. Make sure GoogleAuth is initialized.'));
      }
    });
  }

  /**
   * Show Google Picker to select files/folders
   *
   * @param options - Picker options
   * @returns Picker result with selected files
   * @throws Error if picker fails or user cancels
   */
  async showPicker(options?: {
    selectFolders?: boolean;
    multiSelect?: boolean;
    audioOnly?: boolean;
  }): Promise<PickerResult> {
    if (!this.pickerInited) {
      await this.initPicker();
    }

    const token = await this.googleAuth.getValidToken();

    return new Promise((resolve, reject) => {
      try {
        const picker = new window.google.picker.PickerBuilder();

        // Add file selection view with folders visible for navigation
        const docsView = new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(options?.selectFolders || false);

        // Add MIME type filter for audio files if specified
        if (options?.audioOnly !== false) { // Default to audio-only
          docsView.setMimeTypes([
            'audio/mpeg',
            'audio/wav',
            'audio/x-wav',
            'audio/wave',
            'audio/flac',
            'audio/x-flac',
            'audio/aac',
            'audio/mp4',
            'audio/ogg',
            'audio/x-m4a'
          ].join(','));
        }

        picker.addView(docsView);

        // Enable multi-select if specified
        if (options?.multiSelect) {
          picker.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
        }

        // Build and show picker
        const pickerBuilder = picker.setOAuthToken(token.access_token);

        // Developer key is optional but recommended
        if (GOOGLE_CONFIG.API_KEY) {
          pickerBuilder.setDeveloperKey(GOOGLE_CONFIG.API_KEY);
        }

        pickerBuilder
          .setCallback((data: PickerResult) => {
            if (data.action === window.google.picker.Action.PICKED) {
              // Add type information to docs
              if (data.docs) {
                data.docs = data.docs.map(doc => ({
                  ...doc,
                  type: doc.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file'
                }));
              }
              resolve(data);
            } else if (data.action === window.google.picker.Action.CANCEL) {
              reject(new Error('Picker cancelled by user'));
            }
          })
          .build()
          .setVisible(true);
      } catch (error) {
        reject(new Error(`Failed to show picker: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Show file picker and download selected file(s)
   *
   * @param multiSelect - Allow selecting multiple files
   * @returns Array of downloaded File objects
   */
  async pickAndDownloadFiles(multiSelect: boolean = false): Promise<File[]> {
    const result = await this.showPicker({ multiSelect });

    if (!result.docs || result.docs.length === 0) {
      throw new Error('No files selected');
    }

    // Validate that all selected items are audio files
    const audioMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/flac',
      'audio/x-flac',
      'audio/aac',
      'audio/mp4',
      'audio/ogg',
      'audio/x-m4a'
    ];

    const nonAudioFiles = result.docs.filter(doc => !audioMimeTypes.includes(doc.mimeType));
    if (nonAudioFiles.length > 0) {
      throw new Error(`Please select only audio files. Non-audio file selected: ${nonAudioFiles[0].name}`);
    }

    // Download all selected files
    const downloadPromises = result.docs.map(doc => this.downloadFile(doc.id));
    return await Promise.all(downloadPromises);
  }
}
