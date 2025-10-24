/**
 * Box API Service
 *
 * Provides high-level methods for Box file operations:
 * - URL parsing to extract file/folder IDs
 * - File download via Box API
 *
 * Phase 5.8 - Box Tab Migration
 */

import type BoxAuth from '../box-auth.js';

export interface BoxFileMetadata {
  id: string;
  name: string;
  type: string;
  size?: number;
  modified_at?: string;
}

/**
 * Box API Service
 *
 * Wraps BoxAuth functionality and adds:
 * - URL parsing for various Box URL formats
 */
export class BoxAPI {
  private boxAuth: BoxAuth;

  constructor(boxAuth: BoxAuth) {
    this.boxAuth = boxAuth;
  }

  /**
   * Parse a Box shared link URL and extract the file or folder ID
   *
   * Supports Box shared link formats:
   * - https://app.box.com/s/{sharedLinkId}
   * - https://app.box.com/file/{fileId}
   * - https://app.box.com/folder/{folderId}
   *
   * @param url - Box shared link URL
   * @returns Object with id, type ('file' or 'folder'), and optional sharedLink
   * @throws Error if URL is invalid or cannot be parsed
   */
  parseUrl(url: string): { id: string; type: 'file' | 'folder'; sharedLink?: string } {
    try {
      const urlObj = new URL(url);

      // Check if it's a Box URL
      if (!urlObj.hostname.includes('box.com')) {
        throw new Error('Not a Box URL');
      }

      // Pattern 1: /s/{sharedLinkId} - Box shared links
      // These need special handling as they don't directly give us file/folder IDs
      const sharedMatch = urlObj.pathname.match(/\/s\/([a-zA-Z0-9]+)/);
      if (sharedMatch) {
        // For shared links, we return the full URL as the "id"
        // The BoxAuth methods will handle this specially
        return {
          id: 'shared',
          type: 'file', // Will need to be determined by API call
          sharedLink: url
        };
      }

      // Pattern 2: /file/{fileId}
      const fileMatch = urlObj.pathname.match(/\/file\/(\d+)/);
      if (fileMatch) {
        return { id: fileMatch[1], type: 'file' };
      }

      // Pattern 3: /folder/{folderId}
      const folderMatch = urlObj.pathname.match(/\/folder\/(\d+)/);
      if (folderMatch) {
        return { id: folderMatch[1], type: 'folder' };
      }

      throw new Error('Could not extract file/folder ID from Box URL');
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  /**
   * Download a file from Box with smart optimization
   *
   * Automatically uses partial download (100KB) for WAV files in non-experimental modes.
   * Falls back to full download for:
   * - Experimental mode (needs full audio data)
   * - Non-WAV files (MP3, FLAC, etc. - Web Audio API needs complete file)
   *
   * @param fileId - Box file ID
   * @param sharedLink - Optional Box shared link URL
   * @param options - Download options
   * @returns File object with correct name and mime type
   * @throws Error if download fails or user is not authenticated
   */
  async downloadFile(fileId: string, sharedLink?: string, options?: {
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
      return await this.boxAuth.downloadFile(fileId, (sharedLink || null) as any, (options?.signal ?? null) as any);
    } else {
      // Partial download optimization for WAV files in audio-only/full mode
      // WAV headers contain all metadata, optimized to 10KB chunk size
      const partialBlob = await this.boxAuth.downloadFileHeaders(fileId, undefined, (sharedLink || null) as any, (options?.signal ?? null) as any);
      const metadata = await this.getFileMetadata(fileId, sharedLink);
      const file = new File([partialBlob], metadata.name, { type: 'audio/wav' });

      // Store actual file size as custom property (File.size reflects blob size)
      (file as any).actualSize = metadata.size;

      return file;
    }
  }

  /**
   * Download a file from Box using a URL
   *
   * @param url - Box file URL or shared link
   * @param options - Download options (mode and filename for optimization)
   * @returns File object
   * @throws Error if URL is invalid, not a file, or download fails
   */
  async downloadFileFromUrl(url: string, options?: {
    mode?: 'audio-only' | 'full' | 'filename-only' | 'experimental';
    filename?: string;
  }): Promise<File> {
    const parsed = this.parseUrl(url);

    if (parsed.type === 'folder') {
      throw new Error('URL is a folder, not a file. Folder processing is not yet implemented.');
    }

    // For shared links, we need to make an API call to get the actual file ID
    if (parsed.sharedLink) {
      // Extract the shared link token
      const sharedToken = url.match(/\/s\/([a-zA-Z0-9]+)/)?.[1];
      if (!sharedToken) {
        throw new Error('Invalid Box shared link');
      }

      // For now, use the proxy to get file info from shared link
      // The downloadFile method will handle the optimization
      return await this.downloadFile('0', url, options); // Pass full URL as sharedLink param
    }

    return await this.downloadFile(parsed.id, undefined, options);
  }

  /**
   * List audio files in a Box folder
   *
   * @param folderId - Box folder ID
   * @param sharedLink - Optional Box shared link URL
   * @returns Array of file metadata objects
   * @throws Error if listing fails
   */
  async listAudioFilesInFolder(folderId: string, sharedLink?: string): Promise<BoxFileMetadata[]> {
    return await this.boxAuth.listAudioFilesInFolder(folderId, (sharedLink || null) as any);
  }

  /**
   * Get file metadata
   *
   * @param fileId - Box file ID
   * @param sharedLink - Optional Box shared link URL
   * @returns File metadata
   */
  async getFileMetadata(fileId: string, sharedLink?: string): Promise<BoxFileMetadata> {
    const boxFile = { id: fileId, name: '', type: 'file' };
    return await this.boxAuth.getFileMetadata(boxFile, (sharedLink || null) as any);
  }

  /**
   * Get file metadata from a URL (without downloading the file)
   *
   * @param url - Box file URL or shared link
   * @returns File metadata
   * @throws Error if URL is invalid or not a file
   */
  async getFileMetadataFromUrl(url: string): Promise<BoxFileMetadata> {
    const parsed = this.parseUrl(url);

    if (parsed.type === 'folder') {
      throw new Error('URL is a folder, not a file');
    }

    if (parsed.sharedLink) {
      // For shared links, pass the full URL
      return await this.getFileMetadata('0', url);
    }

    return await this.getFileMetadata(parsed.id);
  }

  /**
   * Get folder metadata
   *
   * @param folderId - Box folder ID
   * @param sharedLink - Optional Box shared link URL
   * @returns Folder metadata
   */
  async getFolderMetadata(folderId: string, sharedLink?: string): Promise<BoxFileMetadata> {
    return await this.boxAuth.getFolderMetadata(folderId, (sharedLink || null) as any);
  }

  /**
   * Parse a Box folder URL and extract the folder ID
   *
   * @param url - Box folder URL
   * @returns The folder ID
   * @throws Error if URL is not a valid folder URL
   */
  parseFolderUrl(url: string): string {
    const match = url.match(/\/folder\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    throw new Error('Invalid or unsupported Box folder URL');
  }

  /**
   * Check if a filename has a common audio extension
   *
   * @param filename - The name of the file
   * @returns True if the file is an audio file
   */
  isAudioFile(filename: string): boolean {
    const audioExtensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff'];
    return audioExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }
}
