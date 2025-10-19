# Feature #10: Processing Detection (Compliance)

## Overview

Detects if audio has been processed with compression, AGC, limiting, de-noising, or other plugins to validate **"no processing allowed"** client requirements. Provides binary compliance validation (processed vs unprocessed) with conservative thresholds to minimize false positives.

## Problem Statement

### Client Requirement
**"No processing allowed (including de-noisers or other plugins)"**

### Detection Needs
- Compression/multiband compression
- Auto-Gain Control (AGC)
- Limiters (hard and soft)
- De-noisers
- Noise gates
- Expanders/dynamics processors

### Key Challenges
- Natural speech dynamics vary widely (4-20 dB range)
- Must distinguish processing from natural emphasis/expression
- False positives are unacceptable (rejecting clean audio)
- Some artifacts already detected by other features

## Technical Approach

### Core Strategy

**Binary Compliance Validation**: Focus on detecting **obvious** processing only, with high confidence.

```javascript
processingDetection = {
  processed: boolean,              // TRUE = processing detected
  confidence: 'high' | 'medium',   // Detection confidence
  severity: 'good' | 'critical',   // good = clean, critical = processed
  indicators: {
    compression: boolean,          // Dynamic range compression
    agc: boolean,                  // Auto-Gain Control
    limiting: boolean,             // Hard/soft limiting
    denoising: boolean,            // De-noiser artifacts
    gating: boolean               // Noise gate artifacts
  },
  details: {
    dynamicRange: number,          // Speech dynamic range (dB)
    spectralFlatness: number,      // Spectral consistency (0-1)
    agcPumping: number,           // AGC pumping instances
    // ... aggregated from other features
  }
}
```

### Detection Methods

#### 1. Compression Detection

**Algorithm**: Simple speech dynamic range calculation

```javascript
// Extract speech segments (reuse from silence detection)
const speechSegments = extractSpeechSegments(existingAnalysis.silence);

// Calculate RMS for each 500ms window in speech
const windowRMS = [];
for (const segment of speechSegments) {
  const windows = createWindows(segment, 500ms);
  for (const window of windows) {
    windowRMS.push(calculateRMS(window));
  }
}

// Convert to dB
const rmsDb = windowRMS.map(rms => 20 * Math.log10(rms));

// Calculate dynamic range (P90 - P10)
const p90 = percentile(rmsDb, 90);
const p10 = percentile(rmsDb, 10);
const dynamicRange = p90 - p10;

// Detection threshold: <5 dB = obviously compressed
const compressionDetected = dynamicRange < 5;
```

**Rationale**:
- Natural speech: 8-20 dB dynamic range
- Lightly compressed: 6-10 dB
- Heavily compressed: <6 dB
- **Threshold**: <5 dB (only catches obvious compression)

#### 2. AGC (Auto-Gain Control) Detection

**Algorithm**: Detect pumping patterns between speech segments

```javascript
// Analyze RMS changes between speech segments
const segmentLevels = [];
for (const segment of speechSegments) {
  const rms = calculateSegmentRMS(segment);
  segmentLevels.push({ rms, timestamp: segment.startTime });
}

// Look for unnatural gain changes
let pumpingInstances = 0;
for (let i = 1; i < segmentLevels.length; i++) {
  const prev = segmentLevels[i - 1];
  const curr = segmentLevels[i];

  const levelChange = Math.abs(20 * Math.log10(curr.rms / prev.rms));
  const timeDelta = curr.timestamp - prev.timestamp;

  // AGC pumping: significant level changes between quiet segments
  // (natural speech doesn't have uniform level across all phrases)
  if (levelChange > 8 && timeDelta < 1.0 && prev.rms < -20) {
    pumpingInstances++;
  }
}

const agcDetected = pumpingInstances > 3;
```

**Rationale**:
- AGC tries to maintain constant output level
- Creates unnatural "pumping" when gain rapidly adjusts
- Natural speech has consistent levels *within* phrases, not *between* them

#### 3. Spectral Flatness Detection

**Algorithm**: Detect unnaturally consistent spectral characteristics

