# Breath Sound Analysis

**Priority**: Tier 2 - Low Impact, Medium Effort
**Estimated Effort**: 2 days
**Dependencies**: None

## Problem Statement

Audible breathing between words is common in voice recordings. While natural, excessive breath sounds can be distracting and indicate:
- **Mic too close**: Breaths picked up clearly
- **Poor technique**: Breathing into mic instead of away
- **Gain too high**: Breaths amplified excessively

Professional voice recordings typically minimize or remove breath sounds in post-production.

## Solution Overview

Analyze silence gaps between speech for low-frequency breathing patterns. Breath sounds have distinct characteristics:
- **Duration**: 100-500ms
- **Frequency**: Low (100-400 Hz)
- **Pattern**: Continuous, non-transient
- **Location**: Between speech segments

### Algorithm

```javascript
1. Identify silence segments (already available)
2. Filter silence segments by duration (100-500ms)
3. Analyze low-frequency energy (100-400 Hz) in these segments
4. Compare to room noise floor
5. Detect breaths that are >10 dB above noise floor
6. Count and classify severity
```

## Technical Specification

### Core Method

```javascript
async analyzeBreathSounds(audioBuffer, silenceData, noiseFloorDb, progressCallback) {
  const BREATH_BAND = { low: 100, high: 400 };
  const BREATH_DURATION_MIN = 0.1;   // 100ms
  const BREATH_DURATION_MAX = 0.5;   // 500ms
  const BREATH_THRESHOLD = noiseFloorDb + 10; // 10 dB above noise floor

  // Filter to breath frequency range
  const breathChannels = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    breathChannels.push(
      this.applyBandpassFilter(
        audioBuffer.getChannelData(ch),
        BREATH_BAND.low,
        BREATH_BAND.high,
        audioBuffer.sampleRate
      )
    );
  }

  const breaths = [];

  for (const silence of silenceData.silenceSegments) {
    // Skip if wrong duration
    if (silence.duration < BREATH_DURATION_MIN || silence.duration > BREATH_DURATION_MAX) {
      continue;
    }

    // Measure energy in this silence gap
    const energy = this.calculateSegmentEnergy(
      breathChannels,
      silence.startTime,
      silence.endTime,
      audioBuffer.sampleRate
    );

    const energyDb = 20 * Math.log10(energy);

    if (energyDb > BREATH_THRESHOLD) {
      breaths.push({
        timestamp: silence.startTime,
        duration: silence.duration,
        level: energyDb
      });
    }
  }

  const duration = audioBuffer.length / audioBuffer.sampleRate / 60; // minutes
  const breathsPerMinute = breaths.length / duration;

  let severity;
  if (breathsPerMinute > 15) {
    severity = 'critical';  // Excessive
  } else if (breathsPerMinute > 10) {
    severity = 'warning';   // Noticeable
  } else {
    severity = 'good';      // Acceptable
  }

  const recommendations = [];
  if (severity !== 'good') {
    recommendations.push('Increase mic distance to 8-12 inches');
    recommendations.push('Turn head slightly when breathing');
    recommendations.push('Use noise gate to reduce breath sounds');
  }

  return {
    severity,
    breathCount: breaths.length,
    breathsPerMinute,
    averageLevel: breaths.length > 0 ?
      breaths.reduce((sum, b) => sum + b.level, 0) / breaths.length : null,
    worstBreaths: breaths.sort((a, b) => b.level - a.level).slice(0, 10),
    recommendations
  };
}
```

### Return Data Structure

```typescript
interface BreathSoundAnalysis {
  severity: 'good' | 'warning' | 'critical';
  breathCount: number;
  breathsPerMinute: number;
  averageLevel: number | null;
  worstBreaths: Array<{
    timestamp: number;
    duration: number;
    level: number;
  }>;
  recommendations: string[];
}
```

## Integration

- **Progress**: 82-87% (5% of total)
- **UI Column**: "Breath Sounds"
- **CSV Columns**: Severity, Breath Count, Breaths/Min, Avg Level, Worst Breath Time
- **Test Samples**: heavy-breathing.wav, controlled-breathing.wav, minimal-breaths.wav

## Thresholds

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Breaths/Min | <10 | 10-15 | >15 |
| Level vs Noise Floor | <10 dB | 10-20 dB | >20 dB |

## Success Criteria

- ✅ Accurately detects breath sounds
- ✅ Distinguishes from room noise
- ✅ Doesn't false-detect on speech
- ✅ Provides positioning recommendations
- ✅ Processing time <3% of total

## Notes

- **Aesthetic preference**: Some producers prefer natural breaths
- **Genre-specific**: More critical for audiobooks than podcasts
- **Post-processing**: Often removed with noise gate
