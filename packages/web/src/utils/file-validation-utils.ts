/**
 * File Validation Utilities
 *
 * Helpers for validating file types against preset criteria
 */

import type { AudioCriteria } from '../settings/types';

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
