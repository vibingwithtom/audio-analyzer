/**
 * File Validation Utilities
 *
 * Helpers for validating file types against preset criteria
 */

import type { AudioCriteria } from '@audio-analyzer/core';

/**
 * Check if a file type is allowed based on criteria
 *
 * @param filename - The filename to check
 * @param criteria - AudioCriteria containing allowed file types (or null for built-in presets)
 * @returns true if file type is allowed, false otherwise
 */
export function isFileTypeAllowed(filename: string, criteria: AudioCriteria | null): boolean {
  // If no criteria provided (built-in presets), allow all files
  if (!criteria || !criteria.fileType || criteria.fileType.length === 0) {
    return true;
  }

  // Get file extension (lowercase, without the dot)
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // Check if extension is in allowed file types
  return criteria.fileType.includes(extension);
}

/**
 * Get allowed file types from criteria for display in error messages
 *
 * @param criteria - AudioCriteria containing allowed file types
 * @returns Formatted string like "WAV, MP3, FLAC" or empty string if no restrictions
 */
export function getFileTypeDisplay(criteria: AudioCriteria | null): string {
  if (!criteria || !criteria.fileType || criteria.fileType.length === 0) {
    return '';
  }

  return criteria.fileType.map(ext => ext.toUpperCase()).join(', ');
}

/**
 * Get file extension from filename
 *
 * @param filename - The filename
 * @returns File extension in uppercase (e.g., "MP3", "WAV") or empty string if no extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');

  // No extension if fewer than 2 parts
  if (parts.length < 2) {
    return '';
  }

  // For hidden files (starting with dot), need at least 3 parts for an extension
  // e.g., .hidden (2 parts, no ext) vs .hidden.txt (3 parts, has ext)
  if (parts[0] === '' && parts.length < 3) {
    return '';
  }

  const extension = parts.pop()?.toLowerCase() || '';
  return extension ? extension.toUpperCase() : '';
}

/**
 * Format file type display for rejected files
 *
 * @param filename - The rejected filename
 * @returns Formatted string like "Unknown (Maybe MP3)"
 */
export function formatRejectedFileType(filename: string): string {
  const extension = getFileExtension(filename);
  return extension ? `Unknown (Maybe ${extension})` : 'Unknown';
}

/**
 * Get reason message for rejected file
 *
 * @param filename - The rejected filename
 * @param criteria - AudioCriteria containing allowed file types
 * @returns Formatted error message for display
 */
export function getFileRejectionReason(filename: string, criteria: AudioCriteria | null): string {
  const fileTypeDisplay = getFileTypeDisplay(criteria);

  if (!fileTypeDisplay) {
    return 'File type not supported';
  }

  return `File type not supported. This preset accepts: ${fileTypeDisplay}`;
}
