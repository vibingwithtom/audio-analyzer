# Compact View Mode Implementation Plan

## Overview
Add a toggleable "compact" view mode to ResultsTable.svelte that shows only:
- Filename
- Status badge
- Failure/warning reasons (when status is not "pass")

## Implementation Details

### 1. Add View Mode State
- Add `viewMode` state: `'full' | 'compact'` (default: 'full')
- Store preference in localStorage for persistence

### 2. Add Toggle Button
- Location: Next to fullscreen button in top-right controls
- Icon: Use table/list icons (⊞ for full, ☰ for compact)
- Tooltip: "Toggle compact view"

### 3. Create Helper Function: `getFailureReasons()`
Extract all failures/warnings from a result:
- **Base validation** (always applicable):
  - File type, sample rate, bit depth, channels, duration, filename issues
- **Experimental metrics** (when experimentalMode = true):
  - Clipping, normalization, noise floor, reverb, silence, mic bleed
  - Speech overlap (preset-aware)
  - Stereo type (preset-aware)

Return array of human-readable reasons like:
- "Sample rate: Expected 48000 Hz, got 44100 Hz"
- "Clipping detected: 2.3% of samples clipped"
- "Reverb: Very Poor (1.5s RT60)"
- "Mic bleed: Detected in 5 blocks"

### 4. Render Compact View
When `viewMode === 'compact'`, render simplified table:
```
┌─────────────────────┬──────────┬───────────────────────────┐
│ Filename            │ Status   │ Issues                    │
├─────────────────────┼──────────┼───────────────────────────┤
│ audio1.wav          │ ✓ Pass   │                           │
│ audio2.wav          │ ⚠ Warn   │ • Clipping: 0.5%         │
│                     │          │ • Reverb: Poor (0.9s)    │
│ audio3.wav          │ ✗ Fail   │ • Sample rate: 44100 Hz  │
│                     │          │ • Bit depth: 16-bit      │
└─────────────────────┴──────────┴───────────────────────────┘
```

### 5. Styling
- Maintain existing color coding (pass/warning/fail rows)
- Issues column: Bullet list, smaller font, color-coded by severity
- Responsive: Stack issues vertically on mobile

### 6. Svelte Playground Prototype
Create standalone demo with sample data showing:
- Pass example (no issues)
- Warning example (clipping, reverb)
- Fail example (validation failures)
- Mixed example (validation + experimental issues)
- Toggle between full/compact views

## Files to Modify
1. **packages/web/src/components/ResultsTable.svelte**
   - Add viewMode state and toggle
   - Add getFailureReasons() helper
   - Add compact view rendering
   - Update styles

## Testing
- Verify compact view works in both base and experimental modes
- Test with files that have:
  - No issues
  - Only validation failures
  - Only experimental warnings
  - Mixed validation + experimental issues
- Verify localStorage persistence
- Test responsive behavior

## Prototype First
Build Svelte playground version to validate UX before implementing in actual codebase.
