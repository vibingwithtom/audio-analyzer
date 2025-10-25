/**
 * Settings Manager Module
 *
 * Centralized management of application settings with localStorage persistence.
 * Handles criteria validation settings, presets, filename validation, and user preferences.
 */

import type { PresetConfigurations } from '@audio-analyzer/core';
import { DEFAULT_PRESETS, type PresetConfig, type AudioCriteria } from '@audio-analyzer/core';
import type {
  AppSettings,
  FilenameValidationSettings,
  BoxFilenameValidationSettings,
  LocalFilenameValidationSettings
} from './types';
import { STORAGE_KEYS } from './types';

/**
 * Settings Manager Class
 *
 * Provides centralized access to all application settings with type safety
 * and automatic localStorage persistence.
 */
export class SettingsManager {
  /**
   * Gets the current criteria settings from localStorage
   */
  static getCriteria(): AudioCriteria | null {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!stored) return null;

    try {
      const settings: AppSettings = JSON.parse(stored);
      return settings.criteria || null;
    } catch (error) {
      console.warn('Failed to load criteria from localStorage:', error);
      return null;
    }
  }

  /**
   * Saves criteria settings to localStorage
   */
  static saveCriteria(criteria: AudioCriteria): void {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    let settings: AppSettings = {};

    if (stored) {
      try {
        settings = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to parse existing settings, creating new:', error);
      }
    }

    settings.criteria = criteria;

    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save criteria to localStorage:', error);
      // Settings will work in-memory only until page reload
    }
  }

  /**
   * Gets the currently selected preset ID from localStorage
   */
  static getSelectedPreset(): string | null {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_PRESET);
  }

  /**
   * Saves the selected preset ID to localStorage
   */
  static saveSelectedPreset(presetId: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_PRESET, presetId);
    } catch (error) {
      console.warn('Failed to save selected preset to localStorage:', error);
    }
  }

  /**
   * Gets all preset configurations
   */
  static getPresetConfigurations(): PresetConfigurations {
    return DEFAULT_PRESETS;
  }

  /**
   * Gets a specific preset configuration by ID
   */
  static getPresetConfig(presetId: string): PresetConfig | null {
    const presets = this.getPresetConfigurations();
    return presets[presetId] || null;
  }

  /**
   * Loads Google Drive filename validation settings from localStorage
   */
  static loadFilenameValidationSettings(): FilenameValidationSettings {
    const saved = localStorage.getItem(STORAGE_KEYS.FILENAME_VALIDATION);

    // Default values
    const defaults: FilenameValidationSettings = {
      enableAudioAnalysis: true,
      enableFilenameValidation: false,
      speakerId: '',
      scriptsFolderUrl: ''
    };

    if (!saved) return defaults;

    try {
      const settings = JSON.parse(saved);
      return {
        enableAudioAnalysis: settings.enableAudioAnalysis !== false,
        enableFilenameValidation: settings.enableFilenameValidation || false,
        speakerId: settings.speakerId || '',
        scriptsFolderUrl: settings.scriptsFolderUrl || ''
      };
    } catch (error) {
      console.error('Error loading filename validation settings:', error);
      return defaults;
    }
  }

  /**
   * Saves Google Drive filename validation settings to localStorage
   */
  static saveFilenameValidationSettings(settings: FilenameValidationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FILENAME_VALIDATION, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save filename validation settings to localStorage:', error);
    }
  }

  /**
   * Loads Box filename validation settings from localStorage
   */
  static loadBoxFilenameValidationSettings(): BoxFilenameValidationSettings {
    const saved = localStorage.getItem(STORAGE_KEYS.BOX_FILENAME_VALIDATION);

    // Default values
    const defaults: BoxFilenameValidationSettings = {
      enableAudioAnalysis: true,
      enableFilenameValidation: false
    };

    if (!saved) return defaults;

    try {
      const settings = JSON.parse(saved);
      return {
        enableAudioAnalysis: settings.enableAudioAnalysis !== false,
        enableFilenameValidation: settings.enableFilenameValidation || false
      };
    } catch (error) {
      console.error('Error loading Box filename validation settings:', error);
      return defaults;
    }
  }

  /**
   * Saves Box filename validation settings to localStorage
   */
  static saveBoxFilenameValidationSettings(settings: BoxFilenameValidationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BOX_FILENAME_VALIDATION, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save Box filename validation settings to localStorage:', error);
    }
  }

  /**
   * Loads Local filename validation settings from localStorage
   */
  static loadLocalFilenameValidationSettings(): LocalFilenameValidationSettings {
    const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_FILENAME_VALIDATION);

    // Default values
    const defaults: LocalFilenameValidationSettings = {
      enableAudioAnalysis: true,
      enableFilenameValidation: false
    };

    if (!saved) return defaults;

    try {
      const settings = JSON.parse(saved);
      return {
        enableAudioAnalysis: settings.enableAudioAnalysis !== false,
        enableFilenameValidation: settings.enableFilenameValidation || false
      };
    } catch (error) {
      console.error('Error loading local filename validation settings:', error);
      return defaults;
    }
  }

  /**
   * Saves Local filename validation settings to localStorage
   */
  static saveLocalFilenameValidationSettings(settings: LocalFilenameValidationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_FILENAME_VALIDATION, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save local filename validation settings to localStorage:', error);
    }
  }

  /**
   * Gets the current dark mode preference from localStorage
   * Returns null if no preference is saved (should use system preference)
   */
  static getDarkModePreference(): boolean | null {
    const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
    if (saved === null) return null;
    return saved === 'true';
  }

  /**
   * Saves dark mode preference to localStorage
   */
  static saveDarkModePreference(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, enabled ? 'true' : 'false');
    } catch (error) {
      console.warn('Failed to save dark mode preference to localStorage:', error);
    }
  }

  /**
   * Checks if Box just authenticated (for post-OAuth redirect handling)
   */
  static wasBoxJustAuthenticated(): boolean {
    return localStorage.getItem(STORAGE_KEYS.BOX_JUST_AUTHENTICATED) === 'true';
  }

  /**
   * Clears the Box authentication flag
   */
  static clearBoxAuthenticationFlag(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.BOX_JUST_AUTHENTICATED);
    } catch (error) {
      console.warn('Failed to clear Box authentication flag from localStorage:', error);
    }
  }

  /**
   * Sets the Box authentication flag (typically done during OAuth callback)
   */
  static setBoxAuthenticationFlag(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BOX_JUST_AUTHENTICATED, 'true');
    } catch (error) {
      console.warn('Failed to set Box authentication flag in localStorage:', error);
    }
  }

  /**
   * Gets the peak detection mode preference from localStorage
   * Returns 'accurate' as default if no preference is saved
   */
  static getPeakDetectionMode(): 'accurate' | 'fast' {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!stored) return 'accurate'; // Default to accurate mode

    try {
      const settings: AppSettings = JSON.parse(stored);
      return settings.peakDetectionMode || 'accurate';
    } catch (error) {
      console.warn('Failed to load peak detection mode from localStorage:', error);
      return 'accurate';
    }
  }

  /**
   * Saves peak detection mode preference to localStorage
   */
  static savePeakDetectionMode(mode: 'accurate' | 'fast'): void {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    let settings: AppSettings = {};

    if (stored) {
      try {
        settings = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to parse existing settings, creating new:', error);
      }
    }

    settings.peakDetectionMode = mode;

    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save peak detection mode to localStorage:', error);
      // Settings will work in-memory only until page reload
    }
  }

  /**
   * Gets the download chunk size for partial file downloads (bytes)
   * Optimized to 10KB (10240 bytes) for header-only analysis
   * Reduces bandwidth by 90% vs original 100KB with no loss of accuracy
   */
  static getDownloadChunkSize(): number {
    return 10240; // 10KB - optimized chunk size for WAV header extraction
  }

  /**
   * Clears all settings from localStorage (useful for testing or reset)
   */
  static clearAllSettings(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Exports all settings as a JSON object (for backup/debugging)
   */
  static exportSettings(): Record<string, any> {
    const settings: Record<string, any> = {};
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        try {
          settings[name] = JSON.parse(value);
        } catch {
          settings[name] = value;
        }
      }
    });
    return settings;
  }

  /**
   * Imports settings from a JSON object (for restore/testing)
   */
  static importSettings(settings: Record<string, any>): void {
    Object.entries(settings).forEach(([name, value]) => {
      const key = STORAGE_KEYS[name as keyof typeof STORAGE_KEYS];
      if (key) {
        try {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(key, stringValue);
        } catch (error) {
          console.warn(`Failed to import setting '${name}' to localStorage:`, error);
        }
      }
    });
  }
}
