# Enforce File Type Validation Based on Preset Criteria

## Overview
Implement file type validation against preset-defined allowable file types. Currently, presets specify allowed file types (WAV, MP3, FLAC, etc.), but the application doesn't enforce this during batch processing. Files that don't match the preset criteria should be rejected with clear error messages before processing attempts to download or analyze them.

## Problem
- **Presets already define** allowable file types (e.g., WAV-only for many presets)
- **No validation occurs** - app attempts to download and process any file regardless of type
- **Performance impact**: For audio-only analysis, non-WAV files trigger full-file downloads (unnecessary overhead)
  - WAV files: 10-100KB download (header-only)
  - MP3 files: 50-200MB download (full file required for Web Audio API)
  - FLAC files: 100-500MB download (full file required)
  - **Solution: Don't download non-WAV files if preset only allows WAV**

## Current Preset File Type Definitions
**All built-in presets are WAV-only. Non-WAV files are only possible with the Custom preset.**

Built-in presets (always WAV-only):
- Auditions preset: WAV only
- Character Recordings preset: WAV only
- P2B2 Pairs preset: WAV only
- Three Hour preset: WAV only
- Bilingual Conversational preset: WAV only

Custom preset:
- User can configure custom criteria and potentially allow non-WAV formats
- This is the only scenario where non-WAV files might be selected

## Why This Matters
- **Built-in presets**: No validation needed, users can never select non-WAV
- **Custom preset**: Should validate against user-configured file types
- **Performance impact**: Only relevant if custom preset user tries to batch process mixed file types

## Proposed Changes

### 1. Validation Logic (Built-in vs Custom Presets)

**For built-in presets** (Auditions, Bilingual, Three Hour, etc.):
- No validation needed - always WAV-only
- All files allowed to proceed to download

**For Custom preset**:
- Read configured file types from preset
- Before attempting download, check file extension against allowed types
- **If not allowed**: Mark file as rejected with reason "File type not supported by this preset"
- **If allowed**: Proceed with download

### 2. During File Discovery (Google Drive, Box, Local)
Before attempting download:
- Check if using Custom preset
- If Custom: validate file extension against preset's configured allowable types
- If built-in: skip validation (always allows WAV)
- **If file rejected**: Mark as rejected and show reason
- **If file allowed**: Proceed with download (optimized based on type)

### 3. Error Display
Show rejected files clearly in UI (when using Custom preset with mixed file types):
```
❌ document.pdf - Not supported: Custom preset only accepts WAV, MP3, FLAC
❌ song.aac - Not supported: Custom preset only accepts WAV, MP3, FLAC
✓ audio.wav - Processing
✓ music.mp3 - Processing (full download required)
```

### 4. Analysis Mode Implications

**Built-in presets** (always WAV-only):
- No file type validation needed
- All files pass through

**Custom preset** (configurable file types):
- Validation applies consistently across all analysis modes
- Downloads are optimized by file type:

| Mode | WAV | MP3 | FLAC | Other | Behavior |
|------|-----|-----|------|-------|----------|
| audio-only | ✓ 10-20KB | ✗ Reject | ✗ Reject | ✗ Reject | If configured to allow MP3: Download full |
| filename-only | ✓ No DL | ✗ Reject | ✗ Reject | ✗ Reject | Validation still applied |
| full | ✓ 10-20KB | ✗ Reject | ✗ Reject | ✗ Reject | If configured to allow MP3: Download full |
| experimental | ✓ Full | ✗ Reject | ✗ Reject | ✗ Reject | If configured to allow MP3: Download full |

**Key point**:
- Built-in presets never trigger validation (always WAV)
- Custom preset validation prevents downloading unsupported file types
- For MP3/FLAC in Custom preset, full downloads are needed (Web Audio API requirement)

