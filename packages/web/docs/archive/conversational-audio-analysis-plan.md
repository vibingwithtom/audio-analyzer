# Conversational Audio Analysis - Implementation Plan

**Date:** October 14, 2025
**Status:** Planning
**Target:** Experimental Analysis Mode

## Overview

This document outlines the plan to add specialized analysis features for conversational stereo audio files. These features address the specific QC requirements for multi-speaker recordings where each speaker is isolated to their own channel.

## Team Requirements

Based on project team feedback, the following validations are needed:

| Requirement | Status | Implementation |
|------------|--------|----------------|
| a. No overlapping speech | ❌ **TO DO** | New analysis |
| b. Single stereo file confirmation | ✅ **DONE** | Stereo Separation column |
| c. Stereo channel verification (consistency) | ❌ **TO DO** | New analysis |
| d. Sync corrections and padding adjustments | 🟡 **PARTIAL** | Have silence; need channel sync |
| e. File naming convention verification | ✅ **DONE** | Filename validation |
| f. Not able to hear other voice in opposite channel | ✅ **DONE** | Mic Bleed column |

---

## New Analyses to Implement

### 1. Overlapping Speech Detection

**Purpose:** Detect when both speakers are talking simultaneously, which violates conversational stereo requirements.

**Current Limitation:**
- Stereo Separation tracks "balanced blocks" (similar RMS levels)
- This includes mic bleed, noise, and ambience - NOT just overlapping speech
- Need dedicated analysis that detects true dual-speaker overlap

**Implementation:**

```javascript
analyzeOverlappingSpeech(audioBuffer, noiseFloorDb) {
  // Only for stereo files
  if (audioBuffer.numberOfChannels !== 2) return null;

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const blockSize = Math.floor(sampleRate * 0.25); // 250ms blocks

  // Speech threshold: noise floor + 20 dB (active speech level)
  const speechThresholdDb = noiseFloorDb + 20;
  const speechThresholdLinear = Math.pow(10, speechThresholdDb / 20);

  let totalActiveBlocks = 0;
  let overlapBlocks = 0;

  for (let i = 0; i < length; i += blockSize) {
    const blockEnd = Math.min(i + blockSize, length);
    const currentBlockSize = blockEnd - i;

    // Calculate RMS for each channel in this block
    let sumSquaresLeft = 0;
    let sumSquaresRight = 0;

    for (let j = i; j < blockEnd; j++) {
      sumSquaresLeft += leftChannel[j] * leftChannel[j];
      sumSquaresRight += rightChannel[j] * rightChannel[j];
    }

    const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
    const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);

    // Check if BOTH channels have active speech
    const leftActive = rmsLeft > speechThresholdLinear;
    const rightActive = rmsRight > speechThresholdLinear;

    if (leftActive || rightActive) {
      totalActiveBlocks++;

      if (leftActive && rightActive) {
        overlapBlocks++;
      }
    }
  }

  const overlapPercentage = totalActiveBlocks > 0
    ? (overlapBlocks / totalActiveBlocks) * 100
    : 0;

  return {
    totalActiveBlocks,
    overlapBlocks,
    overlapPercentage,
    speechThresholdDb
  };
}
```

**Display in Experimental Table:**

**Column:** "Speech Overlap"

**Values:**
- `X.X%` - Percentage of active speech time with overlap
- Color coded:
  - 🟢 Green (pass): < 5% overlap
  - 🟠 Orange (warning): 5-15% overlap
  - 🔴 Red (fail): > 15% overlap
- Tooltip: "Detects when both channels have active speech simultaneously. Based on noise floor + 20 dB threshold."

---

### 2. Channel Consistency Verification

**Purpose:** Ensure the same speaker stays in the same channel throughout the recording (no channel swapping).

**Problem:**
- If speakers accidentally swap sides mid-recording, or channels get swapped in post-production
- File appears as "Conversational Stereo" but channels are inconsistent

**Implementation:**

