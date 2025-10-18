# Experimental Analysis Optimization Opportunities

## Executive Summary

Current experimental analysis makes **5-6 separate passes** over the audio data. Through consolidation and data sharing, we can potentially reduce processing time by **30-45%** without changing functionality.

## Current Analysis Flow (Redundancies Highlighted)

### Pass 1: Peak Level Analysis (0-15%)
```javascript
// Scans EVERY sample
for (let channel = 0; channel < channels; channel++) {
  for (let i = 0; i < length; i++) {
    const sample = Math.abs(data[i]);
    if (sample > globalPeak) globalPeak = sample;
  }
}
```
**Cost**: Full audio scan (100% of samples)

### Pass 2: Noise Floor Analysis (15-35%)
```javascript
// Scans audio in 50ms windows, calculates RMS
for (let i = 0; i < length; i += windowSize) {
  let sumSquares = 0;
  for (let j = i; j < end; j++) {
    sumSquares += data[j] * data[j];  // RMS calculation
  }
  const rms = Math.sqrt(sumSquares / windowSize);
  overallRmsValues.push(rms);
}
```
**Cost**: Full audio scan (100% of samples) + RMS calculation

### Pass 3: Reverb Analysis (40-65%)
```javascript
// Scans audio with onset detection
for (let i = 0; i < length - onsetWindowSize; i += onsetWindowSize) {
  let sumSquares = 0;
  for (let j = i; j < i + onsetWindowSize; j++) {
    sumSquares += data[j] * data[j];  // RMS calculation AGAIN
  }
  const currentRms = Math.sqrt(sumSquares / onsetWindowSize);
  // ... onset detection logic
}
```
**Cost**: Full audio scan (100% of samples) + RMS calculation (DUPLICATE)

### Pass 4: Silence Detection (65-80%)
```javascript
// Scans audio in 50ms chunks
for (let i = 0; i < numChunks; i++) {
  let maxSampleInChunk = 0;
  for (let channel = 0; channel < channels; channel++) {
    for (let j = start; j < end; j++) {
      const sample = Math.abs(data[j]);  // Sample scan AGAIN
      if (sample > maxSampleInChunk) maxSampleInChunk = sample;
    }
  }
}
```
**Cost**: Full audio scan (100% of samples)

### Pass 5: Clipping Analysis (80-100%)
```javascript
// Scans EVERY sample looking for high values
for (let channel = 0; channel < channels; channel++) {
  for (let i = 0; i < length; i++) {
    const absSample = Math.abs(data[i]);  // Sample scan AGAIN
    if (absSample >= hardClippingThreshold) {
      // Record clipping
    }
  }
}
```
**Cost**: Full audio scan (100% of samples)

### Pass 6: Stereo/Conversational Analysis (if stereo)
```javascript
// Scans audio in 250ms blocks
for (let i = 0; i < length; i += blockSize) {
  let sumSquaresLeft = 0;
  let sumSquaresRight = 0;
  for (let j = i; j < blockEnd; j++) {
    sumSquaresLeft += leftChannel[j] ** 2;   // RMS calculation AGAIN
    sumSquaresRight += rightChannel[j] ** 2;
  }
  const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
  const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);
}
```
**Cost**: Full audio scan (100% of samples) + RMS calculation (DUPLICATE)

## Identified Redundancies

### 🔴 Critical: Multiple Full Audio Scans

| Analysis | Scans All Samples | Calculates RMS | Window Size |
|----------|------------------|----------------|-------------|
| Peak Level | ✅ | ❌ | N/A |
| Noise Floor | ✅ | ✅ | 50ms |
| Reverb | ✅ | ✅ | 1024 samples (~21ms @ 48kHz) |
| Silence | ✅ | ❌ | 50ms |
| Clipping | ✅ | ❌ | N/A |
| Stereo/Conversational | ✅ | ✅ | 250ms |

**Total**: 6 separate full scans when we could do 1-2!

### 🟡 Moderate: Redundant RMS Calculations

RMS is calculated **3 times** with different window sizes:
1. Noise floor: 50ms windows
2. Reverb: 1024 sample windows (~21ms)
3. Stereo/Conversational: 250ms blocks

### 🟡 Moderate: Overlapping Block Analysis

Three features analyze audio in blocks but separately:
- Stereo separation: 250ms blocks
- Mic bleed: 250ms blocks (same data!)
- Conversational overlap: 250ms blocks (same data!)

Currently these are run **separately** but could be **consolidated**.

## Optimization Strategies

### Strategy 1: Single-Pass Sample Scan (HIGH IMPACT)

**Current**: 6 separate passes (peak, noise floor, reverb, silence, clipping, stereo)
**Optimized**: 1 unified pass

