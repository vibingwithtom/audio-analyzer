# Sibilance Detection

**Priority**: Tier 1 - High Impact, Low Effort
**Estimated Effort**: 1-2 days
**Dependencies**: None

## Problem Statement

Sibilance refers to harsh, excessive "s", "sh", "ch", "z" sounds in voice recordings. This is one of the most common voice quality complaints and occurs due to:

- **Mic positioning**: Off-axis placement naturally reduces sibilance
- **Mic type**: Bright condensers emphasize sibilance more than dynamic mics
- **Speaker characteristics**: Some voices are naturally more sibilant
- **Recording technique**: Close-miking without pop filter increases sibilance

Excessive sibilance causes listener fatigue and sounds unprofessional. It's easily fixed with a de-esser but must first be detected.

## Solution Overview

Analyze the high-frequency energy content (4-10 kHz) relative to overall speech energy. Sibilant sounds concentrate energy in this frequency range, while normal speech has most energy in 200-3000 Hz.

### Algorithm Approach

```javascript
1. Extract speech segments (exclude silence)
2. Calculate RMS energy in sibilance band (4-10 kHz)
3. Calculate RMS energy in speech band (200-3000 Hz)
4. Compute sibilance-to-speech ratio (dB)
5. Detect individual sibilance events
6. Classify severity and provide recommendations
```

## Technical Specification

### Core Algorithm

**Location**: `packages/core/level-analyzer.js`

**New Method**: `analyzeSibilance()`

```javascript
/**
 * Analyzes sibilance in voice recordings.
 * Detects harsh high-frequency "s", "sh", "ch" sounds.
 *
 * @param {AudioBuffer} audioBuffer The audio buffer to analyze
 * @param {object} silenceData Silence segment data for speech isolation
 * @param {function} progressCallback Optional progress callback
 * @returns {object} Sibilance analysis results
 */
async analyzeSibilance(audioBuffer, silenceData, progressCallback = null) {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  // Constants
  const SIBILANCE_BAND_LOW = 4000;   // 4 kHz
  const SIBILANCE_BAND_HIGH = 10000; // 10 kHz
  const SPEECH_BAND_LOW = 200;       // 200 Hz
  const SPEECH_BAND_HIGH = 3000;     // 3 kHz
  const MIN_EVENT_DURATION = 0.05;   // 50ms minimum
  const MAX_EVENT_DURATION = 0.3;    // 300ms maximum
  const EVENT_THRESHOLD_DB = -20;    // dB above noise floor in HF band

  // Step 1: Apply bandpass filters to isolate frequency bands
  const sibilanceChannels = [];
  const speechChannels = [];

  for (let ch = 0; ch < channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);

    // Filter to sibilance range (4-10 kHz)
    const sibilanceFiltered = this.applyBandpassFilter(
      channelData,
      SIBILANCE_BAND_LOW,
      SIBILANCE_BAND_HIGH,
      sampleRate
    );
    sibilanceChannels.push(sibilanceFiltered);

    // Filter to speech range (200-3000 Hz)
    const speechFiltered = this.applyBandpassFilter(
      channelData,
      SPEECH_BAND_LOW,
      SPEECH_BAND_HIGH,
      sampleRate
    );
    speechChannels.push(speechFiltered);
  }

  // Step 2: Calculate energy in each band (speech segments only)
  const speechSegments = this.extractSpeechSegments(silenceData);
  let totalSibilanceEnergy = 0;
  let totalSpeechEnergy = 0;
  let sampleCount = 0;

  for (const segment of speechSegments) {
    const startSample = Math.floor(segment.startTime * sampleRate);
    const endSample = Math.floor(segment.endTime * sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      for (let i = startSample; i < endSample; i++) {
        totalSibilanceEnergy += sibilanceChannels[ch][i] ** 2;
        totalSpeechEnergy += speechChannels[ch][i] ** 2;
        sampleCount++;
      }
    }
  }

  // Step 3: Calculate RMS and ratio
  const sibilanceRMS = Math.sqrt(totalSibilanceEnergy / sampleCount);
  const speechRMS = Math.sqrt(totalSpeechEnergy / sampleCount);

  const sibilanceDb = 20 * Math.log10(sibilanceRMS);
  const speechDb = 20 * Math.log10(speechRMS);
  const sibilanceRatio = sibilanceDb - speechDb; // dB difference

  // Step 4: Detect individual sibilance events
  const events = this.detectSibilanceEvents(
    sibilanceChannels,
    sampleRate,
    EVENT_THRESHOLD_DB,
    MIN_EVENT_DURATION,
    MAX_EVENT_DURATION
  );

  // Step 5: Classify severity
  let severity;
  if (sibilanceRatio > -10) {
    severity = 'critical'; // Very harsh
  } else if (sibilanceRatio > -15) {
    severity = 'warning';  // Noticeable
  } else {
    severity = 'good';     // Acceptable
  }

  // Step 6: Generate recommendations
  const recommendations = [];
  if (severity === 'critical') {
    recommendations.push('Apply de-esser with 4-8 kHz focus');
    recommendations.push('Consider re-recording with off-axis mic placement');
  } else if (severity === 'warning') {
    recommendations.push('Apply gentle de-esser to reduce sibilance');
  }

  return {
    severity,
    sibilanceRatioDb: sibilanceRatio,
    sibilanceRMS: sibilanceDb,
    speechRMS: speechDb,
    eventCount: events.length,
    eventsPerMinute: (events.length / (length / sampleRate)) * 60,
    worstEvents: events.slice(0, 10), // Top 10 worst instances
    recommendations,
    perChannelAnalysis: this.analyzeSibilancePerChannel(
      sibilanceChannels,
      speechChannels,
      sampleRate
    )
  };
}
```

