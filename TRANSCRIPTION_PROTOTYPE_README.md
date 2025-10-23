# Audio Transcription Prototype

A simple CLI tool to test Whisper transcription performance and quality locally.

## Quick Start

### 1. Install Dependencies

```bash
npm install @xenova/transformers
```

### 2. Run the Prototype

```bash
# Transcribe without reference script
node transcription-prototype.js <audio-file>

# Transcribe and compare with reference script
node transcription-prototype.js <audio-file> <script-file>
```

### 3. Examples

```bash
# Just transcribe
node transcription-prototype.js recording.wav

# Transcribe and compare to script
node transcription-prototype.js recording.wav script.txt

# Test with multiple files
node transcription-prototype.js test-audio-1.wav reference-1.txt
node transcription-prototype.js test-audio-2.wav reference-2.txt
```

## What It Tests

### Performance Metrics
- **Processing time**: How long transcription takes (in seconds)
- **Processing speed**: Ratio of audio duration to processing time (higher = faster)
  - Target: ≥0.5x (audio plays back 2x faster than real-time on your machine)
- **File size**: Input audio file size

### Quality Metrics (when reference script provided)
- **String similarity**: Character-level match percentage (fuzzy matching)
  - ≥90%: PASS ✅
  - 80-90%: WARNING ⚠️
  - <80%: FAIL ❌
- **Word accuracy**: Percentage of reference script words found in transcription

## Output

The script produces two outputs:

1. **Console output**: Displays metrics and results to terminal
2. **JSON file**: Saves detailed results as `transcription-results-<timestamp>.json`

Example JSON output:
```json
{
  "timestamp": "2025-10-23T10:30:00.000Z",
  "audioFile": "recording.wav",
  "scriptFile": "script.txt",
  "processingTime": 12.34,
  "estimatedDuration": 45.67,
  "fileSizeMB": 1.23,
  "transcribedText": "...",
  "referenceScript": "...",
  "metrics": {
    "stringSimilarity": 92.5,
    "wordAccuracy": 95.2
  }
}
```

## Testing Recommendations

1. **Test with your real audio samples**
   - Different audio qualities (16-bit, 24-bit)
   - Different durations (30s, 1min, 5min, 10min)
   - Different conditions (clean, background noise, accents)

2. **Document key findings**
   - Processing speed: Is it acceptable?
   - Transcription accuracy: Good matches with your audio?
   - Threshold: Is 90% similarity reasonable for your use case?

3. **Key questions to answer**
   - How does processing speed scale with audio length?
   - Does accuracy drop with background noise?
   - Are there any edge cases or failure modes?

## First Run

The first time you run this, it will download the Whisper model (~200MB). This may take 1-2 minutes depending on your internet speed.

Subsequent runs use the cached model and are much faster.

## Model Details

- **Model**: Whisper-tiny (English)
- **Size**: ~70MB (quantized)
- **Speed**: ~2-4x faster than real-time on modern hardware
- **Accuracy**: Good for most accents and audio qualities

## Notes

- This uses the quantized (smaller, faster) version of Whisper-tiny
- Audio duration estimates are approximate (based on file size)
- Requires Node.js 16+
- Works with: WAV, MP3, M4A, OGG, FLAC, etc.

## Next Steps

After testing and gathering metrics, we'll decide:
1. Is performance acceptable for production?
2. Should we integrate into Audio Analyzer app?
3. Any adjustments needed (different model, threshold, etc.)?