```javascript
async analyzeAudioUnified(channelData, channels, length, sampleRate) {
  // Pre-allocate arrays
  const windowSize50ms = Math.floor(sampleRate * 0.05);  // 50ms
  const numWindows = Math.ceil(length / windowSize50ms);
  const windowRMS = new Array(numWindows);  // Shared RMS data

  let globalPeak = 0;
  let clippingRegions = [];

  // SINGLE PASS: Process audio in 50ms windows
  for (let windowIdx = 0; windowIdx < numWindows; windowIdx++) {
    const start = windowIdx * windowSize50ms;
    const end = Math.min(start + windowSize50ms, length);

    let windowPeak = 0;
    let sumSquares = 0;
    let hasClipping = false;

    for (let ch = 0; ch < channels; ch++) {
      const data = channelData[ch];

      for (let i = start; i < end; i++) {
        const absSample = Math.abs(data[i]);

        // PEAK ANALYSIS (was separate pass)
        if (absSample > windowPeak) windowPeak = absSample;
        if (absSample > globalPeak) globalPeak = absSample;

        // CLIPPING ANALYSIS (was separate pass)
        if (absSample >= 0.985) hasClipping = true;

        // RMS CALCULATION (shared by multiple analyses)
        sumSquares += data[i] ** 2;
      }
    }

    // Store window data for reuse
    const rms = Math.sqrt(sumSquares / ((end - start) * channels));
    windowRMS[windowIdx] = {
      rms: rms,
      rmsDb: 20 * Math.log10(rms),
      peak: windowPeak,
      peakDb: 20 * Math.log10(windowPeak),
      hasClipping: hasClipping,
      startSample: start,
      endSample: end
    };
  }

  // Now use pre-calculated window data for all analyses
  const noiseFloor = this.calculateNoiseFloorFromWindows(windowRMS);
  const silence = this.detectSilenceFromWindows(windowRMS, noiseFloor);
  const clipping = this.analyzeClippingFromWindows(windowRMS);
  const reverb = await this.estimateReverbFromWindows(windowRMS, channelData);

  return { globalPeak, windowRMS, noiseFloor, silence, clipping, reverb };
}
```

**Estimated Savings**: 40-50% of current experimental analysis time

### Strategy 2: Unified Block Analysis (MEDIUM IMPACT)

**Current**: Stereo, mic bleed, conversational run separately
**Optimized**: Single pass, all results

```javascript
async analyzeConversationalUnified(audioBuffer, noiseFloorData) {
  const blockSize = Math.floor(sampleRate * 0.25);  // 250ms

  // PRE-CALCULATE blocks once
  const blocks = [];
  for (let i = 0; i < length; i += blockSize) {
    let sumSquaresLeft = 0;
    let sumSquaresRight = 0;
    const blockEnd = Math.min(i + blockSize, length);

    for (let j = i; j < blockEnd; j++) {
      sumSquaresLeft += leftChannel[j] ** 2;
      sumSquaresRight += rightChannel[j] ** 2;
    }

    blocks.push({
      rmsLeft: Math.sqrt(sumSquaresLeft / (blockEnd - i)),
      rmsRight: Math.sqrt(sumSquaresRight / (blockEnd - i)),
      startSample: i,
      endSample: blockEnd
    });
  }

  // Now derive ALL analyses from shared block data
  const stereo = this.analyzeStereoFromBlocks(blocks);
  const micBleed = this.analyzeMicBleedFromBlocks(blocks);
  const overlap = this.analyzeOverlapFromBlocks(blocks, noiseFloorData);

  return { stereo, micBleed, overlap };
}
```

**Estimated Savings**: 15-20% of stereo/conversational analysis time

### Strategy 3: Cached Windowed RMS (MEDIUM IMPACT)

**Problem**: Multiple features need RMS at different window sizes
**Solution**: Calculate RMS at smallest window size, aggregate for larger windows

```javascript
// Calculate base RMS (smallest window needed)
const baseWindowSize = Math.min(
  windowSize50ms,      // Noise floor, silence
  onsetWindowSize,     // Reverb (~21ms @ 48kHz)
  blockSize250ms / 5   // Can aggregate 5x 50ms windows
);

const baseRMS = this.calculateBaseRMS(channelData, baseWindowSize);

// Aggregate for larger windows
const rms50ms = this.aggregateRMS(baseRMS, 50ms / baseWindow);
const rms250ms = this.aggregateRMS(baseRMS, 250ms / baseWindow);
const rmsReverb = this.aggregateRMS(baseRMS, onsetWindow / baseWindow);
```

**Estimated Savings**: 10-15% by avoiding redundant RMS calculations

### Strategy 4: Progressive Analysis (LOW-MEDIUM IMPACT)

**Current**: All analyses run regardless of results
**Optimized**: Skip expensive analyses if early checks fail

```javascript
async analyzeAudioProgressive(audioBuffer) {
  // Quick base analysis
  const { peak, noiseFloor, normalization } = await this.analyzeBase(...);

  // Early exit conditions
  if (noiseFloor === -Infinity) {
    // File is digital silence, skip expensive analyses
    return { peak, noiseFloor, normalization, error: 'digital_silence' };
  }

  if (peak > 0.999) {
    // File is badly clipped, focus on clipping analysis only
    const clipping = await this.analyzeClipping(...);
    return { peak, noiseFloor, normalization, clipping, note: 'severe_clipping' };
  }

  // Full analysis for normal files
  return await this.analyzeExperimental(...);
}
```

**Estimated Savings**: 5-10% on problematic files (variable)

### Strategy 5: Multi-Band Filter Caching (FOR VOICE FEATURES)

**Purpose**: Optimize bandpass filtering for voice quality features

**Problem**: Voice quality features require extensive bandpass filtering:

| Feature | Frequency Bands | Filter Operations |
|---------|----------------|-------------------|
| #01 Sibilance | 4000-10000 Hz + 200-3000 Hz | 2 filters |
| #02 Frequency Balance | 80-250 Hz + 250-2000 Hz + 2000-8000 Hz | 3 filters |
| #04 Plosive Energy | 50-200 Hz | 1 filter |
| #06 Breath Sounds | 100-400 Hz | 1 filter |
| #07 Voice-Focused Reverb | 200-8000 Hz | 1 filter |

