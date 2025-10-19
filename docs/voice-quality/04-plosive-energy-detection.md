# Plosive Energy Detection

**Priority**: Tier 2 - Medium Impact, Medium Effort
**Estimated Effort**: 2-3 days
**Dependencies**: Plosive Clipping Enhancement (03)

## Problem Statement

Plosive sounds ("p", "b", "t", "k") create brief, high-energy bursts that can:
- Cause listener fatigue even when not clipping
- Indicate poor mic technique (no pop filter, too close)
- Sound unprofessional and distracting

This analysis detects excessive plosive energy BEFORE it clips, allowing prevention rather than just detection of clipping.

## Solution Overview

Detect rapid energy increases in the low-frequency band (50-200 Hz) where plosive energy concentrates. Measure the intensity and frequency of plosive events.

### Algorithm

```javascript
1. Filter audio to plosive frequency range (50-200 Hz)
2. Detect sudden energy increases (>3x rise in <10ms)
3. Classify plosive severity based on level
4. Count events and identify worst instances
5. Recommend pop filter if excessive
```

## Technical Specification

### Core Method

```javascript
async analyzePlosiveEnergy(audioBuffer, silenceData, progressCallback) {
  const PLOSIVE_BAND = { low: 50, high: 200 };
  const ENERGY_RISE_THRESHOLD = 3.0;  // 3x sudden increase
  const WINDOW_SIZE_MS = 10;  // 10ms windows
  const EXCESSIVE_LEVEL_DB = -10;  // >-10 dB is excessive

  // Filter to plosive range
  const plosiveChannels = [];
  for (let ch = 0; ch < channels; ch++) {
    plosiveChannels.push(
      this.applyBandpassFilter(audioBuffer.getChannelData(ch), 50, 200, sampleRate)
    );
  }

  // Detect rapid energy increases
  const events = [];
  const windowSize = Math.floor(sampleRate * (WINDOW_SIZE_MS / 1000));

  for (let i = windowSize; i < length; i += windowSize) {
    const currentRMS = this.calculateRMS(plosiveChannels, i, windowSize);
    const prevRMS = this.calculateRMS(plosiveChannels, i - windowSize, windowSize);

    if (currentRMS > prevRMS * ENERGY_RISE_THRESHOLD) {
      const plosiveDb = 20 * Math.log10(currentRMS);

      events.push({
        timestamp: i / sampleRate,
        level: plosiveDb,
        ratio: currentRMS / prevRMS,
        excessive: plosiveDb > EXCESSIVE_LEVEL_DB
      });
    }
  }

  // Calculate severity
  const excessiveCount = events.filter(e => e.excessive).length;
  let severity;
  if (excessiveCount > 10) {
    severity = 'critical';
  } else if (events.length > 30) {
    severity = 'warning';
  } else {
    severity = 'good';
  }

  return {
    severity,
    eventCount: events.length,
    excessiveCount,
    averageLevel: this.calculateAverage(events.map(e => e.level)),
    worstEvents: events.sort((a, b) => b.level - a.level).slice(0, 10),
    recommendations: severity !== 'good' ? ['Use pop filter', 'Increase mic distance to 6-8 inches'] : []
  };
}
```

### Return Data Structure

```typescript
interface PlosiveEnergyAnalysis {
  severity: 'good' | 'warning' | 'critical';
  eventCount: number;
  excessiveCount: number;
  averageLevel: number;
  worstEvents: Array<{
    timestamp: number;
    level: number;
    ratio: number;
    excessive: boolean;
  }>;
  recommendations: string[];
}
```

## Integration

- **Progress**: 72-77% (5% of total)
- **UI Column**: "Plosive Energy"
- **CSV Columns**: Severity, Event Count, Excessive Count, Avg Level, Worst Event Time
- **Test Samples**: excessive-plosives.wav, pop-filtered.wav, normal-speech.wav

## Success Criteria

- ✅ Detects excessive plosive energy before clipping
- ✅ Distinguishes from normal speech dynamics
- ✅ Provides pop filter recommendation when appropriate
- ✅ Processing time <4% of total
