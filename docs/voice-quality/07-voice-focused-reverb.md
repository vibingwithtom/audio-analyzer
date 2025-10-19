# Voice-Focused Reverb Analysis

**Priority**: Tier 3 - Low Impact, Low Effort
**Estimated Effort**: 1 day
**Dependencies**: None (enhancement of existing reverb analysis)

## Problem Statement

Current reverb analysis uses full-spectrum audio, which includes:
- Low-frequency room rumble (not perceptually important for voice)
- High-frequency noise and artifacts (distort measurements)
- Non-voice environmental sounds

For voice recordings, reverb perception is dominated by the 200-8000 Hz range where speech intelligibility lives. Filtering to this range provides more accurate voice-specific reverb measurements.

## Solution Overview

Apply bandpass filter (200-8000 Hz) to audio BEFORE reverb analysis. This isolates voice frequencies and provides more accurate RT60 measurements for voice recordings.

## Technical Specification

### Enhanced Method

**Location**: `packages/core/level-analyzer.js`

**Modify**: `estimateReverb()` method (already exists at lines 417-551)

```javascript
async estimateReverbVoiceFocused(channelDataArray, channels, length, sampleRate, noiseFloorDb, progressCallback) {
  // NEW: Apply voice-band filter before reverb analysis
  const VOICE_BAND_LOW = 200;
  const VOICE_BAND_HIGH = 8000;

  const voiceFilteredChannels = [];
  for (let ch = 0; ch < channels; ch++) {
    voiceFilteredChannels.push(
      this.applyBandpassFilter(
        channelDataArray[ch],
        VOICE_BAND_LOW,
        VOICE_BAND_HIGH,
        sampleRate
      )
    );
  }

  // Use existing reverb algorithm on filtered data
  return await this.estimateReverb(
    voiceFilteredChannels,
    channels,
    length,
    sampleRate,
    noiseFloorDb,
    progressCallback
  );
}
```

### Voice-Specific RT60 Thresholds

```javascript
interpretReverbVoice(rt60) {
  // Stricter thresholds for voice compared to music
  if (rt60 <= 0.2) {
    return { label: 'Excellent (Isolation Booth)', description: 'Professional isolation, ideal for voice' };
  }
  if (rt60 < 0.4) {
    return { label: 'Good (Treated Room)', description: 'Well-treated space, suitable for voice' };
  }
  if (rt60 < 0.6) {
    return { label: 'Acceptable (Home Studio)', description: 'Minor reflections, usable for voice' };
  }
  if (rt60 < 0.9) {
    return { label: 'Poor (Untreated Room)', description: 'Noticeable echo, reduces clarity' };
  }
  return { label: 'Unacceptable (Echoey)', description: 'Excessive reverb, unsuitable for voice' };
}
```

## Integration

### Option 1: Separate Analysis (Recommended)

Add as new optional analysis alongside existing reverb:

```javascript
if (includeExperimental) {
  // Standard reverb (40-50%)
  results.reverbAnalysis = await this.estimateReverb(...);

  // Voice-focused reverb (50-55%) - OPTIONAL
  if (options.voiceFocusedReverb) {
    results.reverbVoiceFocused = await this.estimateReverbVoiceFocused(...);
  }
}
```

### Option 2: Replace Standard (Alternative)

Replace existing reverb analysis entirely:

```javascript
if (includeExperimental) {
  // Use voice-focused reverb instead of standard
  results.reverbAnalysis = await this.estimateReverbVoiceFocused(...);
}
```

## Benefits

✅ **More accurate for voice**: Focuses on perceptually relevant frequencies
✅ **Ignores room rumble**: Low-frequency noise doesn't affect measurement
✅ **Better noise rejection**: High-frequency noise filtered out
✅ **Voice-specific thresholds**: Stricter RT60 limits appropriate for speech

## Comparison

| Reverb Type | Frequency Range | Best For | RT60 Threshold |
|-------------|----------------|----------|----------------|
| Standard | Full spectrum | Music, general audio | <0.3s excellent |
| Voice-Focused | 200-8000 Hz | Voice, speech | <0.2s excellent |

## Implementation

### Phase 1: Core (4 hours)
- [ ] Add `estimateReverbVoiceFocused()` method
- [ ] Update `interpretReverb()` with voice thresholds
- [ ] Add option to enable/disable

### Phase 2: UI (2 hours)
- [ ] Add toggle in settings
- [ ] Display both results if enabled
- [ ] Update tooltips

### Phase 3: Testing (2 hours)
- [ ] Compare standard vs voice-focused on test samples
- [ ] Validate threshold accuracy
- [ ] Document differences

## Success Criteria

- ✅ Provides more accurate RT60 for voice recordings
- ✅ Filters out low/high frequency noise
- ✅ Can run alongside or replace standard reverb
- ✅ Minimal performance impact (~same as standard)

## Test Samples

- **vocal-booth.wav** - Very dry recording
  - Standard: 0.25s | Voice-focused: 0.15s (more accurate)

- **untreated-room.wav** - Significant reverb
  - Standard: 0.7s | Voice-focused: 0.8s (similar)

- **low-rumble.wav** - Room with HVAC noise
  - Standard: 0.5s (inflated) | Voice-focused: 0.3s (accurate)