## Files to Modify
Implementation targets Custom preset validation (built-in presets don't need changes):

1. **GoogleDriveTab.svelte** (lines ~1400+)
   - In batch processing loop, before download
   - Check if using Custom preset
   - If Custom: validate file extension against preset's configured `allowedFileTypes`
   - If file not allowed: skip and add to results as rejected

2. **BoxTab.svelte** (lines ~1400+)
   - Same validation logic as GoogleDriveTab

3. **LocalFileTab.svelte** (lines ~700+)
   - In file input handler
   - Check if using Custom preset
   - If Custom: filter files to only those matching allowedFileTypes

4. **Preset management** (where Custom preset is defined)
   - Verify Custom preset object has `allowedFileTypes` property
   - Example: `{ name: 'Custom', allowedFileTypes: ['wav', 'mp3', 'flac'], ... }`

5. **Error handling**
   - Display rejected files with reason: "File type not supported by this preset"
   - Show which file types are allowed

## Implementation Strategy

### Step 1: Create File Type Validator Helper
Add to batch-processor.js or utils:
```javascript
function isFileTypeAllowed(filename, allowedFileTypes) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return allowedFileTypes.includes(ext);
}
```

### Step 2: Add Validation to GoogleDriveTab
In batch processing loop (before downloading):
```javascript
// Only validate if using Custom preset
if ($currentPresetId === 'custom') {
  const preset = presets['custom'];
  if (!isFileTypeAllowed(filename, preset.allowedFileTypes)) {
    results.push({
      filename,
      status: 'rejected',
      reason: `File type not supported. This preset accepts: ${preset.allowedFileTypes.join(', ')}`
    });
    continue;
  }
}
// Proceed with download
const file = await downloadFile(fileId, ...);
```

### Step 3: Add Validation to BoxTab
Same pattern as GoogleDriveTab

### Step 4: Add Validation to LocalFileTab
In file input handler:
```javascript
// Only filter if using Custom preset
let filesToProcess = Array.from(files);
if ($currentPresetId === 'custom') {
  const preset = presets['custom'];
  filesToProcess = files.filter(f => isFileTypeAllowed(f.name, preset.allowedFileTypes));
  if (filesToProcess.length < files.length) {
    // Show: "N files skipped - file type not supported by preset"
  }
}
```

### Step 5: Update Results Display
- Show rejected files with reason including allowed types
- Count rejected vs processed files
- Example: "✓ 40 processed | ✗ 5 rejected (unsupported file type)"

## Edge Cases to Consider
- [ ] **Extensions in uppercase** (.WAV vs .wav) - HANDLED by `.toLowerCase()`
- [ ] **Files without extensions** - Should be rejected since they don't match `.wav`
- [ ] **Misnamed files** (e.g., .mp3 file with WAV header) - Will be rejected by name, but if it passes and is downloaded, WAV parser will catch it
- [ ] **Case sensitivity on different OS** - Handle with `.toLowerCase()`
- [ ] **User tries to process non-WAV during import** - Filter out early in local file handler

## Performance Benefits

**Scenario: User with Custom preset configured for WAV-only, batch processing mixed folder:**

**Current behavior** (no validation):
- Attempts to download all files regardless of type
- 50 WAV files: 50 × 20KB = 1MB download ✓
- 30 MP3 files: 30 × 100MB = 3GB download (fails on audio parsing) ✗
- 20 other files: 20 × variable = additional bandwidth ✗
- **Total: 3GB+ wasted, many download errors, user frustrated**

**Optimized behavior** (with validation):
- Checks file types before downloading
- 50 WAV files: 50 × 20KB = 1MB download ✓
- 30 MP3 files: Rejected (not in allowedFileTypes), 0 bytes ✓
- 20 other files: Rejected, 0 bytes ✓
- **Total: 1MB download, instant feedback, no errors**
- **Savings: 3GB+ bandwidth saved**

**Benefits**:
- For Custom preset users: Prevents accidental large downloads of unsupported formats
- Batch processing feels responsive: Users see immediately which files won't process
- No mysterious "failed to parse" errors
- Especially important for shared Drive folders with mixed content types

## Testing Checklist
- [ ] **Built-in presets (Auditions, Bilingual, etc.)**: No validation triggers, all files pass through
- [ ] **Custom preset with mixed file types**: Test rejection of non-allowed types
- [ ] **Custom preset configuration**: Verify allowedFileTypes property is read correctly
- [ ] **Each analysis mode** (audio-only, full, experimental, filename-only): Validation applies consistently
- [ ] **All tabs** (GoogleDrive, Box, Local): Same validation logic across all sources
- [ ] **Results display**: Rejected files show reason and allowed types
- [ ] **Error messages**: Clear and indicate which file types are allowed
- [ ] **File without extensions**: Should be rejected if not in allowedFileTypes
- [ ] **Case sensitivity**: Both .wav and .WAV accepted

## Design Decisions
1. **Validation scope**: Only for Custom preset (built-in presets bypass validation - always WAV)
2. **Timing**: Validate before attempting download (fail fast, prevents large unnecessary downloads)
3. **Error reporting**: Show rejected files in results table with allowed file types listed
4. **Extension vs MIME type**: Use file extension (simple, fast) - WAV parser catches misnamed files
5. **Future flexibility**: Structure to support presets with different file type configs when added
6. **Performance priority**: Prevent accidental 3GB+ downloads of unsupported formats for Custom preset users