```javascript
analyzeChannelConsistency(audioBuffer) {
  // Only for stereo files
  if (audioBuffer.numberOfChannels !== 2) return null;

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const blockSize = Math.floor(sampleRate * 0.25); // 250ms blocks
  const dominanceRatioThreshold = 2.5; // 2.5x louder = dominant (more conservative)
  const silenceThreshold = 0.001;

  // Track dominance patterns in segments
  const segmentDuration = 10; // 10 second segments
  const segmentBlocks = Math.floor((segmentDuration * sampleRate) / blockSize);

  let segments = [];
  let currentSegment = { leftDominant: 0, rightDominant: 0, balanced: 0 };
  let blockCount = 0;

  for (let i = 0; i < length; i += blockSize) {
    const blockEnd = Math.min(i + blockSize, length);
    const currentBlockSize = blockEnd - i;

    let sumSquaresLeft = 0;
    let sumSquaresRight = 0;

    for (let j = i; j < blockEnd; j++) {
      sumSquaresLeft += leftChannel[j] * leftChannel[j];
      sumSquaresRight += rightChannel[j] * rightChannel[j];
    }

    const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
    const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);

    // Skip silent blocks
    if (rmsLeft < silenceThreshold && rmsRight < silenceThreshold) {
      continue;
    }

    const ratio = rmsLeft / rmsRight;

    if (ratio > dominanceRatioThreshold) {
      currentSegment.leftDominant++;
    } else if (ratio < 1 / dominanceRatioThreshold) {
      currentSegment.rightDominant++;
    } else {
      currentSegment.balanced++;
    }

    blockCount++;

    // End of segment
    if (blockCount >= segmentBlocks) {
      segments.push({ ...currentSegment });
      currentSegment = { leftDominant: 0, rightDominant: 0, balanced: 0 };
      blockCount = 0;
    }
  }

  // Add final partial segment
  if (blockCount > 0) {
    segments.push(currentSegment);
  }

  // Analyze consistency: check if dominance patterns flip
  let inconsistentSegments = 0;
  let expectedPattern = null;

  for (const segment of segments) {
    const total = segment.leftDominant + segment.rightDominant + segment.balanced;
    if (total === 0) continue;

    // Determine this segment's dominant pattern
    let pattern = 'balanced';
    if (segment.leftDominant > segment.rightDominant && segment.leftDominant > segment.balanced) {
      pattern = 'left';
    } else if (segment.rightDominant > segment.leftDominant && segment.rightDominant > segment.balanced) {
      pattern = 'right';
    }

    // Set initial expected pattern
    if (expectedPattern === null && pattern !== 'balanced') {
      expectedPattern = pattern;
    }

    // Check for inconsistency (pattern flips from left-dominant to right-dominant or vice versa)
    if (expectedPattern !== null && pattern !== 'balanced' && pattern !== expectedPattern) {
      inconsistentSegments++;
    }
  }

  const isConsistent = inconsistentSegments === 0;
  const consistencyPercentage = segments.length > 0
    ? ((segments.length - inconsistentSegments) / segments.length) * 100
    : 100;

  return {
    isConsistent,
    consistencyPercentage,
    totalSegments: segments.length,
    inconsistentSegments,
    expectedPattern
  };
}
```

**Display in Experimental Table:**

**Column:** "Channel Consistency"

**Values:**
- `Consistent` - No channel swapping detected
- `Inconsistent (X%)` - Channel swapping detected, showing percentage consistent
- Color coded:
  - 🟢 Green (pass): 100% consistent
  - 🟠 Orange (warning): 90-99% consistent
  - 🔴 Red (fail): < 90% consistent
- Tooltip: "Verifies speakers remain in same channels throughout. Detects mid-recording channel swaps."

---

### 3. Channel Time-Sync Detection

**Purpose:** Detect if one channel starts or ends earlier than the other (timing misalignment).

**Problem:**
- Recording issues or editing mistakes can cause channels to be out of sync
- One speaker's audio might start/end at different times

**Implementation:**