### Helper Methods

```javascript
/**
 * Applies a bandpass filter to isolate a frequency range.
 * Uses biquad filter cascade for sharp rolloff.
 */
applyBandpassFilter(audioData, lowFreq, highFreq, sampleRate) {
  // Implementation: Butterworth or Chebyshev bandpass filter
  // Order: 4th order (24 dB/octave rolloff)
  // Return: Filtered Float32Array
}

/**
 * Detects individual sibilance events above threshold.
 */
detectSibilanceEvents(sibilanceChannels, sampleRate, threshold, minDuration, maxDuration) {
  // Implementation:
  // 1. Calculate RMS in 10ms windows
  // 2. Find windows above threshold
  // 3. Group consecutive windows into events
  // 4. Filter by duration (50-300ms)
  // 5. Sort by peak level
  // Return: Array of event objects with timestamp, duration, peak level
}

/**
 * Extracts speech segments from silence analysis.
 */
extractSpeechSegments(silenceData) {
  // Inverts silence segments to get speech regions
  // Returns: Array of { startTime, endTime, duration }
}
```

### Thresholds

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Sibilance Ratio | ≤ -15 dB | -15 to -10 dB | > -10 dB |
| Events/Minute | < 20 | 20-40 | > 40 |

### Return Data Structure

```typescript
interface SibilanceAnalysis {
  severity: 'good' | 'warning' | 'critical';
  sibilanceRatioDb: number;          // -15.2 (sibilance vs speech energy)
  sibilanceRMS: number;              // -42.3 dB (absolute sibilance level)
  speechRMS: number;                 // -27.1 dB (absolute speech level)
  eventCount: number;                // 45 (total sibilance events detected)
  eventsPerMinute: number;           // 22.5
  worstEvents: Array<{
    timestamp: number;               // 12.45 (seconds from start)
    duration: number;                // 0.15 (seconds)
    peakLevel: number;               // -38.2 dB
    channel: number;
  }>;
  recommendations: string[];
  perChannelAnalysis?: Array<{
    channel: number;
    channelName: string;
    sibilanceRatioDb: number;
    eventCount: number;
  }>;
}
```

## Integration Points

### 1. Type Definitions

**File**: `packages/web/src/types/index.ts`

```typescript
export interface SibilanceAnalysis {
  severity: 'good' | 'warning' | 'critical';
  sibilanceRatioDb: number;
  sibilanceRMS: number;
  speechRMS: number;
  eventCount: number;
  eventsPerMinute: number;
  worstEvents: Array<{
    timestamp: number;
    duration: number;
    peakLevel: number;
    channel: number;
  }>;
  recommendations: string[];
  perChannelAnalysis?: Array<{
    channel: number;
    channelName: string;
    sibilanceRatioDb: number;
    eventCount: number;
  }>;
}

// Add to AudioResults interface
export interface AudioResults {
  // ... existing fields
  sibilanceAnalysis?: SibilanceAnalysis;
}
```

### 2. LevelAnalyzer Integration

**File**: `packages/core/level-analyzer.js`

```javascript
// In analyzeAudioBuffer(), add after silence detection:
if (includeExperimental) {
  // ... existing experimental analyses

  // Sibilance Analysis (62-67% of progress)
  if (progressCallback) {
    progressCallback('Analyzing sibilance...', 0.62);
  }

  const sibilanceAnalysis = await this.analyzeSibilance(
    audioBuffer,
    { silenceSegments, leadingSilence, trailingSilence },
    progressCallback
  );

  results.sibilanceAnalysis = sibilanceAnalysis;
}
```

