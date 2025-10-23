# Transcription Integration Plan

## Overview
Add Whisper transcription + script matching to Audio Analyzer presets. Validated with Whisper-base model (300MB, 6x speed, 90%+ accuracy).

## Matching Scenarios by Preset

### Scenario 1: Known Script Folder (Three Hour Preset)
**Current behavior:** Already provides script folder in filename validation settings
**Enhancement:**
- User already specifies scripts folder location
- Extract script file that matches audio filename
- Single target for matching (1:1)
- **Example:** `audio_script_001.wav` → matches `audio_script_001.txt`

### Scenario 2: Default Script (e.g., Character Recordings)
**Behavior:**
- Preset has a single "standard" or "default" script
- All recordings in this preset follow the same script
- **Example:** All Character Recordings follow "character_recording_template.txt"

### Scenario 3: Multiple Possible Scripts (Bilingual Conversational)
**Behavior:**
- Preset can have 1-5 possible scripts
- User may not know which script they recorded against
- **Need:** Try matching transcription against ALL possible scripts
- Return best match + confidence scores for all
- **Example:**
  - Script A: conversation_opening.txt
  - Script B: conversation_problem_solving.txt
  - Script C: conversation_closing.txt
  - Audio could match any of these

**UI Consideration:** Show user which script matched best with score for each

## Technical Implementation

### Core Logic
```
1. Get transcription from audio
2. Get script(s) to match against based on preset/config
3. For each script:
   - Calculate string similarity (90%+ = PASS)
   - Calculate word accuracy
   - Store results
4. Return:
   - Best matching script
   - Similarity scores for all scripts
   - Overall pass/fail based on best match
```

### Matching Algorithm
- **String similarity:** Levenshtein distance (already working)
- **Threshold:** 90% for PASS (validated in testing)
- **Word accuracy:** Secondary metric (already calculated)

### Configuration in PresetConfig
```typescript
transcriptionConfig?: {
  enabled: boolean;
  scriptSource: 'folder' | 'default' | 'multiple';
  scriptsFolderUrl?: string;  // for Google Drive folder
  defaultScript?: string;      // embedded or path
  possibleScripts?: string[];  // array of script paths/keys
  matchThreshold?: number;     // default 90
}
```

## Testing Findings (Prototype)

### Performance ✅
- **Whisper-base:** 300MB download (cached once)
- **Speed:** 6-16x real-time depending on audio length
- **Chunking:** Handles audio >30 seconds properly (5s overlap)
- **Acceptable for batch processing:** Yes

### Accuracy ✅
- **String similarity:** 90.2% with natural speech variations
- **Word accuracy:** 74.7% (secondary metric)
- **90% threshold:** Appropriate for catching mismatches while allowing natural variations
- **Multiple paragraph transcription:** Works correctly with chunking

### Quality Issues Found & Fixed
- ❌ Whisper-tiny: Hallucination on some audio → Fixed with base model
- ❌ Long audio (>30s) truncation → Fixed with chunking
- ✅ Both issues resolved in current prototype

## Next Steps (Tomorrow)

1. **More Testing** - Different audio samples, languages, preset types
2. **Integration Planning** - How each preset accesses scripts
3. **UI/UX** - Show matching results, allow user to override/verify
4. **Implementation** - Add to core library, integrate with presets

## Open Questions

- Should transcription be optional per preset or always-on?
- How to handle when best match is <90% (show warning)?
- Should we show all matching scores or just best match?
- Where to store/cache transcription results?
- Should users be able to manually provide script if matching fails?
