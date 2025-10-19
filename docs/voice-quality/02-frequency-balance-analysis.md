# Frequency Balance Analysis

**Priority**: Tier 1 - High Impact, Low Effort
**Estimated Effort**: 1-2 days
**Dependencies**: None

## Problem Statement

Voice recordings often suffer from frequency imbalances that affect clarity and professional quality:

- **Proximity Effect**: Too much bass when speaking close to cardioid microphones
- **Thin Sound**: Insufficient low frequencies, sounds weak or distant
- **Lacks Clarity**: Insufficient high frequencies, sounds muffled or dull
- **Boomy**: Excessive low-mid energy, sounds muddy

These issues are very common in voice recordings and easy to detect through frequency band analysis.

## Solution Overview

Analyze speech energy in three frequency bands (low, mid, high) and calculate their relative levels. Compare ratios against expected ranges for natural voice recordings.

### Frequency Bands for Voice

```
Low Band   (80-250 Hz):   Fundamental frequency, warmth, body
Mid Band   (250-2000 Hz): Core intelligibility, vowel formants
High Band  (2000-8000 Hz): Clarity, presence, consonant definition
```

### Algorithm Approach

```javascript
1. Extract speech segments (exclude silence)
2. Calculate RMS energy in each frequency band
3. Compute band ratios (low/mid, high/mid)
4. Identify frequency balance issues
5. Generate actionable recommendations
```

## Technical Specification

### Core Algorithm

**Location**: `packages/core/level-analyzer.js`

**New Method**: `analyzeFrequencyBalance()`

```javascript
/**
 * Analyzes frequency balance in voice recordings.
 * Detects proximity effect, thin sound, and clarity issues.
 *
 * @param {AudioBuffer} audioBuffer The audio buffer to analyze
 * @param {object} silenceData Silence segment data for speech isolation
 * @param {function} progressCallback Optional progress callback
 * @returns {object} Frequency balance analysis results
 */
async analyzeFrequencyBalance(audioBuffer, silenceData, progressCallback = null) {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  // Frequency band definitions (optimized for voice)
  const LOW_BAND = { low: 80, high: 250 };      // Bass/warmth
  const MID_BAND = { low: 250, high: 2000 };    // Core speech
  const HIGH_BAND = { low: 2000, high: 8000 };  // Clarity/presence

  // Thresholds for issues (dB)
  const ISSUES = {
    tooMuchBass: -3,      // Low within 3 dB of mids
    tooThin: -20,         // Low more than 20 dB below mids
    lacksClarity: -15,    // High more than 15 dB below mids
    tooBoomy: -1          // Low louder than mids
  };

  // Step 1: Apply bandpass filters
  const lowChannels = [];
  const midChannels = [];
  const highChannels = [];

  for (let ch = 0; ch < channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);

    lowChannels.push(
      this.applyBandpassFilter(channelData, LOW_BAND.low, LOW_BAND.high, sampleRate)
    );
    midChannels.push(
      this.applyBandpassFilter(channelData, MID_BAND.low, MID_BAND.high, sampleRate)
    );
    highChannels.push(
      this.applyBandpassFilter(channelData, HIGH_BAND.low, HIGH_BAND.high, sampleRate)
    );
  }

  // Step 2: Calculate energy in each band (speech only)
  const speechSegments = this.extractSpeechSegments(silenceData);

  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let sampleCount = 0;

  for (const segment of speechSegments) {
    const startSample = Math.floor(segment.startTime * sampleRate);
    const endSample = Math.floor(segment.endTime * sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      for (let i = startSample; i < endSample; i++) {
        lowEnergy += lowChannels[ch][i] ** 2;
        midEnergy += midChannels[ch][i] ** 2;
        highEnergy += highChannels[ch][i] ** 2;
        sampleCount++;
      }
    }
  }

  // Step 3: Calculate RMS levels
  const lowRMS = 20 * Math.log10(Math.sqrt(lowEnergy / sampleCount));
  const midRMS = 20 * Math.log10(Math.sqrt(midEnergy / sampleCount));
  const highRMS = 20 * Math.log10(Math.sqrt(highEnergy / sampleCount));

  // Step 4: Calculate ratios
  const lowToMidRatio = lowRMS - midRMS;
  const highToMidRatio = highRMS - midRMS;

  // Step 5: Identify issues
  const issues = {
    tooMuchBass: lowToMidRatio > ISSUES.tooMuchBass,
    tooThin: lowToMidRatio < ISSUES.tooThin,
    lacksClarity: highToMidRatio < ISSUES.lacksClarity,
    tooBoomy: lowToMidRatio > ISSUES.tooBoomy
  };

  // Step 6: Determine severity
  let severity = 'good';
  const issueCount = Object.values(issues).filter(v => v).length;

  if (issues.tooBoomy || (issues.tooMuchBass && issues.lacksClarity)) {
    severity = 'critical'; // Multiple serious issues
  } else if (issueCount > 0) {
    severity = 'warning';  // Single issue
  }

  // Step 7: Generate recommendations
  const recommendations = [];

  if (issues.tooMuchBass || issues.tooBoomy) {
    recommendations.push('Apply high-pass filter at 80-100 Hz to reduce proximity effect');
    recommendations.push('Increase mic distance to 6-12 inches');
  }
  if (issues.tooThin) {
    recommendations.push('Reduce mic distance to add warmth and body');
    recommendations.push('Check mic placement and room acoustics');
  }
  if (issues.lacksClarity) {
    recommendations.push('Check mic angle - try positioning slightly off-axis');
    recommendations.push('Verify mic is facing correct direction');
    recommendations.push('Check for high-frequency rolloff in recording chain');
  }

  return {
    severity,
    lowRMS,
    midRMS,
    highRMS,
    lowToMidRatio,
    highToMidRatio,
    issues,
    recommendations,
    perChannelAnalysis: this.analyzeFrequencyBalancePerChannel(
      lowChannels,
      midChannels,
      highChannels,
      speechSegments,
      sampleRate
    )
  };
}
```