**Progress Allocation**: 62-67% (5% of total)

### 3. UI Display

**File**: `packages/web/src/components/ResultsTable.svelte`

**New Column**: "Sibilance"

```svelte
<!-- In experimental mode table -->
<th>Sibilance</th>

<!-- Cell rendering -->
<td
  class="sibilance-cell {getSibilanceClass(result.sibilanceAnalysis)}"
  title={getSibilanceTooltip(result)}
>
  {#if result.sibilanceAnalysis}
    <div class="primary-value">
      {result.sibilanceAnalysis.sibilanceRatioDb.toFixed(1)} dB
    </div>
    <div class="event-count">
      {result.sibilanceAnalysis.eventCount} events
    </div>
  {:else}
    <span class="na-value">N/A</span>
  {/if}
</td>
```

**Helper Functions**:

```javascript
function getSibilanceClass(analysis) {
  if (!analysis) return '';

  if (analysis.severity === 'critical') return 'error';
  if (analysis.severity === 'warning') return 'warning';
  return 'success';
}

function getSibilanceTooltip(result) {
  const sib = result.sibilanceAnalysis;
  if (!sib) return 'Sibilance analysis not available';

  let tooltip = `Sibilance Ratio: ${sib.sibilanceRatioDb.toFixed(1)} dB\n`;
  tooltip += `────────────────────\n`;
  tooltip += `Severity: ${sib.severity}\n`;
  tooltip += `Events: ${sib.eventCount} (${sib.eventsPerMinute.toFixed(1)}/min)\n`;
  tooltip += `Sibilance Energy: ${sib.sibilanceRMS.toFixed(1)} dB\n`;
  tooltip += `Speech Energy: ${sib.speechRMS.toFixed(1)} dB\n`;

  if (sib.worstEvents && sib.worstEvents.length > 0) {
    tooltip += `\nWorst Instances:\n`;
    sib.worstEvents.slice(0, 5).forEach((event, i) => {
      tooltip += `${i + 1}. ${event.timestamp.toFixed(1)}s (${event.duration.toFixed(2)}s, ${event.peakLevel.toFixed(1)} dB)\n`;
    });
  }

  if (sib.recommendations && sib.recommendations.length > 0) {
    tooltip += `\nRecommendations:\n`;
    sib.recommendations.forEach(rec => {
      tooltip += `• ${rec}\n`;
    });
  }

  return tooltip;
}
```

### 4. CSV Export

**File**: `packages/web/src/utils/export-utils.ts`

**New Columns** (Experimental Mode):

```javascript
const SIBILANCE_HEADERS = [
  'Sibilance Severity',
  'Sibilance Ratio (dB)',
  'Sibilance Events',
  'Events Per Minute',
  'Worst Event Time',
  'Worst Event Level (dB)'
];

// In extractEnhancedDataRow()
function extractSibilanceData(result) {
  const sib = result.sibilanceAnalysis;
  if (!sib) {
    return SIBILANCE_HEADERS.map(() => 'N/A');
  }

  const worstEvent = sib.worstEvents?.[0];

  return [
    sib.severity,
    formatNumber(sib.sibilanceRatioDb),
    sib.eventCount,
    formatNumber(sib.eventsPerMinute, 1),
    worstEvent?.timestamp?.toFixed(1) || 'N/A',
    worstEvent?.peakLevel?.toFixed(1) || 'N/A'
  ];
}
```

**Failure Analysis Integration**:

```javascript
// In analyzeFailuresWithRecommendations()
if (result.sibilanceAnalysis?.severity === 'critical') {
  qualityIssues.push({
    type: 'sibilance',
    severity: 'critical',
    message: `Harsh sibilance detected (${result.sibilanceAnalysis.sibilanceRatioDb.toFixed(1)} dB ratio)`,
    recommendation: 'Apply de-esser with 4-8 kHz focus or re-record with off-axis mic placement'
  });
} else if (result.sibilanceAnalysis?.severity === 'warning') {
  qualityIssues.push({
    type: 'sibilance',
    severity: 'warning',
    message: `Noticeable sibilance (${result.sibilanceAnalysis.sibilanceRatioDb.toFixed(1)} dB ratio)`,
    recommendation: 'Apply gentle de-esser to reduce harsh "s" sounds'
  });
}
```

## Implementation Phases