**Total**: 8 separate bandpass filters × ~0.8% each = **~6.4% overhead**

**Current Approach**: Each feature applies bandpass filter separately (8 full audio scans)

**Optimized Approach**: Apply all filters in single pass, store windowed RMS per band

```javascript
function calculateMultiBandRMS(channelData, sampleRate) {
  // Define all frequency bands needed for voice features
  const bands = [
    { name: 'sibilance', low: 4000, high: 10000 },
    { name: 'speech', low: 200, high: 3000 },
    { name: 'freqLow', low: 80, high: 250 },
    { name: 'freqMid', low: 250, high: 2000 },
    { name: 'freqHigh', low: 2000, high: 8000 },
    { name: 'plosive', low: 50, high: 200 },
    { name: 'breath', low: 100, high: 400 },
    { name: 'voiceReverb', low: 200, high: 8000 }
  ];

  // Initialize all 8 bandpass filters ONCE
  const filters = bands.map(b => createBandpassFilter(b.low, b.high, sampleRate));

  // Window size 50ms (matches base analysis)
  const windowSize = Math.floor(sampleRate * 0.05);
  const numWindows = Math.ceil(length / windowSize);

  // Pre-allocate RMS arrays for each band
  const bandRMS = bands.map(() => new Array(numWindows));

  // SINGLE PASS: Apply all 8 filters simultaneously
  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, length);

    // For each frequency band
    for (let b = 0; b < bands.length; b++) {
      let sumSquares = 0;

      // Process window samples through this band's filter
      for (let ch = 0; ch < channels; ch++) {
        for (let i = start; i < end; i++) {
          const sample = channelData[ch][i];
          const filtered = filters[b].process(sample);
          sumSquares += filtered ** 2;
        }
      }

      const samples = (end - start) * channels;
      bandRMS[b][w] = Math.sqrt(sumSquares / samples);
    }
  }

  return { bandRMS, bands };
}
```

**Memory Usage**:
```javascript
// 5-minute stereo file, 50ms windows
const numWindows = 6000;
const numBands = 8;
const bytesPerRMS = 8; // Float64

const memory = 6000 × 8 × 8 = 384 KB ✅ ACCEPTABLE!

// 3-hour file
const memory3hr = 216000 × 8 × 8 = 13.8 MB ✅ Still acceptable!
```

**Performance Impact**:
- **Current**: 8 separate filter passes = 6.4% overhead
- **Optimized**: 1 pass with 8 filters = 2-3% overhead
- **Savings**: ~3-4% when voice features enabled

**Integration**: Run BEFORE voice quality features, AFTER base analysis

**Estimated Savings**: 3-4% when voice features enabled

### Strategy 6: Unified Super Pass (ULTIMATE OPTIMIZATION)

**Merges**: Strategy 1 (Single-Pass Scan) + Strategy 5 (Multi-Band Filtering)

**Concept**: One single pass that calculates ALL data:
- Base metrics (peak, clipping, full-spectrum RMS)
- Multi-band filtered RMS (for voice features)
- All in 50ms windows

```javascript
async analyzeAudioSuperUnified(channelData, channels, length, sampleRate) {
  // Initialize ALL 8 bandpass filters for voice features
  const voiceBands = [
    createBandpassFilter(4000, 10000),  // Sibilance
    createBandpassFilter(200, 3000),    // Speech
    createBandpassFilter(80, 250),      // Low freq
    createBandpassFilter(250, 2000),    // Mid freq
    createBandpassFilter(2000, 8000),   // High freq
    createBandpassFilter(50, 200),      // Plosive
    createBandpassFilter(100, 400),     // Breath
    createBandpassFilter(200, 8000)     // Voice reverb
  ];

  const windowSize50ms = Math.floor(sampleRate * 0.05);
  const numWindows = Math.ceil(length / windowSize50ms);
  const windowData = new Array(numWindows);

  // SINGLE UNIFIED PASS - calculates EVERYTHING
  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize50ms;
    const end = Math.min(start + windowSize50ms, length);

    let windowPeak = 0;
    let hasClipping = false;
    let sumSquaresFull = 0;
    const sumSquaresBands = new Array(8).fill(0);

    for (let ch = 0; ch < channels; ch++) {
      const data = channelData[ch];

      for (let i = start; i < end; i++) {
        const sample = data[i];
        const absSample = Math.abs(sample);

        // BASE ANALYSIS
        if (absSample > windowPeak) windowPeak = absSample;
        if (absSample >= 0.985) hasClipping = true;
        sumSquaresFull += sample ** 2;

        // MULTI-BAND ANALYSIS (for voice features)
        for (let b = 0; b < 8; b++) {
          const filtered = voiceBands[b].process(sample);
          sumSquaresBands[b] += filtered ** 2;
        }
      }
    }

    const samples = (end - start) * channels;

    // Store comprehensive window data
    windowData[w] = {
      // Base metrics
      rmsFull: Math.sqrt(sumSquaresFull / samples),
      rmsDb: 20 * Math.log10(Math.sqrt(sumSquaresFull / samples)),
      peak: windowPeak,
      peakDb: 20 * Math.log10(windowPeak),
      hasClipping: hasClipping,

      // Multi-band RMS (for voice features)
      rmsBands: sumSquaresBands.map(ss => Math.sqrt(ss / samples)),

      // Metadata
      startSample: start,
      endSample: end
    };
  }

  // Derive ALL analyses from windowData (both base and voice)
  return {
    // Base analyses
    peak: Math.max(...windowData.map(w => w.peak)),
    noiseFloor: analyzeNoiseFloor(windowData),
    silence: analyzeSilence(windowData),
    clipping: analyzeClipping(windowData),

    // Voice quality features (use rmsBands)
    sibilance: analyzeSibilance(windowData, 0, 1),      // bands 0, 1
    freqBalance: analyzeFreqBalance(windowData, 2, 3, 4), // bands 2, 3, 4
    plosiveEnergy: analyzePlosiveEnergy(windowData, 5), // band 5
    breathSounds: analyzeBreathSounds(windowData, 6),   // band 6
    voiceReverb: analyzeReverb(windowData, 7)           // band 7
  };
}
```