```javascript
// Analyze frequency balance across speech segments
const spectralProfiles = [];
for (const segment of speechSegments) {
  const low = calculateBandRMS(segment, 80, 250);
  const mid = calculateBandRMS(segment, 250, 2000);
  const high = calculateBandRMS(segment, 2000, 8000);

  spectralProfiles.push({ low, mid, high });
}

// Calculate variance of spectral balance
const lowVariance = variance(spectralProfiles.map(p => p.low));
const midVariance = variance(spectralProfiles.map(p => p.mid));
const highVariance = variance(spectralProfiles.map(p => p.high));

const avgVariance = (lowVariance + midVariance + highVariance) / 3;

// Multiband compression makes spectral balance unnaturally consistent
const overProcessed = avgVariance < 0.12;
```

**Rationale**:
- Natural speech: spectral balance varies with phonemes
- Multiband compression: flattens spectral variation
- Threshold: <0.12 variance indicates obvious processing

#### 4. Aggregate Existing Detections

**Reuse from other features**:
```javascript
// From existing clipping analysis
const limiting = existingAnalysis.clipping.sustainedRegions > 0;

// From #09 Advanced Noise Floor
const denoising = existingAnalysis.noiseFloor.denoiserDetected === true;
const gating = existingAnalysis.noiseFloor.gateDetected === true;
```

## Implementation Details

### Phase 1: Core Analysis (LevelAnalyzer.js)

**New Method**: `analyzeProcessing()`

```javascript
async analyzeProcessing(
  channelData,
  channels,
  length,
  sampleRate,
  existingAnalysis,
  progressCallback,
  shouldCancel
) {
  // Progress allocation: 85-90% (5% of total)
  const progressStart = 0.85;
  const progressEnd = 0.90;

  // Step 1: Extract speech segments (reuse)
  const speechSegments = this.extractSpeechSegments(
    existingAnalysis.silence,
    existingAnalysis.noiseFloor
  );

  if (speechSegments.length === 0) {
    return {
      processed: false,
      confidence: 'high',
      severity: 'good',
      note: 'No speech detected for analysis'
    };
  }

  // Step 2: Calculate dynamic range
  const dynamicRange = this.calculateSpeechDynamicRange(
    channelData,
    speechSegments,
    sampleRate
  );

  reportProgress(progressCallback, 0.86);
  if (shouldCancel?.()) return null;

  // Step 3: Detect AGC pumping
  const agcPumping = this.detectAGCPattern(
    channelData,
    speechSegments,
    sampleRate
  );

  reportProgress(progressCallback, 0.88);
  if (shouldCancel?.()) return null;

  // Step 4: Spectral flatness
  const spectralFlatness = this.calculateSpectralConsistency(
    channelData,
    speechSegments,
    sampleRate
  );

  // Step 5: Aggregate existing detections
  const limiting = existingAnalysis.clipping?.sustainedRegions?.length > 0;
  const denoising = existingAnalysis.noiseFloor?.denoiserDetected === true;
  const gating = existingAnalysis.noiseFloor?.gateDetected === true;

  // Step 6: Determine processing status
  const indicators = {
    compression: dynamicRange < 5,
    agc: agcPumping.detected,
    limiting: limiting,
    denoising: denoising,
    gating: gating,
    spectralFlatness: spectralFlatness < 0.12
  };

  const processed = Object.values(indicators).some(v => v === true);
  const confidence = this.determineConfidence(indicators, dynamicRange);

  reportProgress(progressCallback, 0.90);

  return {
    processed: processed,
    confidence: confidence,
    severity: processed ? 'critical' : 'good',
    indicators: indicators,
    details: {
      dynamicRange: dynamicRange,
      spectralFlatness: spectralFlatness,
      agcPumpingInstances: agcPumping.instances,
      limitingRegions: existingAnalysis.clipping?.sustainedRegions?.length || 0,
      denoiserArtifacts: existingAnalysis.noiseFloor?.denoiserArtifacts?.length || 0
    },
    recommendations: this.generateProcessingRecommendations(indicators)
  };
}
```

### Helper Methods

