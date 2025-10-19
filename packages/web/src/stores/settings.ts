import { writable, derived, type Readable, get } from 'svelte/store';
import { SettingsManager } from '../settings/settings-manager';
import type { AudioCriteria, PresetConfig } from '../settings/types';
import { STORAGE_KEYS } from '../settings/types';
import { isSimplifiedMode, lockedPresetId } from './simplifiedMode';
import { analyticsService } from '../services/analytics-service';

/**
 * Settings Store
 *
 * Provides reactive access to application settings including
 * selected preset and criteria configuration.
 */

// Current criteria (must be defined before selectedPresetId subscription)
const criteria = writable<AudioCriteria | null>(
  SettingsManager.getCriteria()
);

// Selected preset ID
// Default to first preset in alphabetical order (auditions-character-recordings)
const selectedPresetId = writable<string>(
  SettingsManager.getSelectedPreset() || 'auditions-character-recordings'
);

// Subscribe to changes and persist to localStorage
selectedPresetId.subscribe((presetId) => {
  if (presetId) {
    SettingsManager.saveSelectedPreset(presetId);
    analyticsService.track('preset_changed', { presetId });

    // When preset changes, load its criteria
    if (presetId !== 'custom') {
      const presetConfig = SettingsManager.getPresetConfig(presetId);
      if (presetConfig) {
        const newCriteria: AudioCriteria = {
          fileType: presetConfig.fileType || [],
          sampleRate: presetConfig.sampleRate || [],
          bitDepth: presetConfig.bitDepth || [],
          channels: presetConfig.channels || [],
          minDuration: presetConfig.minDuration || ''
        };
        SettingsManager.saveCriteria(newCriteria);
        // IMPORTANT: Update the reactive store so components get the new criteria
        criteria.set(newCriteria);
      }
    }
  }
});

// Get all available presets
export const availablePresets = SettingsManager.getPresetConfigurations();

// Get selected preset configuration
export const selectedPreset: Readable<PresetConfig | null> = derived(
  selectedPresetId,
  ($presetId) => {
    if (!$presetId) return null;
    return SettingsManager.getPresetConfig($presetId);
  }
);

// Export writable for setting preset
export function setPreset(presetId: string): void {
  // Prevent preset changes in simplified mode (unless it's the initial lock)
  const isSimple = get(isSimplifiedMode);
  const lockedPreset = get(lockedPresetId);

  if (isSimple && lockedPreset && presetId !== lockedPreset) {
    console.warn('[Settings] Preset change blocked - simplified mode is active with locked preset:', lockedPreset);
    return;
  }

  selectedPresetId.set(presetId);
}

// Export readable for current preset ID
export const currentPresetId: Readable<string> = {
  subscribe: selectedPresetId.subscribe
};

// Export readable for current criteria
export const currentCriteria: Readable<AudioCriteria | null> = {
  subscribe: criteria.subscribe
};

// Update custom criteria
export function updateCustomCriteria(newCriteria: AudioCriteria): void {
  criteria.set(newCriteria);
  SettingsManager.saveCriteria(newCriteria);
}

// Include Failure Analysis in Enhanced Exports Setting
// Default: true (failure analysis included by default)
const includeFailureAnalysisValue = writable<boolean>(true);

// Load from localStorage on initialization
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem(STORAGE_KEYS.INCLUDE_FAILURE_ANALYSIS);
  if (saved !== null) {
    try {
      includeFailureAnalysisValue.set(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to parse include failure analysis setting', e);
    }
  }
}

// Persist to localStorage whenever setting changes and track in analytics
includeFailureAnalysisValue.subscribe((value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.INCLUDE_FAILURE_ANALYSIS, JSON.stringify(value));
    analyticsService.track('include_failure_analysis_toggled', {
      enabled: value
    });
  }
});

export const enableIncludeFailureAnalysis: Readable<boolean> = {
  subscribe: includeFailureAnalysisValue.subscribe
};

// Export function to update the setting
export function setIncludeFailureAnalysis(enabled: boolean): void {
  includeFailureAnalysisValue.set(enabled);
}

// Include Recommendations in Enhanced Exports Setting
// Default: true (recommendations included by default)
const includeRecommendationsValue = writable<boolean>(true);

// Load from localStorage on initialization
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem(STORAGE_KEYS.INCLUDE_RECOMMENDATIONS);
  if (saved !== null) {
    try {
      includeRecommendationsValue.set(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to parse include recommendations setting', e);
    }
  }
}

// Persist to localStorage whenever setting changes and track in analytics
includeRecommendationsValue.subscribe((value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.INCLUDE_RECOMMENDATIONS, JSON.stringify(value));
    analyticsService.track('include_recommendations_toggled', {
      enabled: value
    });
  }
});

export const enableIncludeRecommendations: Readable<boolean> = {
  subscribe: includeRecommendationsValue.subscribe
};

// Export function to update the setting
export function setIncludeRecommendations(enabled: boolean): void {
  includeRecommendationsValue.set(enabled);
}

// Peak Detection Mode Setting
// Default: 'accurate' (prioritizes precision over speed)
// Load saved value first, then initialize writable with it
const initialPeakMode = typeof window !== 'undefined'
  ? SettingsManager.getPeakDetectionMode()
  : 'accurate';

const peakDetectionModeValue = writable<'accurate' | 'fast'>(initialPeakMode);

// Subscribe to changes and save to localStorage
peakDetectionModeValue.subscribe((mode) => {
  if (typeof window !== 'undefined') {
    SettingsManager.savePeakDetectionMode(mode);
  }
});

// Export as readable store
export const peakDetectionMode: Readable<'accurate' | 'fast'> = {
  subscribe: peakDetectionModeValue.subscribe
};

// Export function to update the setting
export function setPeakDetectionMode(mode: 'accurate' | 'fast'): void {
  peakDetectionModeValue.set(mode);
}

// Check if current configuration is valid (has a properly configured preset)
export const hasValidPresetConfig: Readable<boolean> = derived(
  [selectedPresetId, criteria],
  ([$presetId, $criteria]): boolean => {
    // If no preset selected, invalid
    if (!$presetId) return false;

    // If it's a built-in preset, it's always valid
    if ($presetId !== 'custom') return true;

    // For custom preset, check if any criteria is configured
    if (!$criteria) return false;

    const hasAnyCriteria =
      ($criteria.fileType && $criteria.fileType.length > 0) ||
      ($criteria.sampleRate && $criteria.sampleRate.length > 0) ||
      ($criteria.bitDepth && $criteria.bitDepth.length > 0) ||
      ($criteria.channels && $criteria.channels.length > 0) ||
      ($criteria.minDuration && $criteria.minDuration.length > 0);

    return Boolean(hasAnyCriteria);
  }
);
