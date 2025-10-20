# Voice Quality Analysis Features

## Overview

This directory contains specifications for voice-specific audio analysis features optimized for speech and conversation recordings. Unlike music analysis, voice recordings have unique quality requirements focusing on clarity, intelligibility, and professional production standards.

## Why Voice-Specific Analysis?

Since all audio processed by this application is voice/speech (not music), we can optimize analysis to detect:

- **Vocal artifacts** (sibilance, plosives, mouth noise)
- **Frequency balance issues** (proximity effect, lack of clarity)
- **Recording environment** (voice-focused reverb, room tone)
- **Technical quality** (clipping types, breath sounds)

These analyses are specifically tuned for voice characteristics and cannot be effectively applied to music.

## Implementation Status

### Completed
- [x] **Stereo Separation** - Already optimized for conversational audio
- [x] **Mic Bleed Detection** - Voice-specific cross-correlation analysis
- [x] **Speech Overlap Analysis** - Detects simultaneous speech in conversations
- [x] **Silence Detection** - Optimized for voice pauses and breath gaps

### Planned

**Tier 1: High Impact, Low Effort** (Implement First)
- [ ] [01 - Sibilance Detection](01-sibilance-detection.md) - Detects harsh "s", "sh", "ch" sounds
- [ ] [02 - Frequency Balance Analysis](02-frequency-balance-analysis.md) - Detects bass buildup and clarity issues
- [ ] [03 - Plosive Clipping Enhancement](03-plosive-clipping-enhancement.md) - Distinguishes plosive clips from sustained clipping
- [ ] [10 - Processing Detection](10-processing-detection.md) - Detects compression, AGC, limiting for compliance validation

**Tier 2: Good to Have** (Implement When Ready)
- [ ] [04 - Plosive Energy Detection](04-plosive-energy-detection.md) - Detects excessive plosive energy (pre-clipping)
- [ ] [05 - Mouth Noise Detection](05-mouth-noise-detection.md) - Detects lip smacks, tongue clicks, saliva sounds
- [ ] [06 - Breath Sound Analysis](06-breath-sound-analysis.md) - Detects excessive or audible breathing

**Tier 3: Optimizations** (Nice to Have)
- [ ] [07 - Voice-Focused Reverb](07-voice-focused-reverb.md) - Bandpass-filtered reverb analysis for voice

**Tier 2: Advanced Analysis** (Good to Have)
- [ ] [09 - Advanced Noise Floor Analysis](09-advanced-noise-floor-analysis.md) - Room tone separation + denoiser detection

## Priority Matrix

| Feature | Impact | Effort | Performance Impact | Priority | Estimated Time |
|---------|--------|--------|-------------------|----------|----------------|
| 01 - Sibilance Detection | High | Low | 2-4% | 1 | 1-2 days |
| 02 - Frequency Balance | High | Low | 2-3% | 1 | 1-2 days |
| 03 - Plosive Clipping | Medium | Very Low | <0.1% | 1 | 0.5 days |
| 10 - Processing Detection | High | Low | 2-3% | 1 | 2-3 days |
| 04 - Plosive Energy | Medium | Medium | 2-3% | 2 | 2-3 days |
| 05 - Mouth Noise | Medium | High | 4-6% | 2 | 3-4 days |
| 06 - Breath Sounds | Low | Medium | 1-2% | 2 | 2 days |
| 07 - Voice Reverb | Low | Low | ±0% or +5% | 3 | 1 day |
| 09 - Advanced Noise Floor | Medium | Medium | 1-2% | 2 | 2-3 days |

**Total Performance Impact**:
- Tier 1 only: ~8-9% increase
- All features: ~17-27% increase (see [Performance Analysis](PERFORMANCE-ANALYSIS.md) for details)

## Implementation Dependencies

```
Independent (can implement in any order):
├── 01 - Sibilance Detection
├── 02 - Frequency Balance
└── 07 - Voice-Focused Reverb

Sequential (depends on prior features):
├── 03 - Plosive Clipping Enhancement (uses existing clipping analysis)
│   └── 04 - Plosive Energy Detection (builds on plosive detection)
│
├── 05 - Mouth Noise Detection (independent)
├── 06 - Breath Sound Analysis (independent)
├── 09 - Advanced Noise Floor Analysis (enhances existing noise floor + merges denoiser detection)
└── 10 - Processing Detection (aggregates #09 + existing clipping analysis)
```

## Common Integration Patterns

Each voice quality feature follows a consistent architecture:

