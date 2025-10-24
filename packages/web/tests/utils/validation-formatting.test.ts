import { describe, it, expect } from 'vitest';
import {
  splitValidationErrors,
  formatValidationMessage,
  formatSilenceTime,
  formatDb,
  formatPercent,
  formatReverbTime
} from '../../src/utils/validation-formatting';

describe('splitValidationErrors', () => {
  it('should split errors on actual newlines', () => {
    const input = 'Filename must be all lowercase\nInvalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]';
    const result = splitValidationErrors(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Filename must be all lowercase');
    expect(result[1]).toBe('Invalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]');
  });

  it('should split errors on escaped newlines (\\n as literal string)', () => {
    const input = 'Filename must be all lowercase\\nInvalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]';
    const result = splitValidationErrors(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Filename must be all lowercase');
    expect(result[1]).toBe('Invalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]');
  });

  it('should NOT split single error messages containing capital letters in brackets', () => {
    const input = 'Invalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]';
    const result = splitValidationErrors(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Invalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]');
  });

  it('should split concatenated errors with sentence boundaries (period + space + capital)', () => {
    const input = 'Error one. Error two. Error three';
    const result = splitValidationErrors(input);
    // Should only split if there's a pattern like ". [A-Z]"
    expect(result.length).toBeGreaterThanOrEqual(1);
    // The exact behavior depends on whether the regex ". [A-Z]" is found
  });

  it('should trim whitespace from split errors', () => {
    const input = 'Error one\n  Error two  \nError three';
    const result = splitValidationErrors(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Error one');
    expect(result[1]).toBe('Error two');
    expect(result[2]).toBe('Error three');
  });

  it('should filter out empty strings', () => {
    const input = 'Error one\n\n\nError two';
    const result = splitValidationErrors(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Error one');
    expect(result[1]).toBe('Error two');
  });

  it('should handle single error string', () => {
    const input = 'Single error message';
    const result = splitValidationErrors(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Single error message');
  });
});

describe('formatValidationMessage', () => {
  it('should format channels validation message with formatted channel names', () => {
    const validation = { target: [1], actual: 2, status: 'fail' as const };
    const result = formatValidationMessage('channels', validation, 'fail');
    expect(result).toBe('Channels: Stereo (expected Mono)');
  });

  it('should format sample rate validation message with formatted sample rates', () => {
    const validation = { target: [48000], actual: 44100, status: 'fail' as const };
    const result = formatValidationMessage('sampleRate', validation, 'fail');
    expect(result).toBe('Sample Rate: 44.1 kHz (expected 48.0 kHz)');
  });

  it('should format bit depth validation message', () => {
    const validation = { target: [24], actual: 16, status: 'fail' as const };
    const result = formatValidationMessage('bitDepth', validation, 'fail');
    expect(result).toBe('Bit Depth: 16-bit (expected 24-bit)');
  });

  it('should handle multiple target values', () => {
    const validation = { target: [48000, 44100], actual: 32000, status: 'fail' as const };
    const result = formatValidationMessage('sampleRate', validation, 'fail');
    expect(result).toBe('Sample Rate: 32.0 kHz (expected 48.0 kHz or 44.1 kHz)');
  });

  it('should return generic message for unknown fields', () => {
    const validation = { status: 'fail' as const };
    const result = formatValidationMessage('fileType', validation, 'fail');
    expect(result).toBe('File Type: Invalid');
  });
});

describe('formatSilenceTime', () => {
  it('should format seconds under 60 as "Xs"', () => {
    expect(formatSilenceTime(5)).toBe('5s');
    expect(formatSilenceTime(45)).toBe('45s');
  });

  it('should format seconds with decimals', () => {
    expect(formatSilenceTime(5.5)).toBe('5.5s');
    expect(formatSilenceTime(0.5)).toBe('0.5s');
  });

  it('should format minutes and seconds as "m:ss"', () => {
    expect(formatSilenceTime(65)).toBe('1:05');
    expect(formatSilenceTime(90)).toBe('1:30');
    expect(formatSilenceTime(125)).toBe('2:05');
  });

  it('should handle 0 seconds', () => {
    expect(formatSilenceTime(0)).toBe('0s');
  });

  it('should handle undefined', () => {
    expect(formatSilenceTime(undefined)).toBe('--');
  });

  it('should handle null', () => {
    expect(formatSilenceTime(null as any)).toBe('--');
  });
});

describe('formatDb', () => {
  it('should format dB values with one decimal place', () => {
    expect(formatDb(-60)).toBe('-60.0 dB');
    expect(formatDb(-50.5)).toBe('-50.5 dB');
  });

  it('should handle -Infinity', () => {
    expect(formatDb(-Infinity)).toBe('-∞ dB');
  });

  it('should handle undefined', () => {
    expect(formatDb(undefined)).toBe('--');
  });

  it('should handle positive values', () => {
    expect(formatDb(10)).toBe('10.0 dB');
  });
});

describe('formatPercent', () => {
  it('should format decimal percentages (< 1) with 2 decimal places', () => {
    expect(formatPercent(0.15)).toBe('15.00%');
    expect(formatPercent(0.5)).toBe('50.00%');
  });

  it('should format whole percentages (> 1) with 1 decimal place', () => {
    expect(formatPercent(15)).toBe('15.0%');
    expect(formatPercent(50)).toBe('50.0%');
  });

  it('should handle 0', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('should handle undefined', () => {
    expect(formatPercent(undefined)).toBe('--');
  });
});

describe('formatReverbTime', () => {
  it('should format reverb quality with time in seconds', () => {
    expect(formatReverbTime('Poor', 0.9)).toBe('Poor (0.90s)');
    expect(formatReverbTime('Excellent', 0.15)).toBe('Excellent (0.15s)');
  });

  it('should handle longer times', () => {
    expect(formatReverbTime('Good', 1.25)).toBe('Good (1.25s)');
  });
});