```javascript
calculateSpeechDynamicRange(channelData, speechSegments, sampleRate) {
  const windowSize = Math.floor(sampleRate * 0.5); // 500ms
  const windowRMS = [];

  for (const segment of speechSegments) {
    const start = Math.floor(segment.startTime * sampleRate);
    const end = Math.floor(segment.endTime * sampleRate);

    for (let i = start; i < end; i += windowSize) {
      const windowEnd = Math.min(i + windowSize, end);
      let sumSquares = 0;
      let samples = 0;

      for (let ch = 0; ch < channelData.length; ch++) {
        for (let j = i; j < windowEnd; j++) {
          sumSquares += channelData[ch][j] ** 2;
          samples++;
        }
      }

      if (samples > 0) {
        const rms = Math.sqrt(sumSquares / samples);
        if (rms > 0) {
          windowRMS.push(20 * Math.log10(rms));
        }
      }
    }
  }

  if (windowRMS.length === 0) return 0;

  // Calculate P90 - P10
  const sorted = windowRMS.sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];

  return p90 - p10;
}

detectAGCPattern(channelData, speechSegments, sampleRate) {
  const segmentLevels = [];

  for (const segment of speechSegments) {
    const start = Math.floor(segment.startTime * sampleRate);
    const end = Math.floor(segment.endTime * sampleRate);

    let sumSquares = 0;
    let samples = 0;

    for (let ch = 0; ch < channelData.length; ch++) {
      for (let i = start; i < end; i++) {
        sumSquares += channelData[ch][i] ** 2;
        samples++;
      }
    }

    const rms = Math.sqrt(sumSquares / samples);
    segmentLevels.push({
      rms: rms,
      rmsDb: 20 * Math.log10(rms),
      timestamp: segment.startTime
    });
  }

  // Detect unnatural level changes
  let pumpingInstances = 0;
  const pumpingEvents = [];

  for (let i = 1; i < segmentLevels.length; i++) {
    const prev = segmentLevels[i - 1];
    const curr = segmentLevels[i];

    const levelChange = Math.abs(curr.rmsDb - prev.rmsDb);
    const timeDelta = curr.timestamp - prev.timestamp;

    // AGC pumping: large level changes between quiet segments
    if (levelChange > 8 && timeDelta < 1.0 && prev.rmsDb < -20) {
      pumpingInstances++;
      pumpingEvents.push({
        timestamp: prev.timestamp,
        levelChange: levelChange
      });
    }
  }

  return {
    detected: pumpingInstances > 3,
    instances: pumpingInstances,
    events: pumpingEvents.slice(0, 5) // Top 5 worst
  };
}

calculateSpectralConsistency(channelData, speechSegments, sampleRate) {
  const spectralProfiles = [];

  for (const segment of speechSegments) {
    const low = this.calculateBandRMS(
      channelData, segment, sampleRate, 80, 250
    );
    const mid = this.calculateBandRMS(
      channelData, segment, sampleRate, 250, 2000
    );
    const high = this.calculateBandRMS(
      channelData, segment, sampleRate, 2000, 8000
    );

    spectralProfiles.push({ low, mid, high });
  }

  // Calculate variance across segments
  const lowValues = spectralProfiles.map(p => p.low);
  const midValues = spectralProfiles.map(p => p.mid);
  const highValues = spectralProfiles.map(p => p.high);

  const lowVar = this.variance(lowValues);
  const midVar = this.variance(midValues);
  const highVar = this.variance(highValues);

  return (lowVar + midVar + highVar) / 3;
}

determineConfidence(indicators, dynamicRange) {
  // High confidence: multiple indicators OR extreme values
  const indicatorCount = Object.values(indicators).filter(v => v).length;

  if (indicatorCount >= 2) return 'high';
  if (dynamicRange < 3) return 'high'; // Extremely compressed
  if (indicators.denoising || indicators.limiting) return 'high';

  return 'medium';
}

generateProcessingRecommendations(indicators) {
  const recommendations = [];

  if (indicators.compression) {
    recommendations.push('Compression detected - dynamic range is unnaturally flat');
    recommendations.push('Re-record without compression or dynamics processing');
  }

  if (indicators.agc) {
    recommendations.push('Auto-Gain Control (AGC) detected - disable AGC on recording device');
  }

  if (indicators.limiting) {
    recommendations.push('Hard limiting detected - reduce input gain to prevent clipping');
  }

  if (indicators.denoising) {
    recommendations.push('De-noising artifacts detected - record in quieter environment instead');
  }

  if (indicators.gating) {
    recommendations.push('Noise gate artifacts detected - disable noise gate plugin');
  }

  if (indicators.spectralFlatness) {
    recommendations.push('Spectral processing detected - multiband compression or EQ may be applied');
  }

  if (recommendations.length === 0) {
    recommendations.push('No processing detected - audio appears clean');
  }

  return recommendations;
}
```

## Type Definitions

**Location**: `packages/web/src/types/index.ts`