### 1. Core Analysis (LevelAnalyzer.js)
```javascript
// New method in LevelAnalyzer class
async analyzeFeatureName(audioBuffer, existingAnalysis, progressCallback) {
  // Voice-specific algorithm
  // Progress reporting
  // Cancellation support
  return {
    severity: 'good'|'warning'|'critical',
    metrics: { /* feature-specific data */ },
    issues: [ /* array of detected issues */ ],
    recommendations: [ /* actionable fixes */ ]
  };
}
```

### 2. Type Definitions (types/index.ts)
```typescript
export interface FeatureAnalysis {
  severity: 'good' | 'warning' | 'critical';
  metrics: {
    // Feature-specific metrics
  };
  issues: Array<{
    timestamp: number;
    duration: number;
    level: number;
    description: string;
  }>;
  recommendations: string[];
}
```

### 3. UI Display (ResultsTable.svelte)
- New column in experimental mode
- Color-coded cells (green/yellow/red)
- Detailed tooltips with worst instances
- Per-channel breakdowns where applicable

### 4. CSV Export (export-utils.ts)
- Feature severity column
- Key metrics columns
- Issue counts
- Worst instance timestamps

### 5. Testing
- Unit tests with synthetic test audio
- Integration tests with real samples
- Edge case handling (silent files, extreme values)
- Progress and cancellation tests

## Performance Impact

For detailed performance analysis, see **[PERFORMANCE-ANALYSIS.md](PERFORMANCE-ANALYSIS.md)**.

### Quick Summary

For a typical 5-minute stereo file (current processing: ~2.5 seconds):

| Configuration | Processing Time | Increase |
|---------------|----------------|----------|
| Current (no voice features) | 2.5s | - |
| + Tier 1 (4 features) | 2.72s | +220ms (+9%) |
| + Tier 1 + Breath Sounds | 2.82s | +320ms (+13%) |
| + All Features | 3.0s | +500ms (+20%) |

**Key Takeaways**:
- **Tier 1 features** add minimal overhead (~9%) for maximum value (includes compliance requirement)
- **All features combined** still complete in under 3 seconds
- Features can be **selectively enabled** per preset to control performance
- **Filter caching** can reduce impact by 3-5% (advanced optimization)

### Performance by Tier

| Tier | Features | Combined Impact | Recommendation |
|------|----------|----------------|----------------|
| **Tier 1** | Plosive Clipping, Frequency Balance, Sibilance, Processing Detection | ~8-9% | ✅ Deploy immediately |
| **Tier 2** | Plosive Energy, Mouth Noise, Breath Sounds, Advanced Noise Floor | +9-13% (17-22% total) | Deploy selectively |
| **Tier 3** | Voice Reverb | +0-5% (17-27% total) | Optional enhancement |

## Progress Stage Allocation

Current experimental analysis uses 40-100% of progress:

**Current Allocation**:
```
40-65%  Reverb Analysis (25%)
65-80%  Silence Detection (15%)
80-100% Clipping Analysis (20%)
```

**Proposed with Voice Features**:
```
40-50%  Reverb Analysis (10%)
50-55%  Voice-Focused Reverb [optional] (5%)
55-62%  Silence Detection (7%)
62-67%  Sibilance Detection (5%)
67-72%  Frequency Balance (5%)
72-77%  Plosive Energy (5%)
77-82%  Mouth Noise (5%)
82-85%  Breath Sounds (3%)
85-90%  Processing Detection (5%)
90-95%  Advanced Noise Floor Analysis (5%)
95-100% Clipping Analysis + Plosive Enhancement (5%)
```

**Notes**:
- Optional features skip their progress range if disabled
- Total processing time increase: ~15-25% when all features enabled
- Features can be individually enabled/disabled per preset

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1)
1. **Plosive Clipping Enhancement** (0.5 days)
   - Minimal effort, immediate value
   - Enhances existing clipping analysis

2. **Sibilance Detection** (1-2 days)
   - High impact on voice quality
   - Common issue, easy to detect

3. **Frequency Balance** (1-2 days)
   - Catches proximity effect
   - Simple band energy comparison

4. **Processing Detection** (2-3 days)
   - Client compliance requirement ("no processing allowed")
   - Detects compression, AGC, limiting
   - Aggregates existing detections

### Phase 2: Medium Priority (Week 2-3)
5. **Plosive Energy Detection** (2-3 days)
   - Builds on clipping enhancement
   - Catches pre-clipping plosive issues

6. **Voice-Focused Reverb** (1 day)
   - Low effort optimization
   - More accurate for voice recordings

### Phase 3: Advanced Features (Week 4+)
7. **Mouth Noise Detection** (3-4 days)
   - More complex detection algorithm
   - Requires careful tuning