### Thresholds

| Ratio | Ideal Range | Warning | Critical |
|-------|-------------|---------|----------|
| Low/Mid | -12 to -6 dB | -20 to -12 dB or -6 to -3 dB | <-20 dB or >-3 dB |
| High/Mid | -8 to -3 dB | -15 to -8 dB | <-15 dB |

### Return Data Structure

```typescript
interface FrequencyBalanceAnalysis {
  severity: 'good' | 'warning' | 'critical';
  lowRMS: number;              // -32.1 dB (80-250 Hz)
  midRMS: number;              // -24.5 dB (250-2000 Hz)
  highRMS: number;             // -28.2 dB (2000-8000 Hz)
  lowToMidRatio: number;       // -7.6 dB
  highToMidRatio: number;      // -3.7 dB
  issues: {
    tooMuchBass: boolean;      // Proximity effect
    tooThin: boolean;          // Lacking warmth
    lacksClarity: boolean;     // Dull/muffled
    tooBoomy: boolean;         // Excessive low-mids
  };
  recommendations: string[];
  perChannelAnalysis?: Array<{
    channel: number;
    channelName: string;
    lowToMidRatio: number;
    highToMidRatio: number;
    issues: object;
  }>;
}
```

## Integration Points

### 1. Type Definitions

**File**: `packages/web/src/types/index.ts`

```typescript
export interface FrequencyBalanceAnalysis {
  severity: 'good' | 'warning' | 'critical';
  lowRMS: number;
  midRMS: number;
  highRMS: number;
  lowToMidRatio: number;
  highToMidRatio: number;
  issues: {
    tooMuchBass: boolean;
    tooThin: boolean;
    lacksClarity: boolean;
    tooBoomy: boolean;
  };
  recommendations: string[];
  perChannelAnalysis?: Array<{
    channel: number;
    channelName: string;
    lowToMidRatio: number;
    highToMidRatio: number;
    issues: {
      tooMuchBass: boolean;
      tooThin: boolean;
      lacksClarity: boolean;
      tooBoomy: boolean;
    };
  }>;
}

// Add to AudioResults
export interface AudioResults {
  // ... existing fields
  frequencyBalance?: FrequencyBalanceAnalysis;
}
```

### 2. LevelAnalyzer Integration

**Progress Allocation**: 67-72% (5% of total)

```javascript
// In analyzeAudioBuffer()
if (includeExperimental) {
  // ... previous analyses

  // Frequency Balance (67-72%)
  if (progressCallback) {
    progressCallback('Analyzing frequency balance...', 0.67);
  }

  const frequencyBalance = await this.analyzeFrequencyBalance(
    audioBuffer,
    { silenceSegments, leadingSilence, trailingSilence },
    progressCallback
  );

  results.frequencyBalance = frequencyBalance;
}
```

### 3. UI Display

**File**: `packages/web/src/components/ResultsTable.svelte`

```svelte
<th>Frequency Balance</th>

<td
  class="frequency-balance-cell {getFrequencyBalanceClass(result.frequencyBalance)}"
  title={getFrequencyBalanceTooltip(result)}
>
  {#if result.frequencyBalance}
    <div class="ratios">
      <span class="low-mid">L/M: {result.frequencyBalance.lowToMidRatio.toFixed(1)} dB</span>
      <span class="high-mid">H/M: {result.frequencyBalance.highToMidRatio.toFixed(1)} dB</span>
    </div>
    {#if Object.values(result.frequencyBalance.issues).some(v => v)}
      <div class="issues-badge">⚠</div>
    {/if}
  {:else}
    <span class="na-value">N/A</span>
  {/if}
</td>
```

**Helper Functions**:

```javascript
function getFrequencyBalanceClass(analysis) {
  if (!analysis) return '';

  if (analysis.severity === 'critical') return 'error';
  if (analysis.severity === 'warning') return 'warning';
  return 'success';
}

function getFrequencyBalanceTooltip(result) {
  const fb = result.frequencyBalance;
  if (!fb) return 'Frequency balance analysis not available';

  let tooltip = `Frequency Balance\n`;
  tooltip += `────────────────────\n`;
  tooltip += `Low (80-250 Hz): ${fb.lowRMS.toFixed(1)} dB\n`;
  tooltip += `Mid (250-2000 Hz): ${fb.midRMS.toFixed(1)} dB\n`;
  tooltip += `High (2000-8000 Hz): ${fb.highRMS.toFixed(1)} dB\n\n`;
  tooltip += `Low/Mid Ratio: ${fb.lowToMidRatio.toFixed(1)} dB\n`;
  tooltip += `High/Mid Ratio: ${fb.highToMidRatio.toFixed(1)} dB\n`;

  const issues = [];
  if (fb.issues.tooMuchBass) issues.push('Proximity Effect (too much bass)');
  if (fb.issues.tooBoomy) issues.push('Boomy (excessive low-mids)');
  if (fb.issues.tooThin) issues.push('Thin (lacking warmth)');
  if (fb.issues.lacksClarity) issues.push('Lacks Clarity (muffled)');

  if (issues.length > 0) {
    tooltip += `\nIssues Detected:\n`;
    issues.forEach(issue => {
      tooltip += `• ${issue}\n`;
    });
  }

  if (fb.recommendations && fb.recommendations.length > 0) {
    tooltip += `\nRecommendations:\n`;
    fb.recommendations.forEach(rec => {
      tooltip += `• ${rec}\n`;
    });
  }

  return tooltip;
}
```

### 4. CSV Export

**New Columns**:

```javascript
const FREQUENCY_BALANCE_HEADERS = [
  'Frequency Balance Severity',
  'Low/Mid Ratio (dB)',
  'High/Mid Ratio (dB)',
  'Low Band RMS (dB)',
  'Mid Band RMS (dB)',
  'High Band RMS (dB)',
  'Issues Detected'
];

function extractFrequencyBalanceData(result) {
  const fb = result.frequencyBalance;
  if (!fb) {
    return FREQUENCY_BALANCE_HEADERS.map(() => 'N/A');
  }

  const issues = [];
  if (fb.issues.tooMuchBass) issues.push('ProximityEffect');
  if (fb.issues.tooBoomy) issues.push('Boomy');
  if (fb.issues.tooThin) issues.push('Thin');
  if (fb.issues.lacksClarity) issues.push('LacksClarity');

  return [
    fb.severity,
    formatNumber(fb.lowToMidRatio),
    formatNumber(fb.highToMidRatio),
    formatNumber(fb.lowRMS),
    formatNumber(fb.midRMS),
    formatNumber(fb.highRMS),
    issues.join(', ') || 'None'
  ];
}
```

## Implementation Phases

### Phase 1: Core Algorithm (Day 1)
- [ ] Implement bandpass filtering for 3 bands
- [ ] Implement `analyzeFrequencyBalance()` main method
- [ ] Calculate ratios and identify issues
- [ ] Add unit tests with synthetic audio

### Phase 2: Integration (Day 1)
- [ ] Add TypeScript interfaces
- [ ] Integrate into `analyzeAudioBuffer()`
- [ ] Test with real voice samples
- [ ] Tune thresholds based on samples

### Phase 3: UI & Export (Day 2)
- [ ] Add ResultsTable column
- [ ] Implement helper functions
- [ ] Add CSV export columns
- [ ] Add failure analysis integration

### Phase 4: Testing (Day 2)
- [ ] Create test audio samples
- [ ] Comprehensive unit tests
- [ ] Integration tests
- [ ] Documentation

## Testing Strategy

### Test Audio Samples

**Location**: `packages/web/tests/fixtures/voice-quality/frequency-balance/`

1. **proximity-effect.wav** - Too close to mic, low/mid > -3 dB
2. **thin-voice.wav** - Too far from mic, low/mid < -20 dB
3. **lacks-clarity.wav** - Off-axis or rolled-off, high/mid < -15 dB
4. **balanced-voice.wav** - Ideal frequency distribution
5. **boomy-voice.wav** - Excessive low-mids, low/mid > -1 dB

### Unit Tests

```javascript
describe('FrequencyBalance Analysis', () => {
  it('should detect proximity effect');
  it('should detect thin/distant sound');
  it('should detect lack of clarity');
  it('should pass balanced voice recordings');
  it('should handle mono and stereo');
});
```

## Success Criteria

- ✅ Correctly identifies proximity effect
- ✅ Correctly identifies thin/lacking clarity
- ✅ Passes well-balanced recordings
- ✅ Provides actionable recommendations
- ✅ Processing time <3% of total
- ✅ Works with mono and stereo
- ✅ All tests pass

## Performance

- **Processing Time**: ~2-3% of total analysis
- **Memory**: 3x audio buffer for filtered channels
- **Filter Order**: 4th order Butterworth for efficiency

## Future Enhancements

- **Visual EQ curve**: Display frequency response graph
- **Target curve**: Compare against ideal voice EQ
- **EQ suggestions**: Specific filter settings to fix issues
- **Spectral tilt**: Overall frequency balance measurement