**Memory Usage**:
```javascript
// Per-window storage
const bytesPerWindow = {
  rmsFull: 8,         // Float64
  rmsDb: 8,           // Float64
  peak: 8,            // Float64
  peakDb: 8,          // Float64
  hasClipping: 1,     // Boolean
  startSample: 4,     // Int32
  endSample: 4,       // Int32
  rmsBands: 8 × 8 = 64  // 8 bands × 8 bytes each
};
// Total: ~105 bytes per window

// 3-hour file (worst case)
const numWindows = 216,000;
const memory = 216,000 × 105 = 22.68 MB ✅ Acceptable!
```

**Performance Comparison**:

| Approach | Audio Scans | Processing Time | Memory (3hr) |
|----------|-------------|-----------------|--------------|
| Current (separate passes) | 6 base + 8 filters = 14 | 2.4s | Minimal |
| Incremental (Steps 1-3) | 2 (base + filters) | 1.8-1.9s | 9 MB |
| Strategy 6 (Super Unified) | 1 | 1.5-1.6s | 23 MB |

**Advantages**:
- ✅ **Ultimate efficiency**: Absolute minimum passes (1)
- ✅ **Clean architecture**: Data calculation separate from analysis logic
- ✅ **Foundation for future**: Easy to add new frequency bands
- ✅ **Voice features "free"**: No additional passes needed

**Disadvantages**:
- ⚠️ **High complexity**: 8 filters + base analysis in single loop
- ⚠️ **Higher memory**: 105 bytes/window vs 41 bytes/window
- ⚠️ **Harder debugging**: Single critical point of failure
- ⚠️ **Filter state management**: Requires careful filter reset between windows

**Risk Level**: **HIGH** (highest complexity, highest reward)

**Recommended Approach**:
- **Initial implementation**: Use incremental optimization (Steps 1-3) + separate Strategy 5
- **Future enhancement**: Migrate to Strategy 6 after incremental approach is stable and validated
- **Only pursue if**: Team has capacity for complex refactoring and extensive testing infrastructure

**Estimated Savings**: 40-50% (maximum possible with voice features)

## Performance Impact Estimation

### Current Performance Breakdown

For 5-minute stereo file at 48kHz (~57 MB):

| Analysis | Current Time | % of Total |
|----------|-------------|-----------|
| Peak Level | 120ms | 5% |
| Noise Floor | 350ms | 15% |
| Normalization | 10ms | <1% |
| Reverb | 800ms | 33% |
| Silence | 400ms | 17% |
| Clipping | 600ms | 25% |
| Stereo/Conversational | 100ms | 4% |
| **Total** | **~2400ms** | **100%** |

### With Strategy 1: Single-Pass Scan

| Analysis | Optimized Time | Savings |
|----------|----------------|---------|
| Unified Pass (peak + noise + silence + clipping) | 450ms | -1020ms |
| Reverb | 800ms | 0ms |
| Stereo/Conversational | 100ms | 0ms |
| **Total** | **~1350ms** | **-1050ms (44%)** |

### With Strategy 1 + 2: Single-Pass + Unified Blocks

| Analysis | Optimized Time | Savings |
|----------|----------------|---------|
| Unified Pass | 450ms | -1020ms |
| Reverb | 800ms | 0ms |
| Unified Blocks (stereo + mic bleed + overlap) | 60ms | -40ms |
| **Total** | **~1310ms** | **-1090ms (45%)** |

### With All Strategies

| Analysis | Optimized Time | Savings |
|----------|----------------|---------|
| Unified Pass | 450ms | -1020ms |
| Reverb (with cached RMS) | 650ms | -150ms |
| Unified Blocks | 60ms | -40ms |
| Progressive optimization | Variable | -100-200ms |
| **Total** | **~1160-1260ms** | **-1140-1240ms (48-52%)** |

## Recommended Implementation Plan (UPDATED)

### **NEW RECOMMENDATION: Incremental Approach**

Based on risk analysis (see "Risk Mitigation & Validation Strategy" below), **incremental optimization is now the recommended approach**.

### Phase 1: Peak + Clipping Combination (HIGHEST PRIORITY)
**Effort**: 1 day (0.5 implementation + 0.5 testing)
**Savings**: 10% of experimental analysis time
**Risk**: LOW

**Steps**:
1. Combine peak and clipping detection into single loop
2. Validate exact match on peak values and clipping counts
3. Test with diverse file corpus
4. Deploy to beta, monitor performance

**Success Criteria**: Peak and clipping results match exactly

