# Batch Experimental Analysis Options

## Current State
- Batch processing uses header-only analysis (first 100KB) for speed
- Experimental analysis (peak level, noise floor, normalization) only available for single files
- Experimental analysis requires decoding full audio file into AudioBuffer (memory intensive)

## Challenges for Batch Experimental Analysis

1. **Memory**: Decoding multiple large audio files simultaneously
   - 50 files × 20MB each = 1GB+ of decoded audio data
   - Could cause browser memory issues

2. **Time**: Processing takes significant time
   - ~5 seconds per file × 50 files = 4+ minutes
   - Users may not want to wait this long

3. **UI/UX**: Balance between comprehensive analysis and speed

## Implementation Options

### Option A: On-demand Per File
Add individual "Analyze" button in each row that runs experimental analysis on just that file.

**How it works:**
- Each row in batch results table gets an "Experimental" button
- Clicking button runs deep analysis on that specific file
- Show results inline (expand row) or in a modal popup
- Only analyzes files user explicitly requests

**Pros:**
- User controls which files get deep analysis
- Memory usage controlled (one file at a time)
- Fast for users who only need to check a few files

**Cons:**
- Can't batch-process all files at once
- Requires multiple clicks for many files
- Results not immediately comparable in table view

### Option B: Checkbox Before Batch Starts
Add "Include experimental analysis" checkbox in the upload/selection screen.

**How it works:**
- Checkbox appears before starting batch processing
- If checked, processes files sequentially: decode → analyze → discard → next
- Results appear in additional table columns (Peak Level, Noise Floor, Normalization)
- Progress indicator shows current file being analyzed

**Pros:**
- Sequential processing keeps memory low
- Can analyze all files in one operation
- Results immediately visible in table for comparison

**Cons:**
- Much slower initial batch processing (minutes instead of seconds)
- Users can't preview quick results first
- All-or-nothing approach - can't selectively analyze

### Option C: Post-Batch Analysis (Recommended)
Keep fast header analysis as default, add optional "Run Experimental on All" button after results shown.

**How it works:**
1. Initial batch processing shows quick header-based results (current behavior)
2. Results table displays with all current columns
3. Below results, show button: "Run Experimental Analysis on All Files"
4. When clicked, sequentially processes each file:
   - Decode audio buffer
   - Run experimental analysis
   - Update that row with new columns
   - Show progress indicator
   - Discard buffer and move to next
5. Add new columns: Peak Level, Noise Floor, Normalization
6. Allow cancellation mid-process

**Pros:**
- Fast initial results (current speed maintained)
- User chooses if they want deeper analysis
- Can compare experimental metrics across all files in table
- Progressive enhancement approach
- Memory efficient (one file at a time)

**Cons:**
- Two-step process
- Still takes time for large batches
- Need to handle partial completion (some analyzed, some not)

## Additional Considerations

### Variant: Hybrid Approach
- Combine Option A and Option C
- Show "Run Experimental on All" button
- Plus individual "Analyze" buttons per row
- Allows both batch and selective analysis

### Performance Optimizations
- Could use Web Workers for parallel processing (2-3 files simultaneously)
- Implement "smart queue" - prioritize failed/warning files
- Add "Analyze Failed Files Only" option

### UI Enhancements
- Show estimated time remaining during batch experimental
- Add filter to show only files with experimental data
- Export experimental results to CSV/JSON

## Recommendation

**Option C (Post-Batch Analysis)** is the best approach because:
1. Maintains current fast batch processing speed
2. Gives users choice without committing upfront
3. Memory efficient with sequential processing
4. Results easily comparable in table format
5. Can be enhanced with per-file buttons later if needed

## Future Consideration
Once Option C is implemented, could add Option A's per-file buttons as a complementary feature for users who only want to deep-analyze a few specific files.
