import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatBytes,
  formatSampleRate,
  formatBitDepth,
  formatChannels
} from '../../src/utils/format-utils';

/**
 * Format Utils Tests
 *
 * Tests for actual formatting functions imported from format-utils.ts
 */

describe('Format Utils', () => {
  // ==================== DURATION FORMATTING TESTS ====================

  describe('formatDuration', () => {
    describe('Seconds only (s)', () => {
      it('should format 0 as "--"', () => {
        expect(formatDuration(0)).toBe('--');
      });

      it('should format single digit seconds', () => {
        expect(formatDuration(5)).toBe('5s');
        expect(formatDuration(9)).toBe('9s');
      });

      it('should format seconds 10-59', () => {
        expect(formatDuration(10)).toBe('10s');
        expect(formatDuration(30)).toBe('30s');
        expect(formatDuration(59)).toBe('59s');
      });
    });

    describe('Minutes and seconds (m ss)', () => {
      it('should format exactly 1 minute', () => {
        expect(formatDuration(60)).toBe('1m 00s');
      });

      it('should format 1 minute 5 seconds', () => {
        expect(formatDuration(65)).toBe('1m 05s');
      });

      it('should format multiple minutes', () => {
        expect(formatDuration(125)).toBe('2m 05s'); // 2 min 5 sec
        expect(formatDuration(180)).toBe('3m 00s'); // 3 min exactly
        expect(formatDuration(595)).toBe('9m 55s'); // 9 min 55 sec
      });

      it('should pad seconds with leading zero', () => {
        expect(formatDuration(605)).toBe('10m 05s');
      });
    });

    describe('Hours, minutes, and seconds (h mm ss)', () => {
      it('should format exactly 1 hour', () => {
        expect(formatDuration(3600)).toBe('1h 00m 00s');
      });

      it('should format 1 hour 1 minute 5 seconds', () => {
        expect(formatDuration(3665)).toBe('1h 01m 05s');
      });

      it('should format multiple hours', () => {
        expect(formatDuration(7200)).toBe('2h 00m 00s'); // 2 hours
        expect(formatDuration(7325)).toBe('2h 02m 05s'); // 2 hours, 2 min, 5 sec
      });

      it('should pad hours, minutes, and seconds appropriately', () => {
        expect(formatDuration(36065)).toBe('10h 01m 05s'); // 10 hours, 1 min, 5 sec
      });

      it('should handle long durations', () => {
        expect(formatDuration(359999)).toBe('99h 59m 59s'); // Nearly 100 hours
      });
    });

    describe('Decimal and invalid inputs', () => {
      it('should floor decimal seconds', () => {
        expect(formatDuration(65.5)).toBe('1m 05s');
        expect(formatDuration(65.9)).toBe('1m 05s');
      });

      it('should handle very small decimals', () => {
        expect(formatDuration(5.1)).toBe('5s');
        expect(formatDuration(5.9)).toBe('5s');
      });

      it('should return "Unknown" for string input', () => {
        expect(formatDuration('invalid')).toBe('Unknown');
      });

      it('should return "Unknown" for NaN', () => {
        expect(formatDuration(NaN)).toBe('Unknown');
      });
    });

    describe('Edge cases', () => {
      it('should handle 59m 59s (just under 1 hour)', () => {
        expect(formatDuration(3599)).toBe('59m 59s');
      });

      it('should handle exactly 10 minutes', () => {
        expect(formatDuration(600)).toBe('10m 00s');
      });

      it('should handle very large values', () => {
        expect(formatDuration(360000)).toBe('100h 00m 00s');
      });
    });
  });

  // ==================== FILE SIZE FORMATTING TESTS ====================

  describe('formatBytes', () => {
    describe('Bytes formatting', () => {
      it('should format zero bytes', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
      });

      it('should format 1 byte', () => {
        expect(formatBytes(1)).toBe('1 Bytes');
      });

      it('should format small byte values', () => {
        expect(formatBytes(500)).toBe('500 Bytes');
        expect(formatBytes(1000)).toBe('1000 Bytes');
      });

      it('should format up to 1023 bytes', () => {
        expect(formatBytes(1023)).toBe('1023 Bytes');
      });
    });

    describe('Kilobytes (KB) formatting', () => {
      it('should format exactly 1 KB', () => {
        expect(formatBytes(1024)).toBe('1 KB');
      });

      it('should format 2 KB', () => {
        expect(formatBytes(2048)).toBe('2 KB');
      });

      it('should format 10 KB', () => {
        expect(formatBytes(10240)).toBe('10 KB');
      });

      it('should format partial KB with decimal', () => {
        expect(formatBytes(1536)).toMatch(/1\.[4-5] KB/); // 1.5 KB
      });

      it('should format up to 1023 KB', () => {
        expect(formatBytes(1047552)).toBe('1023 KB'); // exactly 1023 KB
      });
    });

    describe('Megabytes (MB) formatting', () => {
      it('should format exactly 1 MB', () => {
        expect(formatBytes(1048576)).toBe('1 MB'); // 1024 * 1024
      });

      it('should format 2 MB', () => {
        expect(formatBytes(2097152)).toBe('2 MB');
      });

      it('should format 5 MB', () => {
        expect(formatBytes(5242880)).toBe('5 MB');
      });

      it('should format 100 MB', () => {
        expect(formatBytes(104857600)).toBe('100 MB');
      });

      it('should format partial MB', () => {
        expect(formatBytes(1572864)).toMatch(/1\.[4-5] MB/); // 1.5 MB
      });
    });

    describe('Gigabytes (GB) formatting', () => {
      it('should format exactly 1 GB', () => {
        expect(formatBytes(1073741824)).toBe('1 GB'); // 1024 * 1024 * 1024
      });

      it('should format 2 GB', () => {
        expect(formatBytes(2147483648)).toBe('2 GB');
      });

      it('should format large file sizes', () => {
        expect(formatBytes(10737418240)).toBe('10 GB');
      });

      it('should format partial GB', () => {
        expect(formatBytes(1610612736)).toMatch(/1\.[4-5] GB/); // 1.5 GB
      });
    });

    describe('Boundary transitions', () => {
      it('should transition from B to KB at 1024', () => {
        expect(formatBytes(1023)).toBe('1023 Bytes');
        expect(formatBytes(1024)).toBe('1 KB');
      });

      it('should transition from KB to MB at 1024 KB', () => {
        // Just under 1 MB
        const justUnder = 1024 * 1024 - 1;
        // Just at 1 MB
        const justAt = 1024 * 1024;

        expect(formatBytes(justUnder)).toMatch(/\d+ KB/);
        expect(formatBytes(justAt)).toMatch(/1 MB/);
      });

      it('should transition from MB to GB at 1024 MB', () => {
        // Just under 1 GB
        const justUnder = 1024 * 1024 * 1024 - 1;
        // Just at 1 GB
        const justAt = 1024 * 1024 * 1024;

        expect(formatBytes(justUnder)).toMatch(/\d+ MB/);
        expect(formatBytes(justAt)).toMatch(/1 GB/);
      });
    });

    describe('Common audio file sizes', () => {
      it('should format WAV header (20-50 KB)', () => {
        expect(formatBytes(50000)).toMatch(/48\.[0-9]* KB/); // ~48 KB
      });

      it('should format short audio file (1-10 MB)', () => {
        expect(formatBytes(5242880)).toBe('5 MB'); // 5 MB
      });

      it('should format medium audio file (50-500 MB)', () => {
        expect(formatBytes(104857600)).toBe('100 MB'); // 100 MB
      });

      it('should format large audio file (1-5 GB)', () => {
        expect(formatBytes(2147483648)).toBe('2 GB'); // 2 GB
      });
    });
  });

  // ==================== SAMPLE RATE FORMATTING TESTS ====================

  describe('formatSampleRate', () => {
    describe('Hertz (Hz) formatting', () => {
      it('should format sample rates below 1000 Hz as kHz', () => {
        // Note: Sample rates below 1000 are converted to kHz (unusual but valid)
        expect(formatSampleRate(44)).toBe('0.0 kHz');
        expect(formatSampleRate(500)).toBe('0.5 kHz');
        expect(formatSampleRate(999)).toBe('1.0 kHz');
      });
    });

    describe('Kilohertz (kHz) formatting', () => {
      it('should format exactly 1 kHz (1000 Hz)', () => {
        expect(formatSampleRate(1000)).toBe('1.0 kHz');
      });

      it('should format common audio sample rates', () => {
        expect(formatSampleRate(44100)).toBe('44.1 kHz');
        expect(formatSampleRate(48000)).toBe('48.0 kHz');
        expect(formatSampleRate(96000)).toBe('96.0 kHz');
      });

      it('should format higher sample rates', () => {
        expect(formatSampleRate(192000)).toBe('192.0 kHz');
        expect(formatSampleRate(384000)).toBe('384.0 kHz');
      });

      it('should handle non-standard sample rates', () => {
        expect(formatSampleRate(32000)).toBe('32.0 kHz');
        expect(formatSampleRate(11025)).toBe('11.0 kHz');
      });

      it('should preserve decimal precision for kHz', () => {
        // 44.1 kHz is standard audio rate
        expect(formatSampleRate(44100)).toBe('44.1 kHz');
      });
    });

    describe('Common audio standards', () => {
      it('should format CD quality (44.1 kHz)', () => {
        expect(formatSampleRate(44100)).toBe('44.1 kHz');
      });

      it('should format video standard (48 kHz)', () => {
        expect(formatSampleRate(48000)).toBe('48.0 kHz');
      });

      it('should format high-resolution audio (96 kHz)', () => {
        expect(formatSampleRate(96000)).toBe('96.0 kHz');
      });

      it('should format ultra high-resolution (192 kHz)', () => {
        expect(formatSampleRate(192000)).toBe('192.0 kHz');
      });
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('Integration: Multiple formats in sequence', () => {
    it('should format audio file metadata correctly', () => {
      // Example: Audio file metadata
      const duration = 3665; // 1h 01m 05s
      const fileSize = 5242880; // 5 MB
      const sampleRate = 48000; // 48.0 kHz

      const formattedDuration = formatDuration(duration);
      const formattedSize = formatBytes(fileSize);
      const formattedRate = formatSampleRate(sampleRate);

      expect(formattedDuration).toBe('1h 01m 05s');
      expect(formattedSize).toBe('5 MB');
      expect(formattedRate).toBe('48.0 kHz');
    });

    it('should format WAV file information', () => {
      // WAV file: short duration, small size, CD quality
      expect(formatDuration(30)).toBe('30s');
      expect(formatBytes(50000)).toMatch(/48\.[0-9]* KB/);
      expect(formatSampleRate(44100)).toBe('44.1 kHz');
    });

    it('should format high-resolution audio file', () => {
      // High-res: long duration, large size, 192 kHz
      expect(formatDuration(3600)).toBe('1h 00m 00s'); // 1 hour
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatSampleRate(192000)).toBe('192.0 kHz');
    });
  });

  // ==================== ERROR CASES & EDGE CASES ====================

  describe('Edge cases and error handling', () => {
    describe('Invalid inputs', () => {
      it('should handle zero values gracefully', () => {
        expect(formatDuration(0)).toBe('--');
        expect(formatBytes(0)).toBe('0 Bytes');
        expect(formatSampleRate(0)).toBe('--');
      });

      it('should handle very large values', () => {
        expect(formatDuration(86400)).toBe('24h 00m 00s'); // 24 hours
        expect(formatBytes(10737418240)).toBe('10 GB'); // 10 GB
        expect(formatSampleRate(1000000)).toBe('1000.0 kHz'); // 1 MHz (unlikely but valid)
      });
    });

    describe('Consistency', () => {
      it('should format the same value consistently', () => {
        const duration = 125;
        expect(formatDuration(duration)).toBe(formatDuration(duration));

        const size = 1048576;
        expect(formatBytes(size)).toBe(formatBytes(size));

        const rate = 48000;
        expect(formatSampleRate(rate)).toBe(formatSampleRate(rate));
      });
    });
  });
});
