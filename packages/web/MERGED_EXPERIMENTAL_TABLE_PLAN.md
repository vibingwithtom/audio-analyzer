# Merged Experimental Table - Implementation Plan

## Current State

### Existing Analysis Modes
1. **Filename-Only**: Just filename validation
2. **Audio-Only**: Basic audio properties (File Type, Sample Rate, Bit Depth, Channels, Duration, Peak Level, Normalization)
3. **Full Analysis**: Audio-Only + Filename validation
4. **Experimental Analysis**: Quality metrics only (Peak Level, Normalization, Clipping, Noise Floor, Reverb, Silence, Stereo Separation, Speech Overlap, Mic Bleed)

### The Problem
Experimental Analysis has architectural confusion:
- It's checking `result.status === 'fail'` which conflates:
  - **Validation failures** (wrong file type, low sample rate) - file wasn't analyzed
  - **Quality failures** (excessive silence, high noise floor) - file was analyzed but has issues
- This causes "--" to show for files with valid metrics that should be displayed
- No way to see basic file properties alongside experimental metrics
- Status computation is quality-based but validation-based status is leaking in

## Goal

Create a comprehensive quality analysis table that:
1. Shows ALL metrics (basic + experimental) in one place
2. Respects preset validation as a gatekeeper (wrong file type = no analysis = all "--")
3. Shows actual metric values for analyzed files (even if they fail quality checks)
4. Computes status from ALL metrics (validation + quality)

## Proposed Solution

### Merge Audio-Only + Experimental into "Experimental Analysis" Tab

The new Experimental Analysis table will have these columns:

| Column | Source | Shows "--" When |
|--------|--------|-----------------|
| Filename | Common | Never (always shows filename) |
| Status | NEW | Never (computed from metrics) |
| File Type | Audio-Only | Validation failed |
| Sample Rate | Audio-Only | Validation failed |
| Bit Depth | Audio-Only | Validation failed |
| Channels | Audio-Only | Validation failed |
| Duration | Audio-Only | Validation failed |
| Peak Level | Experimental | Validation failed |
| Normalization | Experimental | Validation failed |
| Clipping | Experimental | Validation failed |
| Noise Floor | Experimental | Validation failed |
| Reverb (RT60) | Experimental | Validation failed |
| Silence | Experimental | Validation failed |
| Stereo Separation | Experimental | Validation failed (or "Mono file" if analyzed) |
| Speech Overlap | Experimental | Validation failed |
| Mic Bleed | Experimental | Validation failed |

**Total: 16 columns**

### Status Computation Logic

```typescript
function computeStatus(result: AudioResults): 'pass' | 'warning' | 'fail' | 'error' {
  // Check if validation failed (file type, sample rate, etc.)
  if (result.validation?.fileType?.status === 'fail') {
    return 'fail'; // Validation failure
  }

  // File passed validation - compute status from ALL metrics (basic + experimental)
  const statuses: string[] = [];

  // Basic property validations
  if (result.validation?.sampleRate?.status) statuses.push(result.validation.sampleRate.status);
  if (result.validation?.bitDepth?.status) statuses.push(result.validation.bitDepth.status);
  if (result.validation?.channels?.status) statuses.push(result.validation.channels.status);

  // Quality metric statuses
  if (result.normalizationStatus) statuses.push(result.normalizationStatus);
  if (result.clippingAnalysis) statuses.push(getClippingSeverity(result.clippingAnalysis).level);
  if (result.noiseFloorDb !== undefined) statuses.push(getNoiseFloorClass(result.noiseFloorDb));
  if (result.reverbInfo) statuses.push(getReverbClass(result.reverbInfo.label));
  // ... etc for other metrics

  // Return worst status
  if (statuses.some(s => s === 'fail' || s === 'error')) return 'fail';
  if (statuses.some(s => s === 'warning')) return 'warning';
  return 'pass';
}
```

### Column Display Logic

For each metric column:

```typescript
// VALIDATION CHECK FIRST
if (result.validation?.fileType?.status === 'fail') {
  // File didn't pass preset validation - wasn't analyzed
  return '--';
}

// FILE WAS ANALYZED - CHECK IF METRIC EXISTS
if (result.metricName !== undefined) {
  // Show actual value (even if it's failing quality check)
  return formatMetric(result.metricName);
}

// METRIC NOT APPLICABLE
return 'N/A'; // or 'Mono file' for stereo separation, etc.
```

**Key principle**: Only check validation failure, NOT `result.status`. The status can be 'fail' due to quality issues while still having valid metrics to display.

## Implementation Steps

### Step 1: Add Basic Columns to Experimental Table Header
- Add File Type, Sample Rate, Bit Depth, Channels, Duration columns
- Add Status column (after Filename)
- Update column order for logical flow

### Step 2: Add Basic Columns to Table Body
- Copy column implementations from standard mode table
- Apply validation-based "--" logic (not status-based)
- Keep red filename for file type validation failures

### Step 3: Update All Experimental Columns
- Ensure ALL experimental columns check `result.validation?.fileType?.status === 'fail'` (not `result.status`)
- This includes fixing columns that were incorrectly checking status first

### Step 4: Implement Status Computation
- Create new function that computes status from ALL metrics
- Use this for the Status column
- Use this for row highlighting (status-pass, status-warning, status-fail classes)

### Step 5: Update ResultsDisplay.svelte
- Remove the early return that preserves validation status
- OR keep it but ensure it only applies when truly no analysis ran
- Ensure experimental results filtering works correctly

### Step 6: Test Edge Cases
- MP3 file in WAV-only preset (should show "--" for all columns)
- WAV file with excessive silence (should show actual silence values + fail status)
- Mono file (should show "Mono file" for stereo separation, not "--")
- Files with missing metrics (should show "N/A")

## Files to Modify

1. **packages/web/src/components/ResultsTable.svelte**
   - Add basic columns to experimental table header
   - Add basic columns to experimental table body
   - Update experimental column logic to check validation instead of status
   - Add status computation function
   - Add Status column

2. **packages/web/src/components/ResultsDisplay.svelte** (maybe)
   - Review getExperimentalStatus() function
   - Ensure it doesn't interfere with new status computation

## Success Criteria

✅ Experimental table shows all 16 columns (basic + experimental)
✅ Files that fail validation (wrong type) show "--" across all metric columns
✅ Files that pass validation but fail quality checks show actual values
✅ Status column reflects worst status across ALL metrics
✅ Red filename only for file type validation failures
✅ Mono files show "Mono file" not "--"
✅ Status summary counts files correctly
✅ Fullscreen mode works with wider table (if merged with other branch)

## Potential Issues

1. **Table width**: 16 columns is very wide
   - Mitigation: Horizontal scroll, sticky columns, fullscreen mode

2. **Performance**: More columns to render
   - Should be fine, already rendering similar data in separate tables

3. **User confusion**: "Experimental Analysis" showing basic properties
   - Could rename to "Comprehensive Analysis" or "Full Quality Analysis"

4. **Column ordering**: What's the best logical flow?
   - Current plan: Filename, Status, File Type, Sample Rate, Bit Depth, Channels, Duration, Peak, Normalization, then quality metrics

## Open Questions

1. Should we rename "Experimental Analysis" to something else?
   - "Comprehensive Analysis"?
   - "Full Quality Analysis"?
   - "Detailed Analysis"?

2. Should Status column be after Filename or at the end?
   - After Filename (sticky with it) seems best

3. Should we add column show/hide toggles for less-used metrics?
   - Could be future enhancement

4. What happens to the other tabs (Audio-Only, Filename-Only, Full Analysis)?
   - Keep them as-is for simpler/faster checks
   - This becomes the "deep dive" option

## Rollback Plan

If the merged table doesn't work out:
- Keep `feature/wider-table-layout` branch (proven improvement)
- Abandon `feature/merged-experimental-table` branch
- Fix the "--" logic issues in current experimental table using validation checks instead of status checks
