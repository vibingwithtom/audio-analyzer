# Voice-Optimized Dynamic Range Analysis Implementation Plan

## Executive Summary

This plan outlines the implementation of dynamic range compression detection specifically optimized for **voice/speech audio**. Unlike the original PLR-based approach, this leverages existing voice analysis features and implements voice-specific metrics to accurately detect compression in spoken audio.

## 1. Problem Statement

### Requirements
- Detect dynamic range compression in voice recordings
- Identify over-processed audio that sounds unnatural
- Detect common voice processing artifacts (AGC, limiting, gating)
- Ensure natural, unprocessed voice quality

### Challenges with Voice Audio
- Natural speech contains 30-40% silence (pauses between words/phrases)
- Voice has inherent dynamic patterns (syllables, emphasis, breathing)
- Simple peak-to-RMS ratios fail due to speech intermittency
- Different speakers have different natural dynamic ranges

## 2. Technical Approach

### 2.1 Core Algorithm

Instead of simple PLR (Peak-to-Loudness Ratio), we'll implement **Speech-Weighted Dynamic Range (SWDR)**:

```javascript
SWDR Algorithm:
1. Identify speech segments using existing silence detection
2. Analyze only active speech portions (exclude pauses)
3. Calculate windowed RMS with voice-appropriate windows (50-500ms)
4. Compute percentile-based metrics (P10, P50, P90)
5. Detect voice-specific compression artifacts
```

### 2.2 Voice-Specific Metrics

```javascript
voiceDynamicAnalysis = {
  // Primary Metrics
  speechDynamicRange: number,      // P90-P10 of speech segments only (dB)
  syllabicVariation: number,       // Short-term variation (50ms windows)
  phraseVariation: number,          // Long-term variation (500ms windows)

  // Compression Indicators
  compressionScore: number,         // 0-1, weighted combination
  compressionLevel: string,         // 'none'|'light'|'moderate'|'heavy'

  // Artifact Detection
  artifacts: {
    agcDetected: boolean,           // Auto-gain control pumping
    limitingDetected: boolean,      // Hard limiting on peaks
    gatingDetected: boolean,        // Noise gate chops
    overCompression: boolean        // Unnaturally flat dynamics
  },

  // Detailed Analysis
  perSegmentAnalysis: Array<{
    startTime: number,
    duration: number,
    localDynamicRange: number,
    compressionIndicator: string
  }>,

  // Worst Cases
  mostCompressedSegments: Array<{
    timestamp: number,
    duration: number,
    dynamicRange: number,
    issue: string
  }>
}
```

### 2.3 Threshold Calibration

Based on analysis of natural voice recordings:

| Metric | Natural Speech | Light Compression | Heavy Compression |
|--------|---------------|-------------------|-------------------|
| Speech Dynamic Range | 12-20 dB | 8-12 dB | <8 dB |
| Syllabic Variation | 4-8 dB | 2-4 dB | <2 dB |
| Phrase Variation | 8-15 dB | 5-8 dB | <5 dB |
| Consistency Ratio | 0.3-0.6 | 0.2-0.3 | <0.2 |

## 3. Implementation Details

### 3.1 Phase 1: Core Algorithm (LevelAnalyzer.js)

**Location**: `packages/core/level-analyzer.js`

**New Method**: `analyzeVoiceDynamics()`

```javascript
async analyzeVoiceDynamics(
  channelData,
  channels,
  length,
  sampleRate,
  existingAnalysis,  // Reuse silence detection, noise floor
  progressCallback,
  shouldCancel
) {
  // Progress allocation: 75-85% (10% of total)
  const progressStart = 0.75;
  const progressEnd = 0.85;

  // Step 1: Extract speech segments (reuse silence detection)
  const speechSegments = this.extractSpeechSegments(
    existingAnalysis.silence,
    existingAnalysis.noiseFloor
  );

  // Step 2: Windowed analysis of speech only
  const windowSizes = {
    syllabic: Math.floor(sampleRate * 0.05),  // 50ms
    phrasal: Math.floor(sampleRate * 0.5)     // 500ms
  };

  // Step 3: Calculate voice-specific metrics
  const metrics = await this.calculateVoiceMetrics(
    channelData,
    speechSegments,
    windowSizes,
    progressCallback,
    shouldCancel
  );

  // Step 4: Detect compression artifacts
  const artifacts = this.detectVoiceArtifacts(metrics);

  // Step 5: Generate compression score
  const compressionAnalysis = this.assessVoiceCompression(metrics, artifacts);

  return {
    speechDynamicRange: metrics.dynamicRange,
    syllabicVariation: metrics.syllabicVar,
    phraseVariation: metrics.phrasalVar,
    compressionScore: compressionAnalysis.score,
    compressionLevel: compressionAnalysis.level,
    artifacts: artifacts,
    perSegmentAnalysis: metrics.segments,
    mostCompressedSegments: compressionAnalysis.worstSegments
  };
}
```