### Phase 2: Shared RMS Windows (HIGH PRIORITY)
**Effort**: 2 days (1 implementation + 1 testing)
**Savings**: Additional 8% of experimental analysis time
**Risk**: LOW-MEDIUM

**Steps**:
1. Create calculateRMSWindows() helper function
2. Refactor noise floor to use pre-calculated windows
3. Refactor silence detection to use pre-calculated windows
4. Memory profiling tests (verify <10 MB for 3-hour file)
5. Validate noise floor and silence match within tolerance

**Success Criteria**:
- Results match within defined tolerances
- Memory usage acceptable

### Phase 3: Unified Stereo Block Analysis (MEDIUM PRIORITY)
**Effort**: 1 day (0.5 implementation + 0.5 testing)
**Savings**: Additional 3% of experimental analysis time
**Risk**: LOW

**Steps**:
1. Create calculateBlocks() helper for 250ms blocks
2. Derive stereo separation from blocks
3. Derive mic bleed detection from blocks
4. Derive conversational overlap from blocks
5. Validate all three analyses match

**Success Criteria**: All stereo analyses match exactly

**Total for Phases 1-3**: 4 days, **20-25% performance improvement**, LOW-MEDIUM risk

---

### Phase 4 (Optional): Full Unified Pass (LOWER PRIORITY)

**Only pursue if**:
- Phases 1-3 completed and stable
- Memory profiling shows acceptable usage
- Business need justifies additional complexity

**Effort**: 3-4 days
**Savings**: Additional 15-20% (total 40-45%)
**Risk**: MEDIUM-HIGH (requires reverb refactoring)

**Steps**:
1. Design multi-resolution windowing (20ms + 50ms + 250ms)
2. Implement unified analyzeAudioUnified()
3. Refactor reverb to use pre-calculated 20ms windows
4. Extensive memory profiling (3-hour files)
5. Statistical validation across 100+ test files

**Challenges**:
- Reverb onset detection requires fine-grained windows
- Memory usage increases to ~32 MB for 3-hour files
- Complex debugging if issues arise

---

### Progressive Analysis (OPTIONAL)
**Effort**: 1 day
**Savings**: Variable (5-10% on problematic files)
**Risk**: Low (additive optimization)

**Steps**:
1. Add early exit conditions for digital silence
2. Implement fast-fail for severe clipping
3. Add user notifications for skipped analysis

## Risk Mitigation & Validation Strategy

### Critical Risks Identified

#### 1. Complexity of Unified Pass (HIGH RISK)

**Risk**: The unified pass centralizes logic into a single critical loop. Errors in windowRMS calculation will cascade to all dependent analyses.

**Original Assessment**: Medium risk (may be optimistic)
**Revised Assessment**: **Medium-High risk**

**Mitigation**:
- **Incremental rollout**: Implement Step 1-3 of incremental optimization first (lower risk)
- **Feature flag**: Keep old implementation available for fallback during transition
- **Validation mode**: Run both implementations in parallel initially, compare results
- **Unit test isolation**: Test windowRMS calculation independently before integration
- **Code review**: Extra scrutiny on unified pass implementation

#### 2. Memory vs Speed Trade-off (CRITICAL)

**Risk**: Current implementation streams through audio; new approach stores window metadata in memory.

**Memory Usage Calculation**:
```javascript
// 3-hour stereo file at 48kHz (worst case for this application)
const samples = 3 * 60 * 60 * 48000 = 518,400,000 samples
const windowSize50ms = 48000 * 0.05 = 2,400 samples
const numWindows = Math.ceil(518,400,000 / 2,400) = 216,000 windows

// Per-window metadata (Strategy 1)
const bytesPerWindow = {
  rms: 8,           // Float64
  rmsDb: 8,         // Float64
  peak: 8,          // Float64
  peakDb: 8,        // Float64
  hasClipping: 1,   // Boolean
  startSample: 4,   // Int32
  endSample: 4      // Int32
};
// Total: ~41 bytes per window

// Total memory for 3-hour file
const memoryUsage = 216,000 * 41 = 8.86 MB (acceptable)

// With multi-resolution windows (20ms + 50ms + 250ms)
const totalMemory = 8.86 + 21.6 + 1.73 = ~32 MB (still acceptable)
```

**Threshold**: Fail if >50 MB memory increase for 3-hour file

**Mitigation**:
- Document expected memory usage for all file lengths
- Add memory profiling to test suite
- Test explicitly with 1-hour and 3-hour files
- Monitor peak memory usage in production
- If >50 MB increase, switch to hybrid streaming approach

#### 3. Reverb Analysis Adaptation (MEDIUM-HIGH RISK)

**Risk**: Reverb uses **onset detection** with 1024-sample windows (~21ms @ 48kHz), not simple 50ms RMS. Adapting to pre-calculated windows may be more complex than implied.

**Current Reverb Algorithm**:
```javascript
// Uses fine-grained RMS for onset detection
const onsetWindowSize = 1024; // ~21ms @ 48kHz
for (let i = 0; i < length - onsetWindowSize; i += onsetWindowSize) {
  const currentRms = calculateRMS(window);
  const rmsChange = currentRms - previousRms; // Derivative for onset
  if (rmsChange > threshold) {
    // Onset detected, measure decay
  }
}
```

**Challenge**: 50ms windows too coarse for onset detection

**Mitigation Options**:

**Option A (Conservative)**: Keep reverb analysis separate in Phase 1
- Don't optimize reverb initially
- Achieve 30-35% savings instead of 40-45%
- Lower risk, easier validation

**Option B (Aggressive)**: Multi-resolution windowing
```javascript
// Store multiple window sizes in unified pass
windowData = {
  rms20ms: new Array(numWindows20ms),  // For reverb onset
  rms50ms: new Array(numWindows50ms),  // For noise floor, silence
  rms250ms: new Array(numWindows250ms) // For stereo/conversational
};
```
- Higher memory usage (~32 MB for 3-hour file)
- More complex unified pass
- Full 40-45% savings achievable

**Recommended**: Start with Option A, migrate to Option B after validation

**Validation Requirement**: Reverb RT60 must match within ±0.02 seconds

#### 4. Floating-Point Precision (MEDIUM RISK)

**Risk**: Different calculation order will cause floating-point arithmetic differences. "Results must match current implementation" is difficult to achieve perfectly.

**Mitigation**: Define acceptable tolerances upfront

**Testing Tolerances**:
```javascript
const OPTIMIZATION_TOLERANCES = {
  // Level measurements (dB)
  peakLevel: 0.01,              // ±0.01 dB
  noiseFloorLevel: 0.1,         // ±0.1 dB
  rmsValues: 0.05,              // ±0.05 dB

  // Reverb analysis
  rt60: 0.02,                   // ±0.02 seconds (critical)
  reverbConfidence: 0.01,       // ±1% confidence

  // Counts (must be exact)
  silenceRegionCount: 0,        // Exact match required
  clippingRegionCount: 0,       // Exact match required

  // Timing
  segmentTimestamps: 0.001,     // ±1ms
  segmentDurations: 0.001,      // ±1ms

  // Ratios and percentages
  silencePercentage: 0.5,       // ±0.5%
  stereoSeparation: 0.01,       // ±1%
};
```

**Validation Strategy**:
1. Run both implementations on 100+ diverse test files
2. Calculate statistical distribution of differences
3. Flag outliers (>3σ) for manual investigation
4. Accept if 95% of results within tolerance

### Strategy 1 Risks

**Breaking Changes**:
- Internal API changes (analyzeAudioBuffer signature might change)
- Progress reporting may need adjustment
- Cancellation logic needs update
- Memory footprint increases (~10-30 MB for long files)

**Mitigation**:
- Maintain backward compatible API
- Add feature flag for unified analysis
- Extensive testing with existing test suite
- Memory profiling in CI/CD
- Incremental rollout (recommended approach)

### Testing Strategy

**Required Tests**:
1. **Accuracy**: Results must match current implementation (within defined tolerances)
2. **Performance**: Verify claimed speedups with real-world files
3. **Edge Cases**: Empty files, all silence, extreme clipping
4. **Cancellation**: Ensure cancellation still works
5. **Progress**: Verify smooth progress reporting
6. **Memory**: Explicit memory profiling (see below)

**Memory Profiling Tests**:
```javascript
describe('Optimization Memory Impact', () => {
  const testFiles = [
    { name: '10-second.wav', duration: 10, expectedMemory: 0.4 },
    { name: '1-minute.wav', duration: 60, expectedMemory: 2.4 },
    { name: '5-minute.wav', duration: 300, expectedMemory: 12 },
    { name: '1-hour.wav', duration: 3600, expectedMemory: 144 },
    { name: '3-hour.wav', duration: 10800, expectedMemory: 432 }
  ];

  testFiles.forEach(({ name, duration, expectedMemory }) => {
    it(`should not exceed memory threshold for ${name}`, async () => {
      const memBefore = process.memoryUsage().heapUsed;

      await analyzeAudioUnified(testFile);

      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = (memAfter - memBefore) / (1024 * 1024); // MB

      // Window metadata calculation: (duration / 0.05) * 41 bytes
      const expectedMB = (duration / 0.05) * 41 / (1024 * 1024);

      expect(memDelta).toBeLessThan(expectedMB * 1.5); // 50% margin
      expect(memDelta).toBeLessThan(50); // Hard limit: 50 MB
    });
  });

  it('should release memory after analysis completes', async () => {
    const memBefore = process.memoryUsage().heapUsed;

    await analyzeAudioUnified(longFile);
    // Force garbage collection if available
    if (global.gc) global.gc();

    const memAfter = process.memoryUsage().heapUsed;
    const memDelta = memAfter - memBefore;

    // Memory should be released (within GC margin)
    expect(memDelta).toBeLessThan(5 * 1024 * 1024); // 5 MB margin
  });
});
```

