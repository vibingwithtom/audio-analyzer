# Advanced Noise Floor Analysis

**Priority**: Tier 3 - Medium Impact, Medium Effort
**Estimated Effort**: 2-3 days
**Dependencies**: None (enhancement of existing noise floor analysis)

**Note**: This feature merges two concepts:
- Room Tone Separation (originally planned as #08)
- Denoiser/Processing Detection (from noise-floor-characterization-plan.md, revised for voice)

## Problem Statement

Current noise floor analysis provides a single dB value, but voice recordings benefit from understanding:

1. **Environmental vs. Technique Issues**
   - Room tone (ambient noise) vs. breath/mouth sounds
   - Helps diagnose: "Is the room noisy or is the mic too close?"

2. **Processing Artifact Detection**
   - Modern denoisers leave subtle artifacts
   - Noise gates create unnatural silence
   - Client requirement: Detect if denoisers were used

3. **Voice-Specific Characteristics**
   - Natural voice recordings have room tone, not digital silence
   - Natural transitions between speech and silence
   - Slight variance in ambient noise level

## Solution Overview

Enhance existing noise floor analysis with three components:

### 1. Room Tone Separation
Distinguish between pure environmental noise and recording technique issues.

### 2. Processing Artifact Detection
Identify signs of denoisers, noise gates, and aggressive processing using voice-specific methods.

### 3. Noise Consistency Analysis
Measure natural variance in ambient noise to detect unnatural clamping.

**Key Insight**: For voice recordings, we can use **simpler, faster methods** than FFT-based spectral analysis by leveraging existing silence detection.

## Technical Specification

### Core Algorithm

**Location**: `packages/core/level-analyzer.js`

**Enhanced Method**: `analyzeNoiseFloorAdvanced()`

```javascript
/**
 * Advanced noise floor analysis for voice recordings.
 * Separates room tone from breath sounds, detects processing artifacts.
 *
 * @param {Array} channelData Channel audio data
 * @param {number} channels Number of channels
 * @param {number} length Audio length in samples
 * @param {object} silenceSegments Silence detection results
 * @param {object} speechSegments Speech detection results
 * @param {function} progressCallback Optional progress callback
 * @returns {object} Advanced noise floor analysis
 */
async analyzeNoiseFloorAdvanced(channelData, channels, length, silenceSegments, speechSegments, progressCallback) {
  const sampleRate = 48000; // Typical

  // COMPONENT 1: Room Tone Analysis (pure silence only)
  const roomTone = this.analyzeRoomTone(channelData, silenceSegments, sampleRate);

  // COMPONENT 2: Speech-Adjacent Noise (breath/mouth sounds)
  const speechNoise = this.analyzeSpeechNoise(channelData, speechSegments, sampleRate);

  // COMPONENT 3: Processing Artifact Detection
  const artifacts = this.detectProcessingArtifacts(
    channelData,
    silenceSegments,
    speechSegments,
    roomTone,
    sampleRate
  );

  // COMPONENT 4: Interpretation and Recommendations
  const analysis = this.interpretNoiseFloorAdvanced(roomTone, speechNoise, artifacts);

  return {
    roomTone,
    speechNoise,
    artifacts,
    ...analysis
  };
}

/**
 * Analyzes pure room tone from silence segments.
 */
analyzeRoomTone(channelData, silenceSegments, sampleRate) {
  // Only analyze silence longer than 500ms (true gaps, not pauses)
  const longSilence = silenceSegments.filter(s => s.duration > 0.5);

  const roomToneRMS = [];

  for (const silence of longSilence) {
    const startSample = Math.floor(silence.startTime * sampleRate);
    const endSample = Math.floor(silence.endTime * sampleRate);

    for (let ch = 0; ch < channelData.length; ch++) {
      const data = channelData[ch];
      let sumSquares = 0;

      for (let i = startSample; i < endSample; i++) {
        sumSquares += data[i] ** 2;
      }

      const rms = Math.sqrt(sumSquares / (endSample - startSample));
      if (rms > 0) roomToneRMS.push(rms);
    }
  }

  // Calculate statistics
  const roomToneDb = this.calculateNoiseFloorFromRMS(roomToneRMS);
  const variance = this.calculateVariance(roomToneRMS.map(r => 20 * Math.log10(r)));

  return {
    levelDb: roomToneDb,
    variance: variance,
    sampleCount: roomToneRMS.length,
    description: 'Environmental noise in silence'
  };
}

/**
 * Analyzes noise during speech (breath/mouth sounds).
 */
analyzeSpeechNoise(channelData, speechSegments, sampleRate) {
  const speechNoiseRMS = [];
  const windowSize = 2205; // 50ms at 44.1kHz

  for (const speech of speechSegments) {
    const startSample = Math.floor(speech.startTime * sampleRate);
    const endSample = Math.floor(speech.endTime * sampleRate);

    // Sample windows throughout speech segment
    for (let i = startSample; i < endSample - windowSize; i += windowSize) {
      for (let ch = 0; ch < channelData.length; ch++) {
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

  // Get quietest 10% from speech (likely breaths/mouth noise)
  speechNoiseRMS.sort((a, b) => a - b);
  const cutoff = Math.floor(speechNoiseRMS.length * 0.1);
  const quietest = speechNoiseRMS.slice(0, cutoff);

  const speechNoiseDb = this.calculateNoiseFloorFromRMS(quietest);

  return {
    levelDb: speechNoiseDb,
    sampleCount: quietest.length,
    description: 'Breath and mouth sounds during speech'
  };
}

/**
 * Detects processing artifacts (denoisers, gates) using voice-specific methods.
 */
detectProcessingArtifacts(channelData, silenceSegments, speechSegments, roomTone, sampleRate) {
  // DETECTION 1: Digital Silence Ratio
  // Natural recordings have room tone, not perfect digital silence
  const digitalSilenceCount = silenceSegments.filter(s => {
    // Check if segment is truly digital silence (all zeros)
    const startSample = Math.floor(s.startTime * sampleRate);
    const endSample = Math.floor(s.endTime * sampleRate);

    let maxSample = 0;
    for (let ch = 0; ch < channelData.length; ch++) {
      for (let i = startSample; i < Math.min(endSample, startSample + 1000); i++) {
        maxSample = Math.max(maxSample, Math.abs(channelData[ch][i]));
      }
    }

    return maxSample === 0; // Perfect digital silence
  }).length;

  const digitalSilenceRatio = silenceSegments.length > 0
    ? digitalSilenceCount / silenceSegments.length
    : 0;

  // DETECTION 2: Unnatural Edge Sharpness
  // Denoisers/gates create unnaturally abrupt transitions
  const edgeTransitions = this.analyzeEdgeTransitions(
    channelData,
    speechSegments,
    sampleRate
  );

  // DETECTION 3: Room Tone Consistency
  // Natural room tone varies slightly; denoised is unnaturally consistent
  const unnaturalConsistency = roomTone.variance < 0.5 && roomTone.levelDb < -70;

  // INTERPRETATION
  const noiseGateDetected = digitalSilenceRatio > 0.7;
  const denoiserDetected = unnaturalConsistency || edgeTransitions.sharpRatio > 0.6;
  const aggressiveProcessing = noiseGateDetected && denoiserDetected;

  return {
    digitalSilenceRatio,
    edgeSharpness: edgeTransitions.sharpRatio,
    roomToneVariance: roomTone.variance,
    noiseGateDetected,
    denoiserDetected,
    aggressiveProcessing,
    confidence: this.calculateArtifactConfidence(digitalSilenceRatio, edgeTransitions.sharpRatio, roomTone.variance)
  };
}

/**
 * Analyzes edge transitions between silence and speech.
 */
analyzeEdgeTransitions(channelData, speechSegments, sampleRate) {
  const transitions = [];
  const checkWindowMs = 10; // Check 10ms before speech start
  const checkSamples = Math.floor(sampleRate * (checkWindowMs / 1000));

  for (const segment of speechSegments) {
    const speechStart = Math.floor(segment.startTime * sampleRate);

    if (speechStart < checkSamples) continue;

    // Measure level 10ms before speech starts
    let preLevelSum = 0;
    for (let ch = 0; ch < channelData.length; ch++) {
      for (let i = speechStart - checkSamples; i < speechStart; i++) {
        preLevelSum += Math.abs(channelData[ch][i]);
      }
    }
    const preLevel = preLevelSum / (checkSamples * channelData.length);

    // Measure rise time (how quickly it goes from silence to speech)
    const riseTimeSamples = this.measureRiseTime(channelData, speechStart, sampleRate);

    transitions.push({
      preLevel,
      riseTimeSamples,
      isSharp: riseTimeSamples < sampleRate * 0.005 && preLevel === 0 // <5ms rise from digital silence
    });
  }

  const sharpCount = transitions.filter(t => t.isSharp).length;
  const sharpRatio = transitions.length > 0 ? sharpCount / transitions.length : 0;

  return {
    totalTransitions: transitions.length,
    sharpTransitions: sharpCount,
    sharpRatio,
    avgRiseTimeMs: transitions.reduce((sum, t) => sum + (t.riseTimeSamples / sampleRate * 1000), 0) / transitions.length
  };
}

/**
 * Interprets advanced noise floor data.
 */
interpretNoiseFloorAdvanced(roomTone, speechNoise, artifacts) {
  const breathExcess = speechNoise.levelDb - roomTone.levelDb;

  // Diagnose issues
  const issues = [];
  const recommendations = [];

  // Issue 1: Excessive breath sounds
  if (breathExcess > 15) {
    issues.push('excessive_breath_sounds');
    recommendations.push('Mic may be too close - breaths are very audible');
    recommendations.push('Turn head slightly when breathing');
  } else if (breathExcess > 10) {
    issues.push('noticeable_breath_sounds');
    recommendations.push('Consider increasing mic distance slightly');
  }

  // Issue 2: Processing artifacts
  if (artifacts.aggressiveProcessing) {
    issues.push('aggressive_processing');
    recommendations.push('⚠️ Audio appears heavily processed (denoiser + gate detected)');
    recommendations.push('Client requires unprocessed audio - may need re-recording');
  } else if (artifacts.denoiserDetected) {
    issues.push('possible_denoiser');
    recommendations.push('⚠️ Noise characteristics suggest possible denoiser use');
    recommendations.push('Verify audio is unprocessed');
  } else if (artifacts.noiseGateDetected) {
    issues.push('noise_gate_detected');
    recommendations.push('Noise gate detected - ensure this is acceptable for submission');
  }

  // Issue 3: Noisy environment
  if (roomTone.levelDb > -50 && breathExcess < 10) {
    issues.push('noisy_environment');
    recommendations.push('Room tone is high - consider acoustic treatment');
  }

  // Determine overall severity
  let severity;
  if (artifacts.aggressiveProcessing) {
    severity = 'critical';
  } else if (issues.length > 1) {
    severity = 'warning';
  } else if (issues.length === 1) {
    severity = 'info';
  } else {
    severity = 'good';
  }

  return {
    severity,
    issues,
    recommendations,
    breathExcess,
    diagnosis: this.generateDiagnosis(roomTone, speechNoise, artifacts)
  };
}

/**
 * Generates human-readable diagnosis.
 */
generateDiagnosis(roomTone, speechNoise, artifacts) {
  if (artifacts.aggressiveProcessing) {
    return 'Heavily processed audio (denoiser + gate)';
  }
  if (artifacts.denoiserDetected) {
    return 'Possible denoiser artifacts detected';
  }
  if (artifacts.noiseGateDetected) {
    return 'Noise gate processing detected';
  }

  const breathExcess = speechNoise.levelDb - roomTone.levelDb;

  if (roomTone.levelDb < -70 && breathExcess < 10) {
    return 'Excellent: Clean room, good technique';
  }
  if (roomTone.levelDb > -50 && breathExcess < 10) {
    return 'Noisy environment, but technique OK';
  }
  if (roomTone.levelDb < -70 && breathExcess > 15) {
    return 'Clean room, but mic too close';
  }
  return 'Both environment and technique need improvement';
}
```

### Return Data Structure

```typescript
interface AdvancedNoiseFloorAnalysis {
  // Room tone (environmental)
  roomTone: {
    levelDb: number;           // -72.3 dB
    variance: number;          // 1.2 dB (natural variance)
    sampleCount: number;
    description: string;
  };

  // Speech-adjacent noise (technique)
  speechNoise: {
    levelDb: number;           // -55.1 dB
    sampleCount: number;
    description: string;
  };

  // Processing artifacts
  artifacts: {
    digitalSilenceRatio: number;      // 0.15 (15% perfect silence)
    edgeSharpness: number;            // 0.2 (20% sharp transitions)
    roomToneVariance: number;         // 1.2 dB
    noiseGateDetected: boolean;
    denoiserDetected: boolean;
    aggressiveProcessing: boolean;
    confidence: number;               // 0-1 confidence in detection
  };

  // Analysis
  severity: 'good' | 'info' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  breathExcess: number;              // 17.2 dB difference
  diagnosis: string;
}
```

## Integration Points

### 1. Type Definitions

**File**: `packages/web/src/types/index.ts`

```typescript
export interface AdvancedNoiseFloorAnalysis {
  roomTone: {
    levelDb: number;
    variance: number;
    sampleCount: number;
    description: string;
  };
  speechNoise: {
    levelDb: number;
    sampleCount: number;
    description: string;
  };
  artifacts: {
    digitalSilenceRatio: number;
    edgeSharpness: number;
    roomToneVariance: number;
    noiseGateDetected: boolean;
    denoiserDetected: boolean;
    aggressiveProcessing: boolean;
    confidence: number;
  };
  severity: 'good' | 'info' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  breathExcess: number;
  diagnosis: string;
}

// Add to AudioResults
export interface AudioResults {
  // ... existing fields
  advancedNoiseFloor?: AdvancedNoiseFloorAnalysis;
}
```

### 2. LevelAnalyzer Integration

**Progress Allocation**: 87-92% (5% of total)

```javascript
// In analyzeAudioBuffer()
if (includeExperimental) {
  // ... previous analyses

  // Advanced Noise Floor (87-92%)
  if (progressCallback) {
    progressCallback('Analyzing noise characteristics...', 0.87);
  }

  const advancedNoiseFloor = await this.analyzeNoiseFloorAdvanced(
    channelData,
    channels,
    length,
    { silenceSegments, leadingSilence, trailingSilence },
    { /* speech segments from silence inversion */ },
    progressCallback
  );

  results.advancedNoiseFloor = advancedNoiseFloor;
}
```

### 3. UI Display

**File**: `packages/web/src/components/ResultsTable.svelte`

**Enhanced Noise Floor Tooltip**:

```javascript
function getNoiseFloorTooltip(result) {
  const nf = result.noiseFloorAnalysis;
  const adv = result.advancedNoiseFloor;

  let tooltip = `Noise Floor Analysis\n────────────────────\n`;
  tooltip += `Overall: ${nf.overall.toFixed(1)} dB\n`;

  if (adv) {
    tooltip += `\nAdvanced Analysis:\n`;
    tooltip += `Room Tone: ${adv.roomTone.levelDb.toFixed(1)} dB\n`;
    tooltip += `Speech Noise: ${adv.speechNoise.levelDb.toFixed(1)} dB\n`;
    tooltip += `Breath Excess: ${adv.breathExcess.toFixed(1)} dB\n`;

    if (adv.artifacts.aggressiveProcessing) {
      tooltip += `\n⚠️ CRITICAL: Heavy processing detected!\n`;
    } else if (adv.artifacts.denoiserDetected) {
      tooltip += `\n⚠️ WARNING: Possible denoiser detected\n`;
    } else if (adv.artifacts.noiseGateDetected) {
      tooltip += `\n⚠️ INFO: Noise gate detected\n`;
    }

    tooltip += `\nDiagnosis: ${adv.diagnosis}\n`;

    if (adv.recommendations.length > 0) {
      tooltip += `\nRecommendations:\n`;
      adv.recommendations.forEach(rec => {
        tooltip += `• ${rec}\n`;
      });
    }
  }

  return tooltip;
}
```

**Visual Indicator**:

```svelte
<td class="noise-floor-cell {getNoiseFloorClass(result)}">
  {result.noiseFloorAnalysis.overall.toFixed(1)} dB

  {#if result.advancedNoiseFloor?.artifacts.denoiserDetected}
    <span class="warning-badge" title="Processing detected">⚠️</span>
  {/if}
</td>
```

### 4. CSV Export

**New Columns**:

```javascript
const ADVANCED_NOISE_FLOOR_HEADERS = [
  'Room Tone (dB)',
  'Speech Noise (dB)',
  'Breath Excess (dB)',
  'Digital Silence Ratio',
  'Noise Gate Detected',
  'Denoiser Detected',
  'Processing Severity',
  'Noise Floor Diagnosis'
];

function extractAdvancedNoiseFloorData(result) {
  const adv = result.advancedNoiseFloor;
  if (!adv) {
    return ADVANCED_NOISE_FLOOR_HEADERS.map(() => 'N/A');
  }

  return [
    formatNumber(adv.roomTone.levelDb),
    formatNumber(adv.speechNoise.levelDb),
    formatNumber(adv.breathExcess),
    formatNumber(adv.artifacts.digitalSilenceRatio * 100, 1) + '%',
    adv.artifacts.noiseGateDetected ? 'Yes' : 'No',
    adv.artifacts.denoiserDetected ? 'Yes' : 'No',
    adv.severity,
    adv.diagnosis
  ];
}
```

**Failure Analysis**:

```javascript
// In analyzeFailuresWithRecommendations()
if (result.advancedNoiseFloor?.artifacts.aggressiveProcessing) {
  qualityIssues.push({
    type: 'processing-artifacts',
    severity: 'critical',
    message: 'Heavy processing detected (denoiser + noise gate)',
    recommendation: 'Client requires unprocessed audio. This file may need to be re-recorded without processing.'
  });
} else if (result.advancedNoiseFloor?.artifacts.denoiserDetected) {
  qualityIssues.push({
    type: 'denoiser-artifacts',
    severity: 'warning',
    message: 'Noise characteristics suggest possible denoiser use',
    recommendation: 'Verify that no denoising was applied. Natural noise floor variance is expected.'
  });
}
```

## Implementation Phases

### Phase 1: Core Algorithm (2 days)
- [ ] Implement room tone analysis
- [ ] Implement speech noise analysis
- [ ] Implement artifact detection (digital silence, edges, consistency)
- [ ] Add interpretation logic
- [ ] Unit tests with synthetic audio

### Phase 2: Integration (0.5 days)
- [ ] Add TypeScript interfaces
- [ ] Integrate into `analyzeAudioBuffer()`
- [ ] Test with real voice samples
- [ ] Tune detection thresholds

### Phase 3: UI & Export (0.5 days)
- [ ] Enhanced noise floor tooltip
- [ ] Warning badges for processing
- [ ] CSV export columns
- [ ] Failure analysis integration

### Phase 4: Testing & Refinement (1 day)
- [ ] Create test samples (clean, denoised, gated)
- [ ] Validate detection accuracy
- [ ] Fine-tune confidence thresholds
- [ ] Document detection methods

## Testing Strategy

### Test Audio Samples

**Location**: `packages/web/tests/fixtures/voice-quality/noise-floor/`

1. **clean-room-good-technique.wav**
   - Room tone: -70 dB, Speech noise: -70 dB
   - Expected: severity = 'good', no artifacts

2. **noisy-room-good-technique.wav**
   - Room tone: -50 dB, Speech noise: -50 dB
   - Expected: severity = 'info', issue = 'noisy_environment'

3. **clean-room-mic-too-close.wav**
   - Room tone: -70 dB, Speech noise: -50 dB (breath excess: 20 dB)
   - Expected: severity = 'warning', issue = 'excessive_breath_sounds'

4. **denoised-audio.wav**
   - Room tone variance: <0.5 dB, level: <-70 dB
   - Expected: denoiserDetected = true

5. **noise-gated-audio.wav**
   - Digital silence ratio: >70%
   - Sharp edge transitions
   - Expected: noiseGateDetected = true

6. **heavily-processed.wav**
   - Both denoiser and gate artifacts
   - Expected: aggressiveProcessing = true, severity = 'critical'

### Unit Tests

```javascript
describe('Advanced Noise Floor Analysis', () => {
  describe('Room Tone Separation', () => {
    it('should separate room tone from speech noise');
    it('should calculate breath excess correctly');
  });

  describe('Artifact Detection', () => {
    it('should detect digital silence (noise gate)');
    it('should detect sharp edge transitions');
    it('should detect unnatural room tone consistency');
    it('should combine artifacts into overall assessment');
  });

  describe('Diagnosis', () => {
    it('should diagnose clean room + good technique');
    it('should diagnose noisy environment');
    it('should diagnose mic too close');
    it('should flag aggressive processing as critical');
  });
});
```

## Success Criteria

- ✅ Accurately separates room tone from breath sounds
- ✅ Detects noise gate with >85% accuracy
- ✅ Detects denoiser artifacts with >75% accuracy (harder to detect)
- ✅ <10% false positive rate on clean recordings
- ✅ Provides actionable diagnostics
- ✅ Processing time <2% of total
- ✅ All tests pass

## Performance

**Processing Time**: 1-2% of total analysis
- Room tone analysis: Reuses silence segments (minimal)
- Speech noise analysis: Windowed RMS on speech (light)
- Artifact detection: Simple statistical checks (very light)
- **No FFT required** (major savings vs. original spectral analysis plan)

**Memory**: Minimal (statistics only, no large buffers)

## Advantages Over Original Plan

| Aspect | Original Plan | This Merged Plan |
|--------|--------------|------------------|
| Performance | +5-10% (FFT on all quiet windows) | +1-2% (simple statistics) |
| Voice Effectiveness | Medium (spectral flatness) | High (voice-specific methods) |
| Features | Denoiser detection only | Room tone + denoiser + diagnosis |
| Complexity | High (FFT implementation) | Low (statistical analysis) |
| False Positives | Higher (music-oriented) | Lower (voice-optimized) |
| Integration | Standalone | Combines with room tone separation |

## Detection Method Rationale

### Why Not FFT?

**Original plan** proposed spectral flatness via FFT:
- ❌ Computationally expensive
- ❌ Less effective on sparse voice spectrum
- ❌ Music-oriented approach

**This plan** uses voice-specific indicators:
- ✅ Digital silence ratio (natural voice has room tone)
- ✅ Edge sharpness (natural transitions are gradual)
- ✅ Room tone variance (natural noise fluctuates)
- ✅ Faster, more accurate for voice

### Detection Confidence

Different artifacts have different detection confidence:

| Artifact | Confidence | Method |
|----------|-----------|--------|
| Noise Gate | High (85%+) | Digital silence ratio + edge sharpness |
| Heavy Denoiser | Medium (75%+) | Room tone variance + consistency |
| Light Denoiser | Low (50-60%) | Harder to distinguish from good recording |

## Future Enhancements

- Spectral analysis for high-confidence denoiser detection (optional, expensive)
- Machine learning model trained on denoised samples
- Comparative analysis (before/after samples)
- Integration with external tools (iZotope RX detection)

## References

- Natural room tone variance: 0.5-2 dB typical
- Digital silence threshold: Absolute zero amplitude
- Edge rise time (natural): 5-20ms typical for voice
- Noise gate indicators: >70% digital silence unusual for natural recording
