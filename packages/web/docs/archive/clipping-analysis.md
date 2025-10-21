# Clipping Analysis

**Status:** Implemented
**Date:** October 15, 2025
**Location:** `packages/core/level-analyzer.js` (lines 1192-1426)

## Overview

Clipping detection is a critical audio quality control feature that identifies waveform distortion caused by overdriven recording levels. This feature detects both **hard clipping** (samples at exactly ±1.0) and **near-clipping** (samples approaching the maximum threshold) to help ensure clean, professional audio recordings.

## What is Clipping?

**Clipping** occurs when audio samples exceed the maximum representable value in a digital audio system. In PCM audio:
- 16-bit audio: max value is ±32,767
- 24-bit audio: max value is ±8,388,607

The Web Audio API automatically converts PCM to normalized floating-point values in the range `[-1.0, 1.0]`. When clipping occurs in the original recording:
- A PCM sample at maximum value (e.g., 32,767) becomes exactly `1.0`
- A PCM sample at minimum value (e.g., -32,768) becomes exactly `-1.0`

The result is **audible distortion** where the waveform is "cut off" or "flattened" at the peaks.

## Why Clipping Detection Matters

For voiceover and conversational audio:
- **Quality Control:** Clipping indicates overdriven recording levels that produce distortion
- **Professional Standards:** Clean recordings should avoid clipping entirely
- **Early Warning:** Near-clipping detection provides proactive alerts before actual distortion occurs
- **Channel-Specific Issues:** Per-channel tracking helps identify if one microphone is set too hot

## Detection Algorithm

### Multi-Level Detection

The feature detects clipping at two levels:

1. **Hard Clipping** (samples at exactly ±1.0)
   - Indicates actual PCM clipping occurred during recording
   - Severity: ERROR or WARNING depending on extent

2. **Near Clipping** (samples at 0.98 ≤ |sample| < 1.0)
   - Proactive warning that levels are too high
   - Headroom recommendation: peak at -0.3 dB or lower
   - Severity: WARNING

### Adaptive Threshold

The algorithm uses a **sample rate adaptive threshold** to avoid false positives:

```javascript
minConsecutiveSamples = Math.max(2, Math.floor(sampleRate / 20000))
```

Examples:
- 44.1 kHz: 2-3 consecutive samples required
- 48 kHz: 2-3 consecutive samples required
- 96 kHz: 4-5 consecutive samples required

This prevents flagging single stray samples while catching real clipping events.

### Gap Tolerance

Based on the **ClipDaT algorithm** (industry standard), the detector allows up to **3 samples** to dip below the threshold within a clipping region:

```
Example: 1.0, 1.0, 0.98, 1.0, 1.0 → counts as ONE region (not two)
```

This handles intermittent clipping more accurately.

### Region Grouping

Consecutive clipped samples are grouped into **clipping regions** with:
- Start time and end time (seconds)
- Duration (seconds)
- Channel identification (left/right/etc.)
- Sample count
- Peak sample value

## Metrics

### Overall Statistics

- **Clipped Samples:** Total count of hard-clipped samples (at ±1.0)
- **Clipped Percentage:** Percentage of total samples that are hard-clipped
- **Near-Clipping Samples:** Total count of near-clipping samples (0.98-0.999)
- **Near-Clipping Percentage:** Percentage of total samples that are near-clipping

### Density Metrics

- **Clipping Event Count:** Number of distinct hard clipping regions
- **Near-Clipping Event Count:** Number of distinct near-clipping regions
- **Max Consecutive Clipped:** Longest hard clipping region (in samples)
- **Avg Clipping Duration:** Average duration of hard clipping regions (seconds)

### Per-Channel Breakdown

For stereo/multi-channel recordings:
- Clipped percentage per channel
- Near-clipping percentage per channel
- Region count per channel
- Channel name (left, right, center, etc.)

### Detailed Regions

Returns top clipping regions sorted by duration/severity:
- Timestamp (start-end in seconds)
- Channel identification
- Sample count
- Peak sample value
- Type (hard or near)

