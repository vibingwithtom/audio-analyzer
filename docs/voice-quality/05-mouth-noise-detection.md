# Mouth Noise Detection

**Priority**: Tier 2 - Medium Impact, High Effort
**Estimated Effort**: 3-4 days
**Dependencies**: None

## Problem Statement

Mouth noises (lip smacks, tongue clicks, saliva sounds) are unprofessional and distracting in voice recordings. They occur:
- At speech starts/ends (lip smacks)
- Between words (tongue clicks)
- During pauses (swallowing, mouth movements)
- When recording with dry mouth

These are typically removed in post-production but detection helps identify recording technique issues.

## Solution Overview

Detect brief, broadband transients that occur in silence gaps or at speech boundaries. Mouth noises have distinct characteristics:
- **Duration**: 10-50ms (brief)
- **Frequency**: Broadband (wide frequency range)
- **Location**: Silence gaps or speech edges
- **Pattern**: Random, non-periodic

### Algorithm

```javascript
1. Extract silence segments and speech boundaries
2. Analyze 100ms before/after each speech segment
3. Detect brief transients (10-50ms) above threshold
4. Filter out breath sounds (low-frequency continuous)
5. Count events and classify severity
```

## Technical Specification

### Core Method

```javascript
async analyzeMouthNoise(audioBuffer, silenceData, speechSegments, progressCallback) {
  const CLICK_DURATION_MIN = 0.01;  // 10ms
  const CLICK_DURATION_MAX = 0.05;  // 50ms
  const THRESHOLD_DB = -30;         // Relative to speech level
  const EDGE_WINDOW_MS = 100;       // Check 100ms around speech

  const clicks = [];

  for (const segment of speechSegments) {
    // Check leading edge (100ms before speech)
    const leadingClicks = this.detectBriefTransients(
      audioBuffer,
      segment.startTime - 0.1,
      segment.startTime,
      THRESHOLD_DB,
      CLICK_DURATION_MIN,
      CLICK_DURATION_MAX
    );

    // Check trailing edge (100ms after speech)
    const trailingClicks = this.detectBriefTransients(
      audioBuffer,
      segment.endTime,
      segment.endTime + 0.1,
      THRESHOLD_DB,
      CLICK_DURATION_MIN,
      CLICK_DURATION_MAX
    );

    clicks.push(...leadingClicks, ...trailingClicks);
  }

  const duration = audioBuffer.length / audioBuffer.sampleRate / 60; // minutes
  const clicksPerMinute = clicks.length / duration;

  let severity;
  if (clicksPerMinute > 10) {
    severity = 'critical';  // Very distracting
  } else if (clicksPerMinute > 5) {
    severity = 'warning';   // Noticeable
  } else {
    severity = 'good';      // Acceptable
  }

  return {
    severity,
    clickCount: clicks.length,
    clicksPerMinute,
    timestamps: clicks.map(c => c.timestamp),
    recommendations: severity !== 'good' ?
      ['Stay hydrated during recording', 'Edit out mouth noises in post-production'] : []
  };
}

detectBriefTransients(audioBuffer, startTime, endTime, threshold, minDur, maxDur) {
  // Implementation:
  // 1. Calculate envelope (RMS in 1ms windows)
  // 2. Find peaks above threshold
  // 3. Measure peak duration
  // 4. Filter by duration (10-50ms)
  // 5. Exclude periodic patterns (speech)
  // Returns: Array of { timestamp, duration, level }
}
```

### Return Data Structure

```typescript
interface MouthNoiseAnalysis {
  severity: 'good' | 'warning' | 'critical';
  clickCount: number;
  clicksPerMinute: number;
  timestamps: number[];
  recommendations: string[];
}
```

## Integration

- **Progress**: 77-82% (5% of total)
- **UI Column**: "Mouth Noise"
- **CSV Columns**: Severity, Click Count, Clicks/Min, First Click Time
- **Test Samples**: lip-smacks.wav, clean-speech.wav, tongue-clicks.wav

## Challenges

- **Distinguishing from speech**: Requires careful filtering
- **False positives**: May detect plosives or emphasis
- **Threshold tuning**: Varies by speaker and mic

## Success Criteria

- ✅ Detects >80% of mouth noises in test samples
- ✅ <10% false positive rate
- ✅ Provides actionable recommendations
- ✅ Processing time <5% of total
