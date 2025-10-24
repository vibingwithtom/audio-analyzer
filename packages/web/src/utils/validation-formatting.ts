/**
 * Validation message formatting utilities
 * Provides consistent formatting across all validation and metric displays
 * Uses existing format-utils for standardized formatting (48.0 kHz, Mono/Stereo, 24-bit, etc)
 */

import {
  formatSampleRate,
  formatChannels,
  formatBitDepth,
  formatDuration
} from './format-utils';
import type { ValidationResult } from '../types';

/**
 * Format a validation field issue into a human-readable message
 * Uses consistent formatting for field values
 *
 * @example
 * formatValidationMessage('channels', { target: [1], actual: 2 }, 'fail')
 * → "Channels: Stereo (expected Mono)"
 *
 * @example
 * formatValidationMessage('sampleRate', { target: [48000], actual: 44100 }, 'fail')
 * → "Sample Rate: 44.1 kHz (expected 48.0 kHz)"
 */
export function formatValidationMessage(
  field: string,
  validation: Partial<ValidationResult>,
  severity: 'fail' | 'warning'
): string {
  const { target, actual } = validation;

  // Handle fields with standardized formatting
  switch (field) {
    case 'channels':
      if (target && actual !== undefined) {
        const actualFormatted = formatChannels(actual as number);
        const expectedFormatted = Array.isArray(target)
          ? target.map(t => formatChannels(t as number)).join(' or ')
          : formatChannels(target as any);
        return `Channels: ${actualFormatted} (expected ${expectedFormatted})`;
      }
      break;

    case 'sampleRate':
      if (target && actual !== undefined) {
        const actualFormatted = formatSampleRate(actual as number);
        const expectedFormatted = Array.isArray(target)
          ? target.map(t => formatSampleRate(t as number)).join(' or ')
          : formatSampleRate(target as any);
        return `Sample Rate: ${actualFormatted} (expected ${expectedFormatted})`;
      }
      break;

    case 'bitDepth':
      if (target && actual !== undefined) {
        const actualFormatted = formatBitDepth(actual as any);
        const expectedFormatted = Array.isArray(target)
          ? target.map(t => formatBitDepth(t as any)).join(' or ')
          : formatBitDepth(target as any);
        return `Bit Depth: ${actualFormatted} (expected ${expectedFormatted})`;
      }
      break;

    case 'duration':
      if (actual !== undefined) {
        const actualFormatted = formatDuration(actual as number);
        return `Duration: ${actualFormatted}`;
      }
      break;

    case 'fileType':
      return 'File Type: Invalid';

    case 'filename':
      return 'Filename: Invalid';

    default:
      // Generic fallback for unknown fields
      const fieldNames: { [key: string]: string } = {
        fileType: 'File Type',
        duration: 'Duration',
        filename: 'Filename'
      };
      const displayName = fieldNames[field] || field;
      return `${displayName}: Invalid`;
  }

  // Fallback if target/actual missing
  const fieldNames: { [key: string]: string } = {
    fileType: 'File Type',
    duration: 'Duration',
    filename: 'Filename'
  };
  const displayName = fieldNames[field] || field;
  return `${displayName}: Invalid`;
}

/**
 * Split validation error messages on newlines or case boundaries
 * Handles both newline-separated errors and concatenated errors
 *
 * @example
 * splitValidationErrors("Filename must be all lowercase\nInvalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]")
 * → ["Filename must be all lowercase", "Invalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]"]
 *
 * @example
 * splitValidationErrors("Sample Rate: 44100 Hz (expected 48000 Hz)Channels: 2 (expected 1)")
 * → ["Sample Rate: 44100 Hz (expected 48000 Hz)", "Channels: 2 (expected 1)"]
 */
export function splitValidationErrors(concatenated: string): string[] {
  // First try splitting on actual newlines
  let errors = concatenated.split('\n');

  // If only one result, try splitting on escaped newlines (\\n as literal string)
  if (errors.length === 1) {
    errors = concatenated.split('\\n');
  }

  // If still only one result, try splitting on case boundaries (for fully concatenated errors)
  if (errors.length === 1) {
    errors = concatenated.split(/(?<=[a-z\)])(?=[A-Z])/);
  }

  return errors
    .map(err => err.trim())
    .filter(err => err.length > 0);
}

/**
 * Format time duration in seconds to human-readable format for silence metrics
 *
 * @example formatSilenceTime(90) → "1:30"
 * @example formatSilenceTime(5) → "5s"
 * @example formatSilenceTime(0.5) → "0.5s"
 */
export function formatSilenceTime(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '--';
  if (seconds === 0) return '0s';

  // If > 60 seconds, show as m:ss format
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Otherwise show with decimal precision
  return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

/**
 * Format frequency in dB with appropriate precision
 *
 * @example formatDb(-60) → "-60 dB"
 * @example formatDb(-50.5) → "-50.5 dB"
 * @example formatDb(-Infinity) → "-∞ dB"
 */
export function formatDb(value: number | undefined): string {
  if (value === undefined) return '--';
  if (value === -Infinity) return '-∞ dB';
  return `${value.toFixed(1)} dB`;
}

/**
 * Format percentage value with consistent precision
 *
 * @example formatPercent(0.15) → "0.15%"
 * @example formatPercent(15) → "15.0%"
 */
export function formatPercent(value: number | undefined): string {
  if (value === undefined) return '--';
  // If already a percentage (> 1), use 1 decimal place
  if (value > 1) {
    return `${value.toFixed(1)}%`;
  }
  // If decimal percentage, use 2 decimal places
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format reverb time label with duration
 *
 * @example formatReverbTime('Poor', 0.9) → "Poor (0.90s)"
 * @example formatReverbTime('Excellent', 0.15) → "Excellent (0.15s)"
 */
export function formatReverbTime(label: string, time: number): string {
  return `${label} (${time.toFixed(2)}s)`;
}
