# Plosive Clipping Enhancement

**Priority**: Tier 1 - Medium Impact, Very Low Effort
**Estimated Effort**: 0.5 days
**Dependencies**: Existing clipping analysis

## Problem Statement

Current clipping analysis doesn't distinguish between:
- **Plosive clips**: Brief (<20ms) clipping on "p", "b", "t", "k" sounds - common but less severe
- **Sustained clips**: Longer clipping indicating serious gain staging issues - critical problem

This distinction is important for voice recordings where plosive clips are relatively common and often acceptable in moderation, while sustained clipping indicates fundamental recording issues.

## Solution Overview

Enhance existing `analyzeClipping()` to categorize clipping regions by duration. No new analysis needed - just categorization of existing data.

## Technical Specification

### Enhanced Algorithm

**Location**: `packages/core/level-analyzer.js`

**Modify**: `analyzeClipping()` method (already exists at lines 1421-1717)

```javascript
// Add to existing analyzeClipping() return value
async analyzeClipping(audioBuffer, sampleRate, progressCallback = null) {
  // ... existing clipping analysis code ...

  // NEW: Categorize clipping by duration
  const PLOSIVE_DURATION_THRESHOLD = 0.02; // 20ms

  const plosiveClips = allRegions.filter(r => r.duration < PLOSIVE_DURATION_THRESHOLD);
  const sustainedClips = allRegions.filter(r => r.duration >= PLOSIVE_DURATION_THRESHOLD);

  // Calculate severity based on clip types
  let clipSeverity;
  if (sustainedClips.length > 0) {
    clipSeverity = 'critical';  // Any sustained clipping is serious
  } else if (plosiveClips.length > 20) {
    clipSeverity = 'warning';   // Many plosive clips
  } else if (plosiveClips.length > 0) {
    clipSeverity = 'minor';     // Few plosive clips, acceptable
  } else {
    clipSeverity = 'none';      // No clipping
  }

  // Per-channel breakdown
  const perChannelClipTypes = perChannelStats.map(ch => ({
    ...ch,
    plosiveClips: allRegions.filter(r =>
      r.channel === ch.channel && r.duration < PLOSIVE_DURATION_THRESHOLD
    ).length,
    sustainedClips: allRegions.filter(r =>
      r.channel === ch.channel && r.duration >= PLOSIVE_DURATION_THRESHOLD
    ).length
  }));

  return {
    // ... existing return values ...

    // NEW: Clip type categorization
    plosiveClips: plosiveClips.length,
    sustainedClips: sustainedClips.length,
    clipSeverity: clipSeverity,
    plosiveClipRegions: plosiveClips.slice(0, 10),
    sustainedClipRegions: sustainedClips.slice(0, 10),
    perChannelClipTypes: perChannelClipTypes
  };
}
```

### Thresholds

| Metric | None | Minor | Warning | Critical |
|--------|------|-------|---------|----------|
| Sustained Clips | 0 | 0 | 0 | >0 |
| Plosive Clips | 0 | 1-20 | >20 | N/A |

### Return Data Structure

```typescript
interface ClippingAnalysis {
  // ... existing fields ...

  // NEW: Plosive vs sustained categorization
  plosiveClips: number;           // Count of brief clips (<20ms)
  sustainedClips: number;         // Count of longer clips (≥20ms)
  clipSeverity: 'none' | 'minor' | 'warning' | 'critical';
  plosiveClipRegions: Array<ClipRegion>;
  sustainedClipRegions: Array<ClipRegion>;
  perChannelClipTypes: Array<{
    channel: number;
    name: string;
    plosiveClips: number;
    sustainedClips: number;
    // ... other existing fields
  }>;
}
```

## Integration Points

### 1. Type Definitions

**File**: `packages/web/src/types/index.ts`

```typescript
// Update existing ClippingAnalysis interface
export interface ClippingAnalysis {
  // ... existing fields ...

  plosiveClips: number;
  sustainedClips: number;
  clipSeverity: 'none' | 'minor' | 'warning' | 'critical';
  plosiveClipRegions: Array<ClipRegion>;
  sustainedClipRegions: Array<ClipRegion>;
}
```

### 2. UI Display

**File**: `packages/web/src/components/ResultsTable.svelte`

**Enhanced Tooltip**:

```javascript
function getClippingTooltip(result) {
  const clip = result.clippingAnalysis;
  if (!clip) return 'Clipping analysis not available';

  let tooltip = `Clipping Analysis\n`;
  tooltip += `────────────────────\n`;
  tooltip += `Severity: ${clip.clipSeverity}\n`;
  tooltip += `Plosive Clips: ${clip.plosiveClips} (<20ms)\n`;
  tooltip += `Sustained Clips: ${clip.sustainedClips} (≥20ms)\n\n`;

  if (clip.sustainedClips > 0) {
    tooltip += `⚠️ CRITICAL: Sustained clipping detected\n`;
    tooltip += `This indicates gain staging issues.\n\n`;

    tooltip += `Worst Sustained Clips:\n`;
    clip.sustainedClipRegions.slice(0, 3).forEach((region, i) => {
      tooltip += `${i + 1}. ${region.startTime.toFixed(2)}s (${(region.duration * 1000).toFixed(0)}ms)\n`;
    });
  } else if (clip.plosiveClips > 0) {
    tooltip += `Brief plosive clipping detected.\n`;
    if (clip.plosiveClips > 20) {
      tooltip += `Consider using a pop filter.\n`;
    }
  }

  return tooltip;
}
```

**Color Coding**:

```javascript
function getClippingClass(analysis) {
  if (!analysis) return '';

  if (analysis.clipSeverity === 'critical') return 'error';
  if (analysis.clipSeverity === 'warning') return 'warning';
  if (analysis.clipSeverity === 'minor') return 'info';
  return 'success';
}
```

### 3. CSV Export

**Enhanced Columns**:

```javascript
const CLIPPING_HEADERS = [
  'Clipping Severity',
  'Plosive Clips (<20ms)',
  'Sustained Clips (≥20ms)',
  'Total Clipped Samples',
  'Clipped Percentage',
  // ... existing columns
];

function extractClippingData(result) {
  const clip = result.clippingAnalysis;
  if (!clip) return CLIPPING_HEADERS.map(() => 'N/A');

  return [
    clip.clipSeverity || 'N/A',
    clip.plosiveClips || 0,
    clip.sustainedClips || 0,
    clip.clippedSamples,
    formatNumber(clip.clippedPercentage, 2),
    // ... existing fields
  ];
}
```

**Failure Analysis**:

```javascript
// In analyzeFailuresWithRecommendations()
if (result.clippingAnalysis?.sustainedClips > 0) {
  qualityIssues.push({
    type: 'sustained-clipping',
    severity: 'critical',
    message: `${result.clippingAnalysis.sustainedClips} sustained clipping events detected`,
    recommendation: 'Reduce input gain and re-record. Clipped audio cannot be recovered.'
  });
} else if (result.clippingAnalysis?.plosiveClips > 20) {
  qualityIssues.push({
    type: 'plosive-clipping',
    severity: 'warning',
    message: `${result.clippingAnalysis.plosiveClips} brief plosive clips detected`,
    recommendation: 'Use pop filter and reduce gain slightly to prevent plosive clipping'
  });
}
```

## Implementation Phases

### Phase 1: Core Enhancement (2 hours)
- [ ] Modify `analyzeClipping()` return value
- [ ] Add clip categorization logic
- [ ] Add severity calculation
- [ ] Update TypeScript interfaces

### Phase 2: UI & Export (2 hours)
- [ ] Enhance tooltip with clip types
- [ ] Update CSV export columns
- [ ] Update failure analysis
- [ ] Test with sample files

## Testing Strategy

### Test Audio Samples

**Location**: `packages/web/tests/fixtures/voice-quality/clipping/`

1. **plosive-clips-only.wav** - Multiple brief clips, no sustained
   - Expected: clipSeverity = 'minor' or 'warning'
   - Expected: plosiveClips > 0, sustainedClips = 0

2. **sustained-clips.wav** - Longer clipping events
   - Expected: clipSeverity = 'critical'
   - Expected: sustainedClips > 0

3. **mixed-clipping.wav** - Both types
   - Expected: clipSeverity = 'critical' (sustained takes precedence)

4. **no-clipping.wav** - Clean audio
   - Expected: clipSeverity = 'none'

### Unit Tests

```javascript
describe('Clipping - Plosive Enhancement', () => {
  it('should categorize clips by duration');
  it('should mark sustained clips as critical');
  it('should tolerate minor plosive clips');
  it('should warn on excessive plosive clips');
  it('should handle mixed clip types');
});
```

## Success Criteria

- ✅ Correctly categorizes plosive vs sustained clips
- ✅ Sustained clips always marked as critical
- ✅ Clear distinction in UI/export
- ✅ Actionable recommendations for each type
- ✅ No performance impact (uses existing data)
- ✅ Backward compatible (doesn't break existing analysis)

## Performance

- **Processing Time**: 0% increase (post-processing of existing data)
- **Memory**: Minimal (just categorization)

## Future Enhancements

- **Adaptive threshold**: Different thresholds for different sample rates
- **Waveform display**: Visual indication of clip types
- **Clip removal**: Suggest declipping tools for plosive clips
- **Pattern recognition**: Identify which phonemes clip most often