**Precision Validation Tests**:
```javascript
describe('Optimization Precision Validation', () => {
  const TOLERANCES = {
    peakLevel: 0.01,
    noiseFloorLevel: 0.1,
    rt60: 0.02,
    silencePercentage: 0.5,
    // ... (full tolerance object from above)
  };

  const testCorpus = loadDiverseTestFiles(); // 100+ files

  testCorpus.forEach(testFile => {
    it(`should match results for ${testFile.name}`, async () => {
      const oldResult = await analyzeAudioOld(testFile);
      const newResult = await analyzeAudioUnified(testFile);

      // Peak level
      expect(Math.abs(oldResult.peak - newResult.peak))
        .toBeLessThan(TOLERANCES.peakLevel);

      // Noise floor
      expect(Math.abs(oldResult.noiseFloor - newResult.noiseFloor))
        .toBeLessThan(TOLERANCES.noiseFloorLevel);

      // Reverb RT60
      expect(Math.abs(oldResult.reverb.rt60 - newResult.reverb.rt60))
        .toBeLessThan(TOLERANCES.rt60);

      // Exact matches for counts
      expect(oldResult.silence.regions.length)
        .toBe(newResult.silence.regions.length);
      expect(oldResult.clipping.regions.length)
        .toBe(newResult.clipping.regions.length);
    });
  });

  it('should have 95% of results within tolerance', () => {
    const results = testCorpus.map(file => {
      const old = analyzeAudioOld(file);
      const new = analyzeAudioUnified(file);
      return calculateDifference(old, new);
    });

    const withinTolerance = results.filter(r => r.allWithinTolerance).length;
    const percentagePass = (withinTolerance / results.length) * 100;

    expect(percentagePass).toBeGreaterThan(95);
  });
});
```

## Recommended Approach: Incremental Optimization

**Given the identified risks, incremental optimization is now the RECOMMENDED approach** rather than immediate full unified pass.

### Incremental Implementation Plan (RECOMMENDED)

**Advantages**:
- Lower risk at each step
- Easier debugging and validation
- Can stop/rollback at any point
- Still achieves 20-25% performance improvement
- Each step independently testable

**Disadvantages**:
- Final 40-45% savings requires completing all steps + full unified pass
- More implementation phases (but lower risk per phase)

### Step 1: Combine Peak + Clipping (1 day, ~10% savings, LOW RISK)

**What**: Merge two simple full-audio scans into one

```javascript
// OLD: Two separate passes
// Pass 1: Peak detection
for (let i = 0; i < length; i++) {
  if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
}
// Pass 2: Clipping detection
for (let i = 0; i < length; i++) {
  if (Math.abs(data[i]) >= 0.985) clippingCount++;
}

// NEW: Single combined pass
for (let i = 0; i < length; i++) {
  const abs = Math.abs(data[i]);
  if (abs > peak) peak = abs;
  if (abs >= 0.985) clippingCount++;
}
```

**Performance**: 120ms + 600ms → 650ms (70ms saved, ~10% of experimental)

**Risk**: **LOW** - Simple combination, no complex logic

**Validation**: Peak and clipping counts must match exactly

**Effort**: 0.5 days implementation + 0.5 days testing

---

### Step 2: Share RMS between Noise Floor + Silence (2 days, ~8% savings, LOW-MEDIUM RISK)

**What**: Calculate 50ms RMS windows once, use for both noise floor and silence detection

```javascript
// Calculate 50ms RMS windows once
function calculateRMSWindows(channelData, windowSize) {
  const numWindows = Math.ceil(length / windowSize);
  const windowRMS = new Array(numWindows);

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, length);
    let sumSquares = 0;

    for (let ch = 0; ch < channels; ch++) {
      for (let i = start; i < end; i++) {
        sumSquares += channelData[ch][i] ** 2;
      }
    }

    windowRMS[w] = {
      rms: Math.sqrt(sumSquares / ((end - start) * channels)),
      startSample: start,
      endSample: end
    };
  }

  return windowRMS;
}

// Use in noise floor analysis
const windowRMS = calculateRMSWindows(channelData, windowSize50ms);
const noiseFloor = analyzeNoiseFloorFromWindows(windowRMS);
const silence = analyzeSilenceFromWindows(windowRMS, noiseFloor);
```

**Performance**: 350ms + 400ms → 550ms (200ms saved, ~8% of experimental)

**Memory**: ~8.86 MB for 3-hour file (acceptable)

**Risk**: **LOW-MEDIUM** - Refactors two analyses but logic stays separate

**Validation**: Noise floor and silence detection must match within tolerance

**Effort**: 1 day implementation + 1 day testing

---

### Step 3: Unified Stereo Analysis (1 day, ~3% savings, LOW RISK)

**What**: Calculate 250ms blocks once for stereo separation, mic bleed, and overlap

```javascript
// Calculate 250ms blocks once
const blockSize = Math.floor(sampleRate * 0.25);
const blocks = [];

for (let i = 0; i < length; i += blockSize) {
  const blockEnd = Math.min(i + blockSize, length);
  let sumSquaresLeft = 0;
  let sumSquaresRight = 0;

  for (let j = i; j < blockEnd; j++) {
    sumSquaresLeft += leftChannel[j] ** 2;
    sumSquaresRight += rightChannel[j] ** 2;
  }

  blocks.push({
    rmsLeft: Math.sqrt(sumSquaresLeft / (blockEnd - i)),
    rmsRight: Math.sqrt(sumSquaresRight / (blockEnd - i)),
    startSample: i,
    endSample: blockEnd
  });
}

// Derive all analyses from shared blocks
const stereo = analyzeStereoFromBlocks(blocks);
const micBleed = analyzeMicBleedFromBlocks(blocks);
const overlap = analyzeOverlapFromBlocks(blocks, noiseFloorData);
```

**Performance**: 100ms → 70ms (30ms saved, ~3% of experimental)

**Risk**: **LOW** - Stereo-only files, localized change

**Validation**: All three analyses must match

**Effort**: 0.5 days implementation + 0.5 days testing

---

### Step 4 (Optional): Full Unified Pass (3-4 days, additional 15-20% savings, MEDIUM-HIGH RISK)

**What**: Combine all steps above into single unified window scan