```typescript
export interface ProcessingDetection {
  processed: boolean;
  confidence: 'high' | 'medium';
  severity: 'good' | 'critical';
  indicators: {
    compression: boolean;
    agc: boolean;
    limiting: boolean;
    denoising: boolean;
    gating: boolean;
    spectralFlatness: boolean;
  };
  details: {
    dynamicRange: number;
    spectralFlatness: number;
    agcPumpingInstances: number;
    limitingRegions: number;
    denoiserArtifacts: number;
  };
  recommendations: string[];
  note?: string;
}

// Update AudioResults interface
export interface AudioResults {
  // ... existing fields ...
  processing?: ProcessingDetection;
}
```

## UI Display

**Location**: `packages/web/src/components/ResultsTable.svelte`

**New Column**: "Processing"

```javascript
function getProcessingClass(processing) {
  if (!processing) return '';
  return processing.processed ? 'error' : 'success';
}

function getProcessingTooltip(result) {
  const p = result.processing;
  if (!p) return 'Processing detection not available';

  if (!p.processed) {
    return 'No processing detected\n✅ Clean audio';
  }

  let tooltip = `Processing Detected (${p.confidence} confidence)\n`;
  tooltip += `────────────────────\n`;

  if (p.indicators.compression) {
    tooltip += `⚠️ Compression (${p.details.dynamicRange.toFixed(1)} dB dynamic range)\n`;
  }
  if (p.indicators.agc) {
    tooltip += `⚠️ Auto-Gain Control (${p.details.agcPumpingInstances} instances)\n`;
  }
  if (p.indicators.limiting) {
    tooltip += `⚠️ Hard Limiting (${p.details.limitingRegions} regions)\n`;
  }
  if (p.indicators.denoising) {
    tooltip += `⚠️ De-noising artifacts\n`;
  }
  if (p.indicators.gating) {
    tooltip += `⚠️ Noise gate artifacts\n`;
  }
  if (p.indicators.spectralFlatness) {
    tooltip += `⚠️ Spectral processing\n`;
  }

  tooltip += `\nRecommendations:\n`;
  p.recommendations.slice(0, 3).forEach(rec => {
    tooltip += `• ${rec}\n`;
  });

  return tooltip;
}
```

**Display**:
```svelte
<td
  class="processing-cell {getProcessingClass(result.processing)}"
  title={getProcessingTooltip(result)}
>
  {#if result.processing}
    {#if result.processing.processed}
      <div class="status-icon">❌</div>
      <div class="status-text">Detected</div>
      <div class="confidence-badge">{result.processing.confidence}</div>
    {:else}
      <div class="status-icon">✅</div>
      <div class="status-text">Clean</div>
    {/if}
  {:else}
    <span class="na-value">N/A</span>
  {/if}
</td>
```

## CSV Export

**Location**: `packages/web/src/utils/export-utils.ts`

**New Columns** (Experimental Mode):
```javascript
const PROCESSING_HEADERS = [
  'Processing Detected',
  'Confidence',
  'Dynamic Range (dB)',
  'Compression',
  'AGC',
  'Limiting',
  'De-noising',
  'Gating',
  'Spectral Processing'
];

function extractProcessingData(result) {
  const p = result.processing;
  if (!p) {
    return PROCESSING_HEADERS.map(() => 'N/A');
  }

  return [
    p.processed ? 'Yes' : 'No',
    p.confidence,
    formatNumber(p.details.dynamicRange),
    p.indicators.compression ? 'Yes' : 'No',
    p.indicators.agc ? 'Yes' : 'No',
    p.indicators.limiting ? 'Yes' : 'No',
    p.indicators.denoising ? 'Yes' : 'No',
    p.indicators.gating ? 'Yes' : 'No',
    p.indicators.spectralFlatness ? 'Yes' : 'No'
  ];
}
```

## Performance Impact

**Estimated Processing Time**: +2-3% of total analysis

**Breakdown**:
- Dynamic range calculation: 1-1.5%
- AGC detection: 0.5%
- Spectral flatness: 0.5-1%
- Aggregation: <0.1%

**For 5-minute stereo file** (~2.5s current):
- Added time: ~50-75ms
- New total: ~2.55-2.58s

**Optimization**: Reuses speech segments from silence detection (no additional audio scanning)

## Progress Stage Allocation

**Allocation**: 85-90% (5% of total experimental analysis)