**Key Implementation Points**:
- Reuse existing silence detection (don't duplicate work)
- Implement proper cancellation checks
- Update progress callbacks appropriately
- Handle edge cases (very short files, all silence, etc.)

### 3.2 Phase 2: Type Definitions

**Location**: `packages/web/src/types/index.ts`

```typescript
export interface VoiceDynamicAnalysis {
  speechDynamicRange: number;
  syllabicVariation: number;
  phraseVariation: number;
  compressionScore: number;  // 0-1 scale
  compressionLevel: 'none' | 'light' | 'moderate' | 'heavy';
  artifacts: {
    agcDetected: boolean;
    limitingDetected: boolean;
    gatingDetected: boolean;
    overCompression: boolean;
  };
  perSegmentAnalysis: Array<{
    startTime: number;
    duration: number;
    localDynamicRange: number;
    compressionIndicator: string;
  }>;
  mostCompressedSegments: Array<{
    timestamp: number;
    duration: number;
    dynamicRange: number;
    issue: string;
  }>;
  perChannelAnalysis?: Array<{
    channel: number;
    channelName: string;
    speechDynamicRange: number;
    compressionLevel: string;
  }>;
}

// Update AudioResults interface
export interface AudioResults {
  // ... existing fields ...
  voiceDynamics?: VoiceDynamicAnalysis;
}
```

### 3.3 Phase 3: UI Display (ResultsTable.svelte)

**Location**: `packages/web/src/components/ResultsTable.svelte`

**New Column**: "Voice Dynamics"

```javascript
// Helper function for color coding
function getVoiceDynamicsClass(analysis) {
  if (!analysis) return '';

  const level = analysis.compressionLevel;
  if (level === 'heavy') return 'error';
  if (level === 'moderate') return 'warning';
  if (level === 'light') return 'info';
  return 'success';
}

// Tooltip content
function getVoiceDynamicsTooltip(result) {
  const vd = result.voiceDynamics;
  if (!vd) return 'Voice dynamics analysis not available';

  let tooltip = `Voice Dynamic Range: ${vd.speechDynamicRange.toFixed(1)} dB\n`;
  tooltip += `────────────────────\n`;
  tooltip += `Compression Level: ${vd.compressionLevel}\n`;
  tooltip += `Syllabic Variation: ${vd.syllabicVariation.toFixed(1)} dB\n`;
  tooltip += `Phrase Variation: ${vd.phraseVariation.toFixed(1)} dB\n`;

  // Artifact warnings
  if (vd.artifacts.agcDetected) {
    tooltip += `\n⚠️ Auto-Gain Control detected`;
  }
  if (vd.artifacts.limitingDetected) {
    tooltip += `\n⚠️ Hard limiting detected`;
  }
  if (vd.artifacts.gatingDetected) {
    tooltip += `\n⚠️ Noise gate artifacts detected`;
  }

  // Worst segments
  if (vd.mostCompressedSegments?.length > 0) {
    tooltip += `\n\nMost Compressed Segments:\n`;
    vd.mostCompressedSegments.slice(0, 3).forEach(seg => {
      tooltip += `• ${seg.timestamp.toFixed(1)}s: ${seg.dynamicRange.toFixed(1)} dB (${seg.issue})\n`;
    });
  }

  return tooltip;
}
```

**Display Implementation**:
```svelte
<td
  class="voice-dynamics-cell {getVoiceDynamicsClass(result.voiceDynamics)}"
  title={getVoiceDynamicsTooltip(result)}
>
  {#if result.voiceDynamics}
    <div class="primary-value">
      {result.voiceDynamics.speechDynamicRange.toFixed(1)} dB
    </div>
    <div class="compression-level">
      {result.voiceDynamics.compressionLevel}
    </div>
    {#if Object.values(result.voiceDynamics.artifacts).some(v => v)}
      <span class="artifact-badge">⚠</span>
    {/if}
  {:else}
    <span class="na-value">N/A</span>
  {/if}
</td>
```

### 3.4 Phase 4: CSV Export

**Location**: `packages/web/src/utils/export-utils.ts`

**New Columns** (Experimental Mode):
```javascript
const VOICE_DYNAMICS_HEADERS = [
  'Voice Dynamic Range (dB)',
  'Compression Level',
  'Syllabic Variation (dB)',
  'Phrase Variation (dB)',
  'AGC Detected',
  'Limiting Detected',
  'Gating Detected',
  'Over-Compression',
  'Worst Segment Time',
  'Worst Segment DR (dB)'
];

// In extractEnhancedDataRow()
function extractVoiceDynamicsData(result) {
  const vd = result.voiceDynamics;
  if (!vd) {
    return VOICE_DYNAMICS_HEADERS.map(() => 'N/A');
  }

  return [
    formatNumber(vd.speechDynamicRange),
    vd.compressionLevel,
    formatNumber(vd.syllabicVariation),
    formatNumber(vd.phraseVariation),
    vd.artifacts.agcDetected ? 'Yes' : 'No',
    vd.artifacts.limitingDetected ? 'Yes' : 'No',
    vd.artifacts.gatingDetected ? 'Yes' : 'No',
    vd.artifacts.overCompression ? 'Yes' : 'No',
    vd.mostCompressedSegments?.[0]?.timestamp?.toFixed(1) || 'N/A',
    vd.mostCompressedSegments?.[0]?.dynamicRange?.toFixed(1) || 'N/A'
  ];
}
```

### 3.5 Progress Stage Adjustment

**Current Allocation**:
- Peak/Noise/Norm: 0-40%
- Reverb: 40-65%
- Silence: 65-80%
- Clipping: 80-100%

**New Allocation**:
- Peak/Noise/Norm: 0-40%
- Reverb: 40-60%
- Silence: 60-75%
- Voice Dynamics: 75-85%
- Clipping: 85-100%

## 4. Testing Strategy

### 4.1 Unit Tests

**New Test File**: `packages/web/tests/unit/level-analyzer-voice-dynamics.test.js`

```javascript
describe('LevelAnalyzer - Voice Dynamics Analysis', () => {
  describe('Speech Segment Extraction', () => {
    it('should correctly identify speech segments from silence data');
    it('should handle files with no speech');
    it('should handle files with no silence');
  });

  describe('Dynamic Range Calculation', () => {
    it('should calculate correct range for uncompressed voice');
    it('should detect heavy compression');
    it('should ignore silence in calculations');
    it('should handle mono and stereo appropriately');
  });

  describe('Artifact Detection', () => {
    it('should detect AGC pumping patterns');
    it('should identify hard limiting');
    it('should recognize gate chops');
  });

  describe('Progress Reporting', () => {
    it('should report progress between 0.75 and 0.85');
    it('should handle cancellation gracefully');
  });

  describe('Edge Cases', () => {
    it('should handle very short files (<1 second)');
    it('should handle very long files (>1 hour)');
    it('should handle extremely quiet audio');
    it('should handle clipped audio');
  });
});
```

### 4.2 Test Audio Samples

Create test files in `packages/web/tests/fixtures/voice-samples/`:

1. **natural-conversation.wav** - Unprocessed voice, 12-18 dB range
2. **broadcast-voice.wav** - Light compression, 8-12 dB range
3. **over-compressed.wav** - Heavy compression, <6 dB range
4. **agc-artifact.wav** - Voice with AGC pumping
5. **limited-voice.wav** - Voice with hard limiting
6. **gated-voice.wav** - Voice with gate artifacts

### 4.3 Integration Tests

```javascript
describe('Voice Dynamics Integration', () => {
  it('should integrate with existing silence detection');
  it('should not affect pass/fail status in normal mode');
  it('should appear in experimental mode only');
  it('should export correctly to CSV');
  it('should display proper tooltips');
});
```

## 5. Implementation Phases

### Phase 1: Research & Validation (2-3 days)
- [ ] Analyze sample voice files with known compression
- [ ] Validate threshold values with real audio
- [ ] Test algorithm on various voice types
- [ ] Document findings and adjust thresholds

### Phase 2: Core Implementation (3-4 days)
- [ ] Implement `analyzeVoiceDynamics()` in LevelAnalyzer
- [ ] Add speech segment extraction logic
- [ ] Implement windowed analysis algorithms
- [ ] Add compression artifact detection
- [ ] Update progress stages

### Phase 3: UI Integration (2 days)
- [ ] Add TypeScript interfaces
- [ ] Update ResultsTable component
- [ ] Implement color coding logic
- [ ] Create comprehensive tooltips
- [ ] Test UI with various results

### Phase 4: Export & Testing (2 days)
- [ ] Update CSV export headers
- [ ] Implement data extraction
- [ ] Write comprehensive unit tests
- [ ] Create test audio samples
- [ ] Integration testing

### Phase 5: Beta Testing (1-2 days)
- [ ] Deploy to beta environment
- [ ] Test with real user files
- [ ] Gather feedback
- [ ] Adjust thresholds if needed

## 6. Success Criteria

- ✅ Accurately detects compression in voice recordings
- ✅ Distinguishes between natural speech dynamics and processing
- ✅ Identifies common voice processing artifacts
- ✅ Provides actionable feedback to users
- ✅ Integrates seamlessly with existing features
- ✅ Maintains performance (<10% processing time increase)
- ✅ All tests pass (768+ tests)
- ✅ No regression in existing functionality

## 7. Risk Mitigation

### Performance Impact
- **Risk**: Algorithm adds significant processing time
- **Mitigation**: Reuse existing analysis, optimize windowing

### False Positives
- **Risk**: Natural emphasis mistaken for compression
- **Mitigation**: Percentile-based analysis, multiple metrics

### User Confusion
- **Risk**: Complex metrics confuse non-technical users
- **Mitigation**: Simple labels, clear tooltips, detailed docs

## 8. Future Enhancements

- Machine learning model for compression detection
- Preset-specific thresholds
- Compression removal suggestions
- Waveform visualization of dynamic range
- Historical comparison across files
- Integration with cloud validation services

## 9. Key Differences from Original Plan

| Aspect | Original Plan | Voice-Optimized Plan |
|--------|--------------|---------------------|
| Algorithm | Simple PLR (Peak - RMS) | Speech-weighted percentiles |
| Analysis Scope | Entire file | Speech segments only |
| Window Size | 5-10ms | 50-500ms (voice-appropriate) |
| Metrics | Single PLR value | Multiple voice-specific metrics |
| Artifacts | Not addressed | AGC, limiting, gating detection |
| Integration | Standalone | Leverages existing silence detection |
| Thresholds | Generic (8/12 dB) | Voice-calibrated (6-20 dB range) |

## Appendix: Algorithm Pseudocode

```javascript
function analyzeVoiceDynamics(audio, existingAnalysis) {
  // 1. Get speech segments
  speechSegments = [];
  for (segment in audio) {
    if (!isInSilence(segment, existingAnalysis.silence)) {
      speechSegments.push(segment);
    }
  }

  // 2. Window analysis
  syllabicWindows = createWindows(speechSegments, 50ms);
  phrasalWindows = createWindows(speechSegments, 500ms);

  // 3. Calculate RMS for each window
  syllabicRMS = syllabicWindows.map(w => calculateRMS(w));
  phrasalRMS = phrasalWindows.map(w => calculateRMS(w));

  // 4. Percentile analysis
  syllabicDR = percentile(syllabicRMS, 90) - percentile(syllabicRMS, 10);
  phrasalDR = percentile(phrasalRMS, 90) - percentile(phrasalRMS, 10);

  // 5. Artifact detection
  artifacts = {
    agc: detectAGCPattern(phrasalRMS),
    limiting: detectLimiting(audio, speechSegments),
    gating: detectGating(syllabicRMS),
    overCompression: syllabicDR < 2 || phrasalDR < 5
  };

  // 6. Compression score
  score = weightedAverage([
    normalize(syllabicDR, 2, 8),
    normalize(phrasalDR, 5, 15),
    artifacts.count * 0.2
  ]);

  return {
    speechDynamicRange: phrasalDR,
    compressionScore: score,
    compressionLevel: categorize(score),
    artifacts: artifacts
  };
}
```