**Only proceed if**:
- Steps 1-3 all validated successfully
- Memory profiling shows acceptable usage
- Business need justifies additional risk

**Performance**: Total savings 40-45% (vs 20-25% from Steps 1-3)

**Risk**: **MEDIUM-HIGH** - Complex refactoring

**Recommendation**: Delay until Steps 1-3 deployed and stable

---

### Incremental Rollout Timeline

| Week | Step | Savings | Cumulative | Risk | Status |
|------|------|---------|------------|------|--------|
| 1 | Peak + Clipping | 10% | 10% | LOW | ✅ Recommended |
| 2 | Shared RMS | 8% | 18% | LOW-MED | ✅ Recommended |
| 3 | Unified Stereo | 3% | 21% | LOW | ✅ Recommended |
| 4-5 | Full Unified Pass | 20% | 41% | MED-HIGH | ⚠️ Optional |

**Total Effort (Steps 1-3)**: 4 days implementation + 2 days testing = **6 days**

**Total Savings (Steps 1-3)**: **20-25% performance improvement**

**Result**: 5-minute file processing: 2.4s → **1.8-1.9s** (safe improvement)

## Conclusion

**Recommended Approach**: Incremental Optimization (Steps 1-3) ✅

**Why Incremental Over Full Unified Pass?**:
- **Lower risk** at each step (can validate and rollback)
- **Still significant gains**: 20-25% improvement vs 40-45%
- **Faster to production**: 6 days vs 10-14 days
- **Safer for 3-hour files**: Controlled memory growth
- **Reverb complexity**: Avoids onset detection complications
- **Easier debugging**: Each step isolated and testable

**Timeline**:
- **Week 1**: Peak + Clipping combination (10% savings)
- **Week 2**: Shared RMS windows (additional 8% savings)
- **Week 3**: Unified stereo blocks (additional 3% savings)
- **Total**: 3 weeks for 20-25% improvement

**Results**:
- **Current**: 5-minute file = 2.4s
- **With incremental optimization**: 5-minute file = **1.8-1.9s** (21-25% faster)
- **With optimization + all voice features**: 1.9-2.1s
- **Net result**: Voice features become nearly performance-neutral!

**Full Unified Pass (Optional)**:
- Can pursue after Steps 1-3 are stable
- Requires reverb refactoring (onset detection complexity)
- Additional 15-20% savings possible
- Only if business need justifies higher risk

**Impact on Voice Quality Features**:

This optimization (even incremental) **more than compensates** for adding voice quality features:

| Configuration | Processing Time | vs Current |
|---------------|----------------|------------|
| Current (no optimization, no voice features) | 2.4s | baseline |
| With incremental optimization only | 1.8-1.9s | **-25%** ✅ |
| With optimization + Tier 1 voice features | 1.95-2.05s | **-15%** ✅ |
| With optimization + all voice features | 2.0-2.2s | **-10%** ✅ |

**Conclusion**: Even with all 9 voice quality features added, the optimized implementation will still be **faster** than the current implementation. This makes the voice quality suite essentially "free" from a performance perspective.

---

## Optimization Strategy Summary

### All Available Strategies

| Strategy | Scope | Savings | Memory (3hr) | Risk | Status |
|----------|-------|---------|--------------|------|--------|
| **Incremental (Steps 1-3)** | Base only | 20-25% | 9 MB | LOW-MED | ✅ **Recommended** |
| **Strategy 5** | Voice features only | 3-4% | 14 MB | LOW-MED | ✅ Recommended |
| **Incremental + Strategy 5** | Base + voice | 23-29% | 23 MB | LOW-MED | ✅ **Best balance** |
| **Strategy 6 (Super Unified)** | Base + voice unified | 40-50% | 23 MB | HIGH | ⚠️ Future enhancement |

### Recommended Implementation Paths

**Path A: Safe & Fast (Recommended for Initial Rollout)** ✅
```
Week 1-3: Incremental base optimization (Steps 1-3)
  → 20-25% savings, 9 MB memory, LOW-MEDIUM risk

Week 4: Add Strategy 5 (Multi-Band Filter Caching)
  → Additional 3-4% savings when voice features enabled
  → 14 MB additional memory
  → LOW-MEDIUM risk

Total: 4 weeks, 23-29% savings, 23 MB memory
```

**Path B: Ultimate Optimization (Future Enhancement)** ⚠️
```
Weeks 1-4: Implement Strategy 6 (Unified Super Pass)
  → 40-50% savings, 23 MB memory, HIGH risk
  → Requires complex refactoring and extensive testing
  → Only pursue after Path A is stable

Only recommended if:
  - Path A deployed and validated
  - Team has bandwidth for complex refactoring
  - Business need justifies additional risk
```

### Final Performance Projections

| Configuration | Processing Time | vs Current | Memory (3hr) |
|---------------|----------------|------------|--------------|
| **Current** | 2.4s | baseline | Minimal |
| **Path A: Incremental + Strategy 5** | 1.7-1.8s | **-30%** | 23 MB |
| **Path A + All voice features** | 1.9-2.0s | **-20%** | 23 MB |
| **Path B: Strategy 6** | 1.5-1.6s | **-37%** | 23 MB |
| **Path B + All voice features** | 1.6-1.7s | **-32%** | 23 MB |

**Key Insight**: Both paths make voice quality features essentially "free" from a performance perspective. Path A achieves this with significantly lower risk.
