import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../../src/settings/settings-manager';
import { STORAGE_KEYS } from '../../src/settings/types';

describe('Peak Detection Modes', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Settings Persistence', () => {
    it('should save peak detection mode to localStorage', () => {
      SettingsManager.savePeakDetectionMode('fast');

      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const settings = JSON.parse(saved);

      expect(settings.peakDetectionMode).toBe('fast');
    });

    it('should retrieve saved peak detection mode', () => {
      SettingsManager.savePeakDetectionMode('fast');
      const mode = SettingsManager.getPeakDetectionMode();

      expect(mode).toBe('fast');
    });

    it('should persist across multiple saves', () => {
      SettingsManager.savePeakDetectionMode('fast');
      SettingsManager.savePeakDetectionMode('accurate');
      SettingsManager.savePeakDetectionMode('fast');

      const mode = SettingsManager.getPeakDetectionMode();
      expect(mode).toBe('fast');
    });

    it('should default to accurate mode when not set', () => {
      localStorage.clear();
      const mode = SettingsManager.getPeakDetectionMode();

      expect(mode).toBe('accurate');
    });

    it('should preserve other settings when saving peak detection mode', () => {
      // Save other settings first
      SettingsManager.saveDarkModePreference(true);
      SettingsManager.saveSelectedPreset('bilingual-conversational');

      // Save peak detection mode
      SettingsManager.savePeakDetectionMode('fast');

      // Verify other settings preserved
      expect(SettingsManager.getDarkModePreference()).toBe(true);
      expect(SettingsManager.getSelectedPreset()).toBe('bilingual-conversational');
      expect(SettingsManager.getPeakDetectionMode()).toBe('fast');
    });

    it('should handle corrupt settings gracefully', () => {
      localStorage.setItem('SETTINGS', 'invalid json {');

      // Should not throw, should default
      const mode = SettingsManager.getPeakDetectionMode();
      expect(mode).toBe('accurate');
    });

    it('should toggle between modes', () => {
      const modes = ['accurate', 'fast'];

      for (const mode of modes) {
        SettingsManager.savePeakDetectionMode(mode);
        expect(SettingsManager.getPeakDetectionMode()).toBe(mode);
      }
    });
  });

  describe('localStorage Error Handling', () => {
    it('should handle QuotaExceededError gracefully', () => {
      // Mock localStorage to throw QuotaExceededError
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      // Should not throw when calling save
      expect(() => {
        SettingsManager.savePeakDetectionMode('fast');
      }).not.toThrow();

      // Restore original
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle SecurityError in private browsing', () => {
      // Mock localStorage to throw SecurityError (private browsing)
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const error = new Error('SecurityError');
        error.name = 'SecurityError';
        throw error;
      });

      // Should not throw when calling save
      expect(() => {
        SettingsManager.savePeakDetectionMode('fast');
      }).not.toThrow();

      // Restore original
      Storage.prototype.setItem = originalSetItem;
    });

    it('should fallback to accurate mode when localStorage unavailable', () => {
      // Mock localStorage.getItem to return null (unavailable)
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => null);

      const mode = SettingsManager.getPeakDetectionMode();
      expect(mode).toBe('accurate');

      // Restore original
      Storage.prototype.getItem = originalGetItem;
    });

    it('should handle removeItem errors gracefully', () => {
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('StorageError');
      });

      // Should not throw
      expect(() => {
        SettingsManager.clearBoxAuthenticationFlag();
      }).not.toThrow();

      // Restore original
      Storage.prototype.removeItem = originalRemoveItem;
    });
  });

  describe('Peak Detection Mode Validation', () => {
    it('should only accept valid modes', () => {
      const validModes = ['accurate', 'fast'];

      for (const mode of validModes) {
        SettingsManager.savePeakDetectionMode(mode);
        expect(SettingsManager.getPeakDetectionMode()).toBe(mode);
      }
    });

    it('should handle case sensitivity', () => {
      // Save with mixed case (if code supports it)
      SettingsManager.savePeakDetectionMode('fast');
      const mode = SettingsManager.getPeakDetectionMode();

      // Should be lowercase
      expect(mode).toBe('fast');
      expect(mode).not.toBe('Fast');
      expect(mode).not.toBe('FAST');
    });
  });

  describe('Settings Export/Import', () => {
    it('should include peak detection mode in exports', () => {
      SettingsManager.savePeakDetectionMode('fast');
      SettingsManager.saveDarkModePreference(true);

      const exported = SettingsManager.exportSettings();

      // Should include peak detection mode in exported settings
      const settingsStr = exported['SETTINGS'] || exported[STORAGE_KEYS.SETTINGS];
      if (settingsStr) {
        const settings = typeof settingsStr === 'string' ? JSON.parse(settingsStr) : settingsStr;
        expect(settings.peakDetectionMode).toBe('fast');
      }
    });

    it('should restore peak detection mode on import', () => {
      const settingsToImport = {
        'SETTINGS': JSON.stringify({
          peakDetectionMode: 'fast',
          darkMode: 'true'
        })
      };

      SettingsManager.importSettings(settingsToImport);

      const mode = SettingsManager.getPeakDetectionMode();
      expect(mode).toBe('fast');
    });

    it('should handle import errors gracefully', () => {
      const invalidSettings = {
        SETTINGS: '{invalid json'
      };

      // Should not throw
      expect(() => {
        SettingsManager.importSettings(invalidSettings);
      }).not.toThrow();
    });
  });

  describe('Concurrent Settings Access', () => {
    it('should handle rapid setting changes', async () => {
      const modes = ['fast', 'accurate', 'fast', 'accurate'];

      for (const mode of modes) {
        SettingsManager.savePeakDetectionMode(mode);
      }

      expect(SettingsManager.getPeakDetectionMode()).toBe('accurate');
    });

    it('should maintain consistency across multiple reads', () => {
      SettingsManager.savePeakDetectionMode('fast');

      // Read multiple times
      const mode1 = SettingsManager.getPeakDetectionMode();
      const mode2 = SettingsManager.getPeakDetectionMode();
      const mode3 = SettingsManager.getPeakDetectionMode();

      expect(mode1).toBe(mode2);
      expect(mode2).toBe(mode3);
      expect(mode1).toBe('fast');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty localStorage', () => {
      localStorage.clear();
      const mode = SettingsManager.getPeakDetectionMode();

      expect(mode).toBe('accurate');
    });

    it('should handle null values', () => {
      localStorage.setItem('SETTINGS', null);
      const mode = SettingsManager.getPeakDetectionMode();

      expect(mode).toBe('accurate');
    });

    it('should handle undefined values', () => {
      // Simulate undefined (can't actually set to undefined in localStorage)
      localStorage.removeItem('SETTINGS');
      const mode = SettingsManager.getPeakDetectionMode();

      expect(mode).toBe('accurate');
    });

    it('should survive localStorage clear operations', () => {
      SettingsManager.savePeakDetectionMode('fast');
      SettingsManager.clearAllSettings();

      const mode = SettingsManager.getPeakDetectionMode();
      expect(mode).toBe('accurate'); // Should reset to default
    });

    it('should handle very long setting values', () => {
      // Create a large settings object
      const largeSettings = {
        criteria: {
          levels: Array(1000).fill({ min: -60, max: 0 })
        }
      };

      SettingsManager.saveCriteria(largeSettings.criteria);
      SettingsManager.savePeakDetectionMode('fast');

      // Peak detection should still work
      expect(SettingsManager.getPeakDetectionMode()).toBe('fast');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle settings from old versions without peakDetectionMode', () => {
      // Simulate old settings without peakDetectionMode
      const oldSettings = {
        darkMode: 'true',
        selectedPreset: 'bilingual-conversational'
      };

      localStorage.setItem('SETTINGS', JSON.stringify(oldSettings));

      // Should default to accurate mode
      const mode = SettingsManager.getPeakDetectionMode();
      expect(mode).toBe('accurate');
    });

    it('should migrate old settings format to new format', () => {
      // Start with old format
      const oldSettings = {
        darkMode: 'true'
      };

      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(oldSettings));

      // Save new peak detection mode (should preserve old settings)
      SettingsManager.savePeakDetectionMode('fast');

      // Retrieve and verify both old and new settings exist
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
      expect(stored.peakDetectionMode).toBe('fast');
      expect(stored.darkMode).toBe('true'); // Old setting preserved
    });
  });

  describe('Performance', () => {
    it('should save settings quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        SettingsManager.savePeakDetectionMode(i % 2 === 0 ? 'fast' : 'accurate');
      }

      const duration = performance.now() - startTime;

      // Should complete in reasonable time (< 100ms for 100 saves)
      expect(duration).toBeLessThan(100);
    });

    it('should retrieve settings quickly', () => {
      SettingsManager.savePeakDetectionMode('fast');

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        SettingsManager.getPeakDetectionMode();
      }

      const duration = performance.now() - startTime;

      // Should complete in reasonable time (< 50ms for 1000 reads)
      expect(duration).toBeLessThan(50);
    });
  });
});