**Updated Progress**:
```
40-50%  Reverb Analysis (10%)
50-55%  Voice-Focused Reverb [optional] (5%)
55-62%  Silence Detection (7%)
62-67%  Sibilance Detection (5%)
67-72%  Frequency Balance (5%)
72-77%  Plosive Energy (5%)
77-82%  Mouth Noise (5%)
82-85%  Breath Sounds (3%)
85-90%  Processing Detection (5%)  ← NEW
90-95%  Advanced Noise Floor Analysis (5%)
95-100% Clipping Analysis + Plosive Enhancement (5%)
```

## Testing Strategy

### Unit Tests

**File**: `packages/web/tests/unit/level-analyzer-processing.test.js`

```javascript
describe('LevelAnalyzer - Processing Detection', () => {
  describe('Compression Detection', () => {
    it('should detect heavy compression (< 5 dB DR)');
    it('should not flag natural speech (10-15 dB DR)');
    it('should handle edge case: whispered audio (naturally low DR)');
  });

  describe('AGC Detection', () => {
    it('should detect AGC pumping patterns');
    it('should not flag natural emphasis changes');
  });

  describe('Spectral Flatness', () => {
    it('should detect multiband compression');
    it('should not flag natural spectral variation');
  });

  describe('Integration', () => {
    it('should aggregate limiting from clipping analysis');
    it('should aggregate de-noising from noise floor analysis');
    it('should handle files with no speech segments');
  });

  describe('Confidence Levels', () => {
    it('should return high confidence with multiple indicators');
    it('should return high confidence with extreme compression');
    it('should return medium confidence with single indicator');
  });
});
```

### Test Audio Samples

Create in `packages/web/tests/fixtures/processing/`:

1. **clean-voice.wav** - No processing, 12-18 dB DR
2. **compressed-voice.wav** - Heavy compression, <5 dB DR
3. **agc-voice.wav** - AGC pumping artifacts
4. **limited-voice.wav** - Hard limiting (from clipping analysis)
5. **denoised-voice.wav** - De-noiser artifacts (from #09)
6. **multiband-compressed.wav** - Flat spectral characteristics
7. **natural-quiet.wav** - Naturally quiet speaker (6-8 dB DR, should NOT trigger)

## Success Criteria

- ✅ **Accuracy**: Detects obvious processing with high confidence
- ✅ **Low False Positives**: Does not flag natural speech variation
- ✅ **Performance**: <3% processing time increase
- ✅ **Compliance**: Clear pass/fail for "no processing" requirement
- ✅ **Integration**: Aggregates existing detections properly
- ✅ **Testing**: >95% code coverage

## Threshold Calibration

**Conservative Thresholds** (minimize false positives):

| Detection | Threshold | Rationale |
|-----------|-----------|-----------|
| Compression | < 5 dB DR | Natural speech: 8-20 dB |
| AGC Pumping | > 3 instances | Occasional level changes are normal |
| Spectral Flatness | < 0.12 variance | Natural voice varies significantly |
| Limiting | > 0 sustained regions | Already detected by clipping analysis |
| De-noising | Aggregated from #09 | Already validated |

## Edge Cases

### Natural Low Dynamic Range
**Case**: Whispered speech, calm narration (6-8 dB DR)
**Handling**: Require multiple indicators OR <5 dB threshold

### Expressive Speech
**Case**: Shouting, dramatic reading (>20 dB DR)
**Handling**: No issue - only flags low DR

### Digital Silence Segments
**Case**: File with perfect digital silence between speech
**Handling**: Already detected by #09, aggregated here

## Future Enhancements

- Preset-specific thresholds (some presets allow light compression)
- Machine learning model for processing detection
- Spectral analysis optimization (cache filter outputs)
- Integration with cloud validation services

## Dependencies

**Requires**:
- Existing silence detection (reuses speech segments)
- #09 Advanced Noise Floor Analysis (de-noising, gating detection)
- Existing clipping analysis (limiting detection)

**Independent of**:
- All other voice quality features (#01-08)

## Implementation Effort

**Total**: 2-3 days

**Breakdown**:
- Core algorithm (dynamic range, AGC, spectral): 1 day
- UI + types + export: 0.5 days
- Testing + validation: 0.5-1 day
- Threshold calibration with real audio: 0.5 days

---

**Last Updated**: 2025-01-18
**Status**: Planned
**Priority**: Tier 1 (client compliance requirement)