```javascript
analyzeChannelSync(audioBuffer, silenceThresholdDb) {
  // Only for stereo files
  if (audioBuffer.numberOfChannels !== 2) return null;

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const silenceThresholdLinear = Math.pow(10, silenceThresholdDb / 20);
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows

  // Find first and last active samples in each channel
  let leftFirstActive = -1;
  let leftLastActive = -1;
  let rightFirstActive = -1;
  let rightLastActive = -1;

  for (let i = 0; i < length; i += windowSize) {
    const end = Math.min(i + windowSize, length);

    let maxLeft = 0;
    let maxRight = 0;

    for (let j = i; j < end; j++) {
      maxLeft = Math.max(maxLeft, Math.abs(leftChannel[j]));
      maxRight = Math.max(maxRight, Math.abs(rightChannel[j]));
    }

    if (maxLeft > silenceThresholdLinear) {
      if (leftFirstActive === -1) leftFirstActive = i;
      leftLastActive = i;
    }

    if (maxRight > silenceThresholdLinear) {
      if (rightFirstActive === -1) rightFirstActive = i;
      rightLastActive = i;
    }
  }

  // Calculate timing differences
  const startDiffSamples = Math.abs(leftFirstActive - rightFirstActive);
  const endDiffSamples = Math.abs(leftLastActive - rightLastActive);

  const startDiffMs = (startDiffSamples / sampleRate) * 1000;
  const endDiffMs = (endDiffSamples / sampleRate) * 1000;

  const maxDiffMs = Math.max(startDiffMs, endDiffMs);

  // Sync status
  let syncStatus = 'In Sync';
  if (maxDiffMs > 100) {
    syncStatus = 'Out of Sync';
  } else if (maxDiffMs > 50) {
    syncStatus = 'Slight Offset';
  }

  return {
    syncStatus,
    startDiffMs,
    endDiffMs,
    maxDiffMs,
    leftFirstActive: leftFirstActive / sampleRate,
    rightFirstActive: rightFirstActive / sampleRate,
    leftLastActive: leftLastActive / sampleRate,
    rightLastActive: rightLastActive / sampleRate
  };
}
```

**Display in Experimental Table:**

**Column:** "Channel Sync"

**Values:**
- `In Sync` - Channels start/end within 50ms
- `Slight Offset (XXms)` - 50-100ms difference
- `Out of Sync (XXms)` - > 100ms difference
- Color coded:
  - 🟢 Green (pass): < 50ms
  - 🟠 Orange (warning): 50-100ms
  - 🔴 Red (fail): > 100ms
- Tooltip: "Detects timing misalignment between channels. Shows start: Xms, end: Yms"

---

## Integration Plan

### Phase 1: Core Implementation (packages/core)

1. **Add new unified method to `LevelAnalyzer` class:**
   - `analyzeConversationalAudio(audioBuffer, noiseFloorDb, peakDb)`
   - **Single-pass optimization**: Calculate RMS blocks once, use for all three analyses
   - Returns combined results for overlap, consistency, and sync
   - Includes comprehensive error handling for edge cases

2. **Individual analysis methods** (called internally by unified method):
   - `analyzeOverlappingSpeech(audioBuffer, noiseFloorDb, rmsBlocks)`
   - `analyzeChannelConsistency(audioBuffer, rmsBlocks)`
   - `analyzeChannelSync(audioBuffer, noiseFloorDb, peakDb)`

3. **Call from stereo analysis flow:**
   - Only run when `stereoType === 'Conversational Stereo'`
   - Include in experimental analysis results
   - Pass noise floor and peak from existing analysis

3. **Return new data in results object:**
   ```javascript
   {
     // Existing...
     stereoSeparation: { ... },
     micBleed: { ... },

     // NEW - only for conversational stereo
     conversationalAnalysis: {
       overlapPercentage: 2.3,
       channelConsistency: 'Consistent',
       consistencyPercentage: 100,
       syncStatus: 'In Sync',
       startDiffMs: 12,
       endDiffMs: 8,
       maxDiffMs: 12
     }
   }
   ```

### Phase 2: UI Display (packages/web)

1. **Update `ResultsTable.svelte`:**
   - Add three new columns to experimental table (after Stereo Separation):
     - "Speech Overlap"
     - "Channel Consistency"
     - "Channel Sync"
   - Add helper functions for color coding
   - Only show for conversational stereo files (N/A otherwise)

2. **Update `ResultsDisplay.svelte`:**
   - Update `getExperimentalStatus()` to include new metrics in Pass/Warning/Fail calculation

3. **Add tooltips:**
   - Explain what each metric measures
   - Show detailed values on hover

### Phase 3: Testing

1. **Test files needed:**
   - ✅ Clean conversational stereo (no overlap, consistent, in sync)
   - ⚠️ Some overlapping speech (5-15%)
   - 🔴 Heavy overlapping speech (>15%)
   - 🔴 Channel swap mid-recording
   - 🔴 Channels out of sync (>100ms)
   - ✅ Mono-as-stereo (should show N/A for these metrics)

2. **Validate thresholds:**
   - Speech overlap: < 5% pass, 5-15% warning, > 15% fail
   - Consistency: 100% pass, 90-99% warning, < 90% fail
   - Sync: < 50ms pass, 50-100ms warning, > 100ms fail

