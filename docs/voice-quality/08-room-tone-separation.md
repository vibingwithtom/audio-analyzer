# Room Tone Separation

**Priority**: Tier 3 - Low Impact, Medium Effort
**Estimated Effort**: 1-2 days
**Dependencies**: None (enhancement of existing noise floor analysis)

## Problem Statement

Current noise floor analysis treats all background noise equally. For voice recordings, it's useful to distinguish between:

1. **Room Tone**: Constant environmental noise (HVAC, computer fans, electrical hum)
   - Measured in complete silence (between speech)
   - Represents actual recording environment

2. **Breath/Mouth Noise**: Sounds made by the speaker during recording
   - Measured during low-level speech activity
   - Represents technique and mic placement

Separating these provides better diagnostic information for voice recording issues.

## Solution Overview

Enhance existing noise floor analysis to calculate two separate metrics:
- **Pure room tone**: Analysis of true silence segments (no speech activity)
- **Speech-adjacent noise**: Low-level sounds during speech (breaths, mouth noise, rustling)

### Algorithm

```javascript
1. Use existing silence detection to identify pure silence
2. Analyze noise floor in pure silence segments (room tone)
3. Identify low-level audio during speech segments (breath/mouth)
4. Calculate separate noise floors
5. Compare the two to identify excessive breath sounds
```

## Technical Specification

### Enhanced Method

**Location**: `packages/core/level-analyzer.js`

**Modify**: `analyzeNoiseFloor()` to return additional data

```javascript
async analyzeNoiseFloorEnhanced(channelData, channels, length, silenceSegments, speechSegments, progressCallback) {
  // Calculate standard noise floor (existing)
  const standardNoiseFloor = await this.analyzeNoiseFloor(channelData, channels, length, progressCallback);

  // NEW: Separate analysis

  // 1. Room Tone: Analyze only complete silence segments
  const roomToneRMS = [];
  for (const silence of silenceSegments.filter(s => s.duration > 0.5)) {
    // Only analyze silence longer than 500ms (true gaps)
    const startSample = Math.floor(silence.startTime * sampleRate);
    const endSample = Math.floor(silence.endTime * sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      const data = channelData[ch];
      let sumSquares = 0;

      for (let i = startSample; i < endSample; i++) {
        sumSquares += data[i] ** 2;
      }

      const rms = Math.sqrt(sumSquares / (endSample - startSample));
      if (rms > 0) roomToneRMS.push(rms);
    }
  }

  const roomToneDb = this.calculateNoiseFloorFromRMS(roomToneRMS);

  // 2. Speech-Adjacent Noise: Analyze quietest parts of speech
  const speechNoiseRMS = [];
  for (const speech of speechSegments) {
    // Analyze quietest 10% of speech segment
    const startSample = Math.floor(speech.startTime * sampleRate);
    const endSample = Math.floor(speech.endTime * sampleRate);
    const windowSize = 2205; // 50ms at 44.1kHz

    for (let i = startSample; i < endSample - windowSize; i += windowSize) {
      for (let ch = 0; ch < channels; ch++) {
        const data = channelData[ch];
        let sumSquares = 0;

        for (let j = i; j < i + windowSize; j++) {
          sumSquares += data[j] ** 2;
        }

        const rms = Math.sqrt(sumSquares / windowSize);
        speechNoiseRMS.push(rms);
      }
    }
  }

  // Get quietest 10% from speech
  speechNoiseRMS.sort((a, b) => a - b);
  const cutoff = Math.floor(speechNoiseRMS.length * 0.1);
  const speechNoiseQuiet = speechNoiseRMS.slice(0, cutoff);
  const speechNoiseDb = this.calculateNoiseFloorFromRMS(speechNoiseQuiet);

  // 3. Calculate difference and identify issues
  const breathNoiseExcess = speechNoiseDb - roomToneDb; // How much louder during speech

  let issue = null;
  if (breathNoiseExcess > 15) {
    issue = 'excessive_breath_sounds';
  } else if (breathNoiseExcess > 10) {
    issue = 'noticeable_breath_sounds';
  }

  return {
    ...standardNoiseFloor,  // Keep existing data

    // NEW: Separated noise floor data
    roomTone: {
      noiseFloorDb: roomToneDb,
      description: 'Environmental noise in silence'
    },
    speechAdjacent: {
      noiseFloorDb: speechNoiseDb,
      description: 'Breath and mouth sounds during speech'
    },
    breathNoiseExcess: breathNoiseExcess,
    issue: issue,
    recommendations: issue ? [
      'Mic may be too close - breaths are very audible',
      'Turn head slightly when breathing',
      'Consider noise gate in post-production'
    ] : []
  };
}
```