## Severity Classification

### Display Logic

The UI uses the following classification:

```javascript
// ERROR - Severe or widespread clipping
if (clippedPercentage > 1% OR clippingEventCount > 50)
  → Red: "X.XX% clipped (N events)"

// WARNING - Moderate hard clipping
if (clippedPercentage > 0.1% OR clippingEventCount > 10)
  → Orange: "X.XX% clipped (N events)"

// WARNING - Any hard clipping
if (clippedPercentage > 0 AND clippingEventCount > 0)
  → Orange: "X.XX% clipped (N events)"

// WARNING - Near-clipping detected
if (nearClippingPercentage > 1%)
  → Orange: "Near clipping: X.X%"

// SUCCESS - Clean audio
else
  → Green: "No clipping detected"
```

### Experimental Status Impact

Clipping analysis contributes to the overall experimental status:
- **Error:** Hard clipping > 1% OR > 50 events
- **Warning:** Hard clipping 0.1-1%, 10-50 events, OR near-clipping > 1%
- **Pass:** No clipping detected

## User Interface

### Clipping Column

In experimental mode, a new "Clipping" column displays:
- Color-coded status (green/orange/red)
- Percentage and event count
- Hover tooltip with detailed breakdown

### Tooltip Information

The tooltip shows:

```
Clipping Detection
━━━━━━━━━━━━━━━━━
Detects audio samples at maximum values (±1.0) which indicate
distortion from overdriven recording levels.

Hard Clipping: 0.50% (5 regions)
Near Clipping: 1.20% (12 regions)

Worst Clipping Regions (Hard):
• Left: 0:12-0:13 (0.2s, 8820 samples)
• Left: 1:45-1:46 (0.1s, 4410 samples)
• Right: 2:30-2:31 (0.15s, 6615 samples)

Per-Channel Breakdown:
• left: 1.00% clipped, 0.30% near
• right: 0.00% clipped, 0.20% near

Tip: Reduce input gain or apply normalization with headroom
```

## Performance

### Optimization Strategy

The implementation uses **block-based max detection** for efficiency:

```javascript
// Process in blocks of 8192 samples
// Only analyze blocks with samples >= threshold
// 10-50x speedup for clean files
```

### Expected Performance

- **Clean files (no clipping):** Very fast (block-based early exit)
- **Files with clipping:** Full analysis required
- **3-hour file (48kHz stereo):** ~3-8 seconds on modern hardware

### No Downsampling

Unlike some metrics, clipping detection does **NOT** use downsampling because:
- Clipping events can be brief (50-100ms = 2,400-9,600 samples at 48kHz)
- Missing even one clipping event is unacceptable for quality control
- Block-based optimization provides sufficient performance

## Technical Implementation

### Code Location

- **Core analysis:** `packages/core/level-analyzer.js` (lines 1192-1426)
- **Integration:** `analyzeAudioBuffer()` method (lines 85-87, 96)
- **UI display:** `packages/web/src/components/ResultsTable.svelte`
- **Status logic:** `packages/web/src/components/ResultsDisplay.svelte`

### Method Signature

```javascript
async analyzeClipping(audioBuffer, sampleRate, progressCallback = null)
```

**Parameters:**
- `audioBuffer`: Web Audio API AudioBuffer object
- `sampleRate`: Sample rate in Hz
- `progressCallback`: Optional callback for progress updates

**Returns:**
```javascript
{
  clippedSamples: number,
  clippedPercentage: number,
  nearClippingSamples: number,
  nearClippingPercentage: number,
  clippingEventCount: number,
  nearClippingEventCount: number,
  maxConsecutiveClipped: number,
  avgClippingDuration: number,
  perChannel: Array<{
    channel: number,
    name: string,
    clippedSamples: number,
    clippedPercentage: number,
    nearClippingSamples: number,
    nearClippingPercentage: number,
    regionCount: number
  }>,
  clippingRegions: Array<{
    startTime: number,
    endTime: number,
    duration: number,
    channel: number,
    channelName: string,
    sampleCount: number,
    peakSample: number,
    type: 'hard' | 'near'
  }>,
  hardClippingRegions: Array<...>,
  nearClippingRegions: Array<...>
}
```