### Phase 4: Documentation

1. **Update user-facing docs:**
   - Explain new conversational audio validations
   - Document thresholds and what they mean
   - Provide examples of common issues

2. **Update `mic-bleed-analysis.md`:**
   - Add section on related conversational audio metrics
   - Cross-reference with new analyses

---

## Experimental Table Layout (After Implementation)

| Column | Description | Applies To |
|--------|-------------|------------|
| Filename | File name | All |
| Peak Level | Maximum amplitude | All |
| Normalization | -6 dB check | All |
| Noise Floor (Old) | Bottom 20% RMS | All |
| Noise Floor (New) | Histogram mode | All |
| Reverb (RT60) | Room acoustics | All |
| Silence | Lead/Trail/Max | All |
| Stereo Separation | Mono/Conversational/etc | Stereo only |
| **Speech Overlap** | **Dual-speaker overlap %** | **Conv. Stereo only** |
| **Channel Consistency** | **Speaker stays in channel** | **Conv. Stereo only** |
| **Channel Sync** | **Timing alignment** | **Conv. Stereo only** |
| Mic Bleed | Cross-channel leakage | Conv. Stereo only |

---

## Performance Considerations

### Single-Pass Optimization
All three analyses use 250ms block-based RMS calculations. To avoid redundant computation:

```javascript
analyzeConversationalAudio(audioBuffer, noiseFloorDb, peakDb) {
  if (audioBuffer.numberOfChannels !== 2) return null;

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  // Single pass: calculate RMS blocks once
  const blockSize = Math.floor(sampleRate * 0.25); // 250ms blocks
  const rmsBlocks = [];

  for (let i = 0; i < length; i += blockSize) {
    const blockEnd = Math.min(i + blockSize, length);
    const currentBlockSize = blockEnd - i;

    let sumSquaresLeft = 0;
    let sumSquaresRight = 0;

    for (let j = i; j < blockEnd; j++) {
      sumSquaresLeft += leftChannel[j] * leftChannel[j];
      sumSquaresRight += rightChannel[j] * rightChannel[j];
    }

    const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
    const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);

    rmsBlocks.push({ rmsLeft, rmsRight, startSample: i, endSample: blockEnd });
  }

  // Run all three analyses using the same RMS data
  const overlap = this.analyzeOverlappingSpeech(noiseFloorDb, rmsBlocks);
  const consistency = this.analyzeChannelConsistency(rmsBlocks);
  const sync = this.analyzeChannelSync(leftChannel, rightChannel, sampleRate, noiseFloorDb, peakDb);

  return { overlap, consistency, sync };
}
```

**Performance Impact:**
- Single RMS calculation pass instead of three
- ~3x faster for conversational stereo files
- Minimal memory overhead (RMS blocks array)
- Critical for batch processing performance

### Error Handling

All analysis functions include robust error handling:

```javascript
// Example error handling patterns
- Check for null/undefined audio buffers
- Validate channel count (must be 2)
- Handle very short files (< 1 second)
- Guard against division by zero
- Handle silent channels (no active speech)
- Validate array indices before access
- Return null for invalid inputs (graceful degradation)
```

**Edge Cases Handled:**
1. **Silent files**: Return 0% overlap, consistent, in sync
2. **Very short files**: Skip if < 1 second (insufficient data)
3. **Single-channel dominant**: Still calculate metrics, mark as warning
4. **No active speech**: Return 0% overlap with appropriate status
5. **Invalid thresholds**: Use safe defaults

---

## Benefits

1. **Complete QC coverage** for conversational stereo requirements
2. **Automated validation** replaces manual listening for many issues
3. **Batch processing** can flag problematic files at scale
4. **Clear metrics** with color coding for quick identification
5. **Detailed tooltips** help users understand what failed

---

## Future Enhancements (Not in Initial Scope)

- **Waveform visualization** showing overlap regions
- **Export report** with timestamps of issues
- **Adjustable thresholds** per preset/project
- **Speaker identification** (which channel is which person)
- **Audio quality per speaker** (separate noise floor per channel)

---

## References

- Current stereo separation: `packages/core/level-analyzer.js:408-497`
- Current mic bleed analysis: `packages/core/level-analyzer.js:508-678`
- Experimental table: `packages/web/src/components/ResultsTable.svelte:310-427`
- Batch summary logic: `packages/web/src/components/ResultsDisplay.svelte:27-113`
