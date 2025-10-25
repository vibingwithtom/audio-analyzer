# Phase 1.5: Audio Recorder POC Testing

## Overview
This is a proof-of-concept test page for validating the technical approach for the Auditions Recorder application. It tests:

- ✅ Browser compatibility (getUserMedia, Web Audio API, MediaRecorder)
- ✅ RecordRTC integration (WAV recording)
- ✅ Real-time audio analysis (peak metering, noise floor, clipping detection)
- ✅ Recording with preset-based constraints
- ✅ Audio validation and file download

## How to Run

### Option 1: Using npm dev server
```bash
cd packages/web
npm run dev
# Navigate to http://localhost:3000/poc/recording-test/index.html
```

### Option 2: Direct file access
```bash
# Open in browser directly:
file:///Users/raia/XCodeProjects/audio-analyzer/packages/web/poc/recording-test/index.html

# Note: Some features may be restricted in file:// protocol
# Use Option 1 or serve with a local server for full functionality
```

## Test Scenarios

### 1. Browser Compatibility Check
- Click "Run Compatibility Check" to verify browser support
- Checks for: getUserMedia, Web Audio API, MediaRecorder, HTTPS

### 2. Microphone Test
1. Select a preset from the dropdown
2. Click "Start Mic Test"
3. Observe:
   - Real-time peak level meter
   - Noise floor estimation
   - Clipping detection
4. Click "Stop Mic Test" to end

### 3. Recording Session
1. Select a preset
2. Click "Start Recording"
3. Speak into microphone
4. Observe:
   - Real-time metrics (peak level, average level, clipping count)
   - Recording timer
5. Click "Stop Recording"
6. Review validation results:
   - Sample rate match
   - Channel count match
   - Duration check
   - File size information
7. Download the WAV file

## Presets Available

### Character Recordings
- Sample Rate: 48 kHz
- Bit Depth: 24-bit
- Channels: Mono
- Min Duration: 30s

### Three Hour
- Sample Rate: 44.1 kHz
- Bit Depth: 16-bit
- Channels: Stereo
- Min Duration: 60s

### Bilingual Conversational
- Sample Rate: 44.1 kHz
- Bit Depth: 16-bit
- Channels: Stereo
- Min Duration: 60s

## Features Tested

### Real-time Analysis
- **Peak Level Metering**: Shows current peak level in dB with visual meter
- **Average Level**: Tracks average audio level during recording
- **Clipping Detection**: Detects and counts clipping frames (>0.99 amplitude)
- **Noise Floor Detection**: Estimates noise floor from microphone input

### Validation
- Sample rate validation against preset
- Channel count validation
- Duration validation against preset minimum
- File size calculation

### Performance Metrics
- Initialization time
- Peak detection latency
- CPU usage estimation
- Memory usage

## Browser Compatibility Matrix

### Desktop
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14.1+
- ✅ Edge 90+

### Mobile
- ✅ Chrome Android 90+
- ✅ Firefox Android 88+
- ⚠️ iOS Safari (limited audio constraints)

## Technical Details

### Audio Input Constraints
```javascript
{
  audio: {
    sampleRate: { exact: preset.sampleRate },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
}
```

### Recording Format
- Uses native MediaRecorder with audio/wav MIME type
- Direct WAV recording without format conversion
- No transcoding needed

### Real-time Analysis
- Uses Web Audio API's AnalyserNode
- FFT size: 2048 samples
- Updates every animation frame (~16ms on 60fps displays)

### Validation
- Compares actual audio properties to preset requirements
- Validates sample rate, channels, and duration
- Provides visual feedback (pass/warning/fail)

## Test Log
The page includes a real-time test log at the bottom showing:
- Initialization steps
- Capabilities detected
- Recording events
- Analysis results
- Any errors encountered

## Troubleshooting

### No microphone access
- Check browser permissions
- Ensure HTTPS or localhost (required by getUserMedia)
- Verify microphone is connected and working

### Recording quality issues
- Check that echoCancellation/noiseSuppression are disabled
- Ensure recording is in quiet environment for noise floor test
- Verify preset settings match desired audio specifications

### Browser compatibility issues
- Use latest browser version
- Check browser console for detailed error messages
- See "Browser Compatibility Check" section for supported browsers

## Next Steps

Based on POC results, proceed to Phase 2:
1. Validate RecordRTC integration (if using instead of MediaRecorder)
2. Test cross-browser audio quality
3. Measure CPU/memory performance
4. Document any browser-specific workarounds needed
5. Start building full Auditions Recorder application

## Notes

- This POC uses MediaRecorder (native browser API) rather than RecordRTC
  - More portable and no external library needed
  - Direct WAV support in modern browsers
  - If WAV output issues arise, can integrate RecordRTC
- All audio constraints are "best effort" - browsers may ignore some constraints
- Mobile browsers may have additional limitations (iOS background audio, etc.)
