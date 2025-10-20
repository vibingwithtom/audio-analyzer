# Optimize Download Chunk Size for Header-Only Analysis

## Overview
Reduce the HTTP Range request download size from 100KB to 10-20KB for audio-only, full, and filename-only analysis modes. This targets header-only analysis that doesn't need full audio content.

## Rationale
- **Current size**: 102,400 bytes (100KB) per file
- **Actual needed**: 1-5KB for WAV header parsing (sample rate, bit depth, channels, duration)
- **100KB is 20-100x overkill** for extracting metadata

## Performance Impact at Scale
- **Batch processing 100 WAV files**:
  - Current: ~10MB total download
  - Optimized: ~1-2MB total download
  - **Savings: 80-90% bandwidth reduction**

- **Individual file download**:
  - Current: 100ms+ for HTTP Range request
  - Optimized: Faster network request, same processing time
  - **Savings: Faster for users on slow/metered connections**

## Files to Modify
1. `packages/web/src/google-auth.js` (line 343)
   - Current: `bytesLimit = 102400`
   - Change to: `bytesLimit = 20480` (20KB conservative) or `10240` (10KB minimum safe)

2. `packages/web/src/box-auth.js` (line 281-282)
   - Same parameter update

3. `packages/core/batch-processor.js` (line 14)
   - Update documentation/comments if any reference 100KB

## What Data is Actually Needed
WAV header parsing extracts:
- **RIFF header** (4 bytes)
- **WAVE format** (4 bytes)
- **fmt chunk** with audio properties (8-64 bytes depending on format)
- **Data chunk size** (8 bytes)
- **Metadata chunks** (LIST, INFO, etc.) - rare, typically <10KB

**Total: 60 bytes minimum, rarely >10KB in practice**

## Safe Recommendations
| Size | Rationale | Risk |
|------|-----------|------|
| 10KB (10,240 bytes) | Handles standard WAV + metadata | Very low - covers all realistic cases |
| 20KB (20,480 bytes) | Extra buffer for unusual metadata | Minimal - maximum safety |
| 50KB (51,200 bytes) | 50% reduction, maximum safety | None - still 50% improvement |

## Implementation Strategy
- [ ] Research if any edge cases need more than 10-20KB (test with large metadata WAV files)
- [ ] Update google-auth.js with new chunk size
- [ ] Update box-auth.js with new chunk size
- [ ] Run full test suite to verify no regressions
- [ ] Deploy to beta and manually test batch processing
- [ ] Monitor for any file parsing issues

## Testing Checklist
- [ ] Batch process 50+ WAV files with various bit depths/sample rates
- [ ] Verify all metadata extracted correctly (sample rate, channels, bit depth, duration)
- [ ] Test with WAV files containing metadata chunks (LIST chunks)
- [ ] Verify filename validation still works for "full" mode
- [ ] Confirm no performance regression (should be same or faster)

## Notes
- **Does NOT affect experimental mode** - still downloads full file for peak detection, noise floor, reverb analysis
- **Does NOT affect non-WAV formats** - still downloads full file for MP3/FLAC (Web Audio API requirement)
- **Audio playback unaffected** - only header-only analysis, not audio preview
