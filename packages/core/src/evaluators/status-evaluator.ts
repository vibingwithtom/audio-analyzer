/**
 * Shared status computation utilities for audio analysis results
 * Used by both ResultsDisplay and ResultsTable components
 */

// Note: These types are imported from the web package types
// For now, we use 'any' to avoid circular dependencies
// TODO: Consider extracting these types to a shared location

/**
 * Classify normalization status into a validation result
 */
export function getNormalizationStatus(status: any | undefined): 'success' | 'warning' | '' {
  if (!status) return '';
  if (status.status === 'normalized') return 'success';
  return 'warning';
}

/**
 * Classify reverb quality into a validation result
 */
export function getReverbStatus(label: string | undefined): 'success' | 'warning' | 'error' | '' {
  if (!label) return '';
  if (label.includes('Very Poor')) return 'error';
  if (label.includes('Excellent') || label.includes('Good') || label.includes('Fair')) return 'success';
  if (label.includes('Poor')) return 'warning';
  return 'error';
}

/**
 * Classify noise floor dB level into a validation result
 */
export function getNoiseFloorStatus(noiseFloorDb: number | undefined): 'success' | 'warning' | 'error' | '' {
  if (noiseFloorDb === undefined || noiseFloorDb === -Infinity) return '';
  // Excellent/Good: <= -60 dB
  if (noiseFloorDb <= -60) return 'success';
  // Fair: -60 to -50 dB
  if (noiseFloorDb <= -50) return 'warning';
  // Poor: > -50 dB
  return 'error';
}

/**
 * Classify silence duration into a validation result
 */
export function getSilenceStatus(
  seconds: number | undefined,
  type: 'lead-trail' | 'max'
): 'success' | 'warning' | 'error' | '' {
  if (seconds === undefined || seconds === null) return '';

  if (type === 'lead-trail') {
    // Leading/Trailing silence thresholds
    if (seconds < 5) return 'success'; // Good: < 5s
    if (seconds < 10) return 'warning'; // Warning: 5-9s
    return 'error'; // Issue: >= 10s
  } else {
    // Max silence gap thresholds
    if (seconds < 5) return 'success'; // Good: < 5s
    if (seconds < 10) return 'warning'; // Warning: 5-9s
    return 'error'; // Issue: >= 10s
  }
}

/**
 * Classify clipping analysis into a validation result
 */
export function getClippingStatus(clippingAnalysis: any | undefined): 'success' | 'warning' | 'error' | '' {
  if (!clippingAnalysis) return '';

  const { clippedPercentage, clippingEventCount, nearClippingPercentage } = clippingAnalysis;

  // Hard clipping > 1% OR > 50 events → error
  if (clippedPercentage > 1 || clippingEventCount > 50) return 'error';
  // Hard clipping 0.1-1% OR 10-50 events → warning
  if (clippedPercentage > 0.1 || clippingEventCount > 10) return 'warning';
  // Any hard clipping → warning
  if (clippedPercentage > 0 && clippingEventCount > 0) return 'warning';
  // Near clipping > 1% → warning
  if (nearClippingPercentage > 1) return 'warning';
  // All clear
  return 'success';
}

/**
 * Classify mic bleed detection (using unified OR logic)
 */
export function getMicBleedStatus(micBleed: any | undefined): 'success' | 'warning' | '' {
  if (!micBleed) return '';

  // Check OLD method: > -60 dB means detected
  const oldDetected = micBleed.old &&
    (micBleed.old.leftChannelBleedDb > -60 || micBleed.old.rightChannelBleedDb > -60);

  // Check NEW method: > 0.5% confirmed bleed means detected
  const newDetected = micBleed.new &&
    (micBleed.new.percentageConfirmedBleed > 0.5);

  // OR logic: if either detects, show warning
  if (oldDetected || newDetected) return 'warning';
  return 'success';
}

/**
 * Compute experimental status from audio result
 * This is the unified status computation used by both ResultsDisplay and ResultsTable
 *
 * Returns 'fail' if:
 * - Any validation failed (file type, sample rate, bit depth, channels)
 * - File has error status
 * - Any metric has error status
 *
 * Returns 'warning' if any metric has warning status
 * Returns 'pass' if all metrics are success
 *
 * Note: Speech overlap and stereo type validation are preset-aware and not included here.
 * These are handled by the caller which has access to the selected preset.
 */
export function computeExperimentalStatus(result: any): 'pass' | 'warning' | 'fail' | 'error' {
  // Check if validation failed (file type, sample rate, bit depth, channels)
  // These are instant failures that mean no analysis was performed
  if (result.validation?.fileType?.status === 'fail' ||
      result.validation?.sampleRate?.status === 'fail' ||
      result.validation?.bitDepth?.status === 'fail' ||
      result.validation?.channels?.status === 'fail') {
    return 'fail'; // Validation failure - instant fail
  }

  // For error status (file read failures, etc), preserve it
  if (result.status === 'error') {
    return 'error';
  }

  const statuses: Array<'success' | 'warning' | 'error'> = [];

  // Check normalization
  if (result.normalizationStatus) {
    const normStatus = getNormalizationStatus(result.normalizationStatus);
    if (normStatus) statuses.push(normStatus);
  }

  // Check noise floor
  if (result.noiseFloorDb !== undefined && result.noiseFloorDb !== -Infinity) {
    const noiseStatus = getNoiseFloorStatus(result.noiseFloorDb);
    if (noiseStatus) statuses.push(noiseStatus);
  }

  // Check reverb
  if (result.reverbInfo?.label) {
    const reverbStatus = getReverbStatus(result.reverbInfo.label);
    if (reverbStatus) statuses.push(reverbStatus);
  }

  // Check silence metrics
  // Leading/Trailing: < 5s = success, 5-10s = warning, >= 10s = error
  if (result.leadingSilence !== undefined) {
    const leadStatus = getSilenceStatus(result.leadingSilence, 'lead-trail');
    if (leadStatus) statuses.push(leadStatus);
  }
  if (result.trailingSilence !== undefined) {
    const trailStatus = getSilenceStatus(result.trailingSilence, 'lead-trail');
    if (trailStatus) statuses.push(trailStatus);
  }
  // Max silence gap: < 5s = success, 5-10s = warning, >= 10s = error
  if (result.longestSilence !== undefined) {
    const maxSilenceStatus = getSilenceStatus(result.longestSilence, 'max');
    if (maxSilenceStatus) statuses.push(maxSilenceStatus);
  }

  // Check mic bleed
  if (result.micBleed) {
    const micBleedStatus = getMicBleedStatus(result.micBleed);
    if (micBleedStatus) statuses.push(micBleedStatus);
  }

  // Check clipping analysis
  if (result.clippingAnalysis) {
    const clippingStatus = getClippingStatus(result.clippingAnalysis);
    if (clippingStatus) statuses.push(clippingStatus);
  }

  // Note: Speech overlap and stereo type validation are preset-aware and are not included here.
  // These are handled by the caller (e.g., ResultsTable.getExperimentalRowStatus) which has
  // access to the selected preset for validation-aware thresholds.

  // Determine worst status
  if (statuses.includes('error')) return 'fail';
  if (statuses.includes('warning')) return 'warning';
  return 'pass';
}