### Phase 1: Core Algorithm (Day 1)
- [ ] Implement `applyBandpassFilter()` helper
- [ ] Implement `analyzeSibilance()` main method
- [ ] Implement `detectSibilanceEvents()` helper
- [ ] Add unit tests for filter and detection
- [ ] Test with synthetic sibilant audio

### Phase 2: Integration (Day 1)
- [ ] Add TypeScript interfaces
- [ ] Integrate into `analyzeAudioBuffer()`
- [ ] Update progress allocation
- [ ] Test with real voice samples

### Phase 3: UI & Export (Day 2)
- [ ] Add ResultsTable column
- [ ] Implement helper functions (class, tooltip)
- [ ] Add CSV export columns
- [ ] Add failure analysis integration
- [ ] Test UI display with various results

### Phase 4: Testing & Refinement (Day 2)
- [ ] Create test audio samples
- [ ] Comprehensive unit tests
- [ ] Integration tests
- [ ] Threshold tuning with real samples
- [ ] Documentation and examples

## Testing Strategy

### Unit Tests

**File**: `packages/web/tests/unit/level-analyzer-sibilance.test.js`

```javascript
describe('LevelAnalyzer - Sibilance Detection', () => {
  describe('Bandpass Filter', () => {
    it('should isolate 4-10 kHz range for sibilance');
    it('should isolate 200-3000 Hz range for speech');
    it('should have >40 dB attenuation outside passband');
  });

  describe('Sibilance Ratio Calculation', () => {
    it('should detect harsh sibilance (>-10 dB ratio)');
    it('should detect normal sibilance (-15 to -10 dB ratio)');
    it('should pass well-balanced audio (<-15 dB ratio)');
  });

  describe('Event Detection', () => {
    it('should detect individual sibilant phonemes');
    it('should filter events by duration (50-300ms)');
    it('should sort events by peak level');
    it('should count events correctly');
  });

  describe('Edge Cases', () => {
    it('should handle all-silence audio');
    it('should handle de-essed audio (no events)');
    it('should handle mono and stereo files');
    it('should handle very short files (<1 second)');
  });
});
```

### Test Audio Samples

**Location**: `packages/web/tests/fixtures/voice-quality/sibilance/`

1. **excessive-sibilance.wav**
   - Bright condenser mic, on-axis
   - Expected: >-10 dB ratio, critical severity
   - Expected: >30 events/minute

2. **normal-sibilance.wav**
   - Standard recording, no processing
   - Expected: -15 to -12 dB ratio, warning severity
   - Expected: 15-25 events/minute

3. **de-essed.wav**
   - Processed with de-esser
   - Expected: <-15 dB ratio, good severity
   - Expected: <15 events/minute

4. **female-voice-bright.wav**
   - Female voice (naturally more HF content)
   - Test gender-specific characteristics

5. **male-voice-deep.wav**
   - Male voice (less HF content)
   - Should have lower ratio naturally

## Success Criteria

- ✅ Accurately detects harsh sibilance (>90% accuracy on test samples)
- ✅ Correctly identifies de-essed audio as "good"
- ✅ Provides actionable recommendations
- ✅ Processing time impact <3% of total analysis
- ✅ Works with mono and stereo files
- ✅ Handles edge cases without errors
- ✅ All unit tests pass
- ✅ UI displays clearly with helpful tooltips
- ✅ CSV export includes all relevant metrics

## Performance Considerations

### Optimization Opportunities

1. **Filter Efficiency**: Use biquad IIR filters instead of FFT-based filtering for better performance
2. **Memory**: Process channels sequentially to reduce memory footprint
3. **Caching**: Reuse filtered data if multiple analyses need same frequency band
4. **Early Exit**: Skip sibilance analysis for files flagged as all-silence

### Expected Performance

- **Processing Time**: ~2-4% of total analysis time
- **Memory**: Minimal (2x audio buffer for filtered channels)
- **Progress Updates**: Every 1000 windows (~1 second of audio)

## Future Enhancements

- **Frequency-specific analysis**: Separate "s" (6-8 kHz) from "sh" (4-6 kHz)
- **Phoneme detection**: Use machine learning to identify specific sibilant phonemes
- **De-esser suggestions**: Recommend specific threshold/ratio/frequency settings
- **Spectral visualization**: Show sibilance events on spectrogram
- **Comparison mode**: Compare before/after de-essing

## References

- **EBU R128**: Loudness normalization standard
- **ITU-R BS.1770**: Algorithms to measure audio loudness
- **Sibilance frequency range**: 4-10 kHz (industry standard)
- **Acceptable ratio**: <-15 dB (based on professional voice recording standards)