### Return Data Structure

```typescript
interface NoiseFloorAnalysisEnhanced {
  // ... existing noise floor fields ...

  // NEW: Separated noise analysis
  roomTone: {
    noiseFloorDb: number;      // -72.3 dB (pure silence)
    description: string;
  };
  speechAdjacent: {
    noiseFloorDb: number;      // -55.1 dB (quietest parts of speech)
    description: string;
  };
  breathNoiseExcess: number;   // 17.2 dB (difference)
  issue: 'excessive_breath_sounds' | 'noticeable_breath_sounds' | null;
  recommendations: string[];
}
```

## Integration

### UI Display

Enhanced noise floor tooltip:

```javascript
function getNoiseFloorTooltip(result) {
  const nf = result.noiseFloorAnalysis;

  let tooltip = `Noise Floor Analysis\n────────────────────\n`;
  tooltip += `Overall: ${nf.overall.toFixed(1)} dB\n\n`;

  if (nf.roomTone && nf.speechAdjacent) {
    tooltip += `Room Tone: ${nf.roomTone.noiseFloorDb.toFixed(1)} dB\n`;
    tooltip += `Speech Noise: ${nf.speechAdjacent.noiseFloorDb.toFixed(1)} dB\n`;
    tooltip += `Breath Excess: ${nf.breathNoiseExcess.toFixed(1)} dB\n`;

    if (nf.issue) {
      tooltip += `\n⚠️ ${nf.issue.replace('_', ' ')}\n`;
    }
  }

  return tooltip;
}
```

### CSV Export

Add columns:
- Room Tone (dB)
- Speech-Adjacent Noise (dB)
- Breath Noise Excess (dB)
- Breath Noise Issue

## Benefits

✅ **Diagnostic clarity**: Separates environment from technique issues
✅ **Actionable feedback**: "Room is quiet but breaths are loud" → mic too close
✅ **Better troubleshooting**: Identifies whether to treat room or change technique

## Interpretation Guide

| Room Tone | Speech Noise | Breath Excess | Diagnosis |
|-----------|--------------|---------------|-----------|
| -70 dB | -70 dB | 0 dB | Excellent environment & technique |
| -50 dB | -50 dB | 0 dB | Noisy environment, but technique OK |
| -70 dB | -50 dB | 20 dB | Clean room, but mic too close |
| -50 dB | -40 dB | 10 dB | Both environment and technique need work |

## Implementation

### Phase 1: Core (1 day)
- [ ] Enhance `analyzeNoiseFloor()` with separation logic
- [ ] Add TypeScript interfaces
- [ ] Test with sample files

### Phase 2: UI & Export (0.5 days)
- [ ] Update tooltip
- [ ] Add CSV columns
- [ ] Add recommendations

### Phase 3: Testing (0.5 days)
- [ ] Test with various recordings
- [ ] Validate thresholds
- [ ] Document findings

## Success Criteria

- ✅ Accurately separates room tone from breath noise
- ✅ Provides useful diagnostic information
- ✅ Minimal performance impact (reuses existing analysis)
- ✅ Clear, actionable recommendations

## Test Samples

- **quiet-room-close-mic.wav** - Room tone -70 dB, speech noise -50 dB (mic too close)
- **noisy-room-good-technique.wav** - Both around -50 dB (room needs treatment)
- **professional-recording.wav** - Both around -70 dB (ideal)