### Progress Callbacks

The analysis supports cancellation and progress tracking:

```javascript
let cancelled = false;

const result = await levelAnalyzer.analyzeClipping(
  audioBuffer,
  sampleRate,
  (message, progress) => {
    console.log(message, progress);
    if (userCancelled) cancelled = true;
  }
);
```

## Best Practices

### For Users

1. **Prevent Clipping at the Source:**
   - Set recording levels with headroom (-6 to -12 dB peak)
   - Use input gain controls, not software normalization
   - Monitor levels during recording

2. **Respond to Warnings:**
   - **Near-clipping:** Reduce gain for next recording
   - **Mild clipping (<0.1%):** May be acceptable for specific use cases
   - **Moderate clipping (>0.1%):** Re-record if possible
   - **Severe clipping (>1%):** Definitely re-record

3. **Check Per-Channel Stats:**
   - In stereo recordings, one channel may clip while the other is fine
   - Adjust individual microphone gains accordingly

### For Developers

1. **Threshold Values:**
   - Hard clipping: exactly `1.0` (no tolerance)
   - Near-clipping: `0.98 ≤ |sample| < 1.0`
   - These values are research-backed standards

2. **Gap Tolerance:**
   - Don't change the 3-sample gap tolerance
   - Based on ClipDaT algorithm (industry standard)

3. **Adaptive Threshold:**
   - Formula: `Math.max(2, Math.floor(sampleRate / 20000))`
   - Scales appropriately for high sample rates

## Research References

This implementation is based on:

1. **ClipDaT Algorithm:**
   - Gap tolerance: Allow 3 samples below threshold
   - Consecutive sample requirement: 2-3 minimum

2. **Industry Standards:**
   - Near-clipping threshold: 0.98-0.999
   - Mastering recommendation: peak at -0.3 dB
   - Professional headroom: -6 to -12 dB

3. **Sample Rate Adaptation:**
   - Higher sample rates require more consecutive samples
   - Prevents false positives on transients

## Future Enhancements

Potential improvements (not currently implemented):

1. **Soft Clipping Detection:**
   - More advanced distortion analysis
   - Relevant for music production, less so for voiceover

2. **Clipping Repair Suggestions:**
   - Specific dB reduction recommendations
   - Analysis of headroom requirements

3. **Histogram Visualization:**
   - Distribution of clipping events over time
   - Identify patterns (beginning, middle, end)

4. **Integration with Normalization:**
   - Automatic suggestions for safe normalization levels
   - Predict whether normalization would cause clipping

## Testing

### Unit Tests

Test mocks are located in:
- `packages/web/tests/unit/audio-analysis-service.test.js` (lines 82-95)

### Manual Testing

To test the clipping detection feature:

1. **Enable Experimental Mode:**
   - Switch to "Experimental Analysis" mode

2. **Test with Clean Audio:**
   - Upload a well-recorded file
   - Should show "No clipping detected" (green)

3. **Test with Clipped Audio:**
   - Record audio with input gain too high
   - Or normalize a file to 0 dB (may cause near-clipping)
   - Should show clipping percentage and event count

4. **Test with Near-Clipping:**
   - Normalize audio to -0.2 dB
   - Should show "Near clipping" warning

5. **Check Tooltip:**
   - Hover over clipping cell
   - Verify detailed breakdown appears
   - Check timestamps correspond to actual clipped regions

6. **Test Per-Channel Tracking:**
   - Use stereo file with clipping in only one channel
   - Verify per-channel breakdown is accurate

## See Also

- [CLIPPING_ANALYSIS_PLAN.md](/docs/CLIPPING_ANALYSIS_PLAN.md) - Original implementation plan
- [Mic Bleed Analysis](/packages/web/docs/mic-bleed-analysis.md) - Related quality metric
- [Conversational Audio Analysis](/packages/web/docs/conversational-audio-analysis-plan.md) - Full experimental feature set