8. **Breath Sound Analysis** (2 days)
   - Lower priority aesthetic issue
   - Useful for professional recordings

9. **Advanced Noise Floor Analysis** (2-3 days)
   - Merges room tone separation + denoiser detection
   - Voice-optimized artifact detection without FFT
   - Enhances existing noise floor analysis

## Testing Strategy

### Test Audio Samples Required

Create test files in `packages/web/tests/fixtures/voice-quality/`:

**Sibilance**:
- `excessive-sibilance.wav` - Harsh "s" sounds (>-10 dB ratio)
- `normal-sibilance.wav` - Acceptable sibilance (<-15 dB ratio)
- `de-essed.wav` - Processed with de-esser

**Frequency Balance**:
- `proximity-effect.wav` - Too much bass (low/mid > -3 dB)
- `thin-voice.wav` - Lacking bass (low/mid < -20 dB)
- `lacks-clarity.wav` - Dull sound (high/mid < -15 dB)
- `balanced-voice.wav` - Good frequency distribution

**Plosives**:
- `plosive-clips.wav` - Brief plosive clipping (<20ms)
- `sustained-clips.wav` - Sustained clipping (>20ms)
- `excessive-plosives.wav` - Heavy p/b/t/k sounds (no clipping)
- `pop-filtered.wav` - Clean plosives

**Mouth Noise**:
- `lip-smacks.wav` - Audible mouth clicks
- `clean-speech.wav` - No mouth noise

**Breath Sounds**:
- `heavy-breathing.wav` - Audible breaths between words
- `controlled-breathing.wav` - Minimal breath sounds

### Validation Approach

For each feature:
1. **Synthetic Tests**: Generated audio with known characteristics
2. **Real Samples**: Actual voice recordings with documented issues
3. **Edge Cases**: Silent files, extreme values, very short/long files
4. **Regression Tests**: Ensure new features don't break existing analysis

## Success Criteria

Each feature must meet these requirements before release:

- ✅ **Accuracy**: Correctly identifies the issue in test samples
- ✅ **Performance**: Adds <5% to total processing time
- ✅ **Robustness**: Handles edge cases without crashing
- ✅ **UX**: Clear, actionable feedback in UI and exports
- ✅ **Testing**: >95% code coverage with unit + integration tests
- ✅ **Documentation**: Complete API docs and user-facing explanations

## API Conventions

All voice quality features follow these conventions:

### Severity Levels
```javascript
'good'      // No issues detected
'warning'   // Minor issues that may affect quality
'critical'  // Serious issues requiring attention
```

### Timestamp Format
```javascript
{
  timestamp: 12.45,  // seconds from start
  duration: 0.15,    // seconds
  // ... other properties
}
```

### Recommendations
```javascript
recommendations: [
  "Apply de-esser to reduce harsh sibilance",
  "Use pop filter to reduce plosive energy",
  "Apply high-pass filter at 80-100 Hz"
]
```

## Resources

### Frequency Ranges (Voice)
- **Fundamental frequency**: 85-255 Hz (male), 165-255 Hz (female)
- **Voice energy**: 200-3000 Hz (most intelligibility)
- **Clarity/presence**: 2000-8000 Hz
- **Sibilance**: 4000-10000 Hz
- **Plosive energy**: 50-200 Hz

### Thresholds (Industry Standards)
- **Reverb (RT60)**: <0.3s excellent, <0.5s good, <0.8s acceptable
- **Noise floor**: <-60 dB excellent, <-50 dB good, <-40 dB acceptable
- **Sibilance ratio**: <-15 dB good, -15 to -10 dB warning, >-10 dB harsh
- **Breath level**: <noise floor + 15 dB good, >noise floor + 20 dB excessive

## Contributing

When adding new voice quality features:

1. **Follow the template** in existing specs
2. **Include test samples** for validation
3. **Document thresholds** with industry references
4. **Provide recommendations** that are actionable
5. **Update this README** with status and dependencies

## Questions & Discussion

For questions about voice quality analysis:
- Check individual feature specs for technical details
- Review existing voice features (stereo, mic bleed, overlap)
- Refer to industry standards (EBU, ITU, SMPTE)

---

**Last Updated**: 2025-01-18
**Total Features**: 9 planned + 4 existing (includes merged #09, new #10)
**Estimated Total Effort**: 15-21 days for all features

**Note**:
- Feature #09 (Advanced Noise Floor Analysis) merges the original #08 (Room Tone Separation) with denoiser detection from the archived noise floor characterization plan
- Feature #10 (Processing Detection) is a simplified, compliance-focused replacement for the archived voice-dynamic-range-analysis-plan
- See `/docs/archive/README.md` for details on revision rationale
