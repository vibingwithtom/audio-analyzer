# Phase 1.5 POC Testing Guide

**Last Updated**: October 25, 2025
**Status**: Ready for Manual Testing

---

## Quick Start

### Option 1: Run Development Server (Recommended)
```bash
cd packages/web
npm run dev
# Open: http://localhost:3000/poc/recording-test/
```

### Option 2: Direct File Access
```bash
# Open in browser:
file:///Users/raia/XCodeProjects/audio-analyzer/packages/web/poc/recording-test/index.html
# Note: Some features may be limited with file:// protocol
```

---

## Testing Workflow

### Phase 1: Initial Browser Check (5 minutes)
1. **Open POC page** in target browser
2. Click **"Run Compatibility Check"** button
3. **Record results** in PHASE_1.5_TECHNICAL_REPORT.md:
   - Browser name and version
   - All detected capabilities (4 should show ✓)
   - Any warnings or errors

**Pass if**: All 4 capabilities show green checkmarks

---

### Phase 2: Microphone Test (10 minutes)

**Environment**: Quiet room, normal speaking voice

1. **Select preset**: "Character Recordings" (first option)
2. **Click** "Start Mic Test"
3. **Wait** 2-3 seconds for initialization
4. **Observe** the real-time meters:
   - Peak meter shows current input level
   - Noise floor value appears
   - Clipping status remains "Clean"
5. **Speak** at normal volume for 5 seconds
6. **Note readings**:
   - Peak level during speech: `-20` to `-10` dB (typical)
   - Noise floor: `-65` to `-50` dB (depending on environment)
   - Clipping: Should be "Clean"
7. **Click** "Stop Mic Test"

**Pass if**:
- ✅ Meters update smoothly without freezing
- ✅ Noise floor value is reasonable
- ✅ Peak meter responds to sound
- ✅ No errors or crashes
- ✅ Initialization time < 1 second

---

### Phase 3: Full Recording Session (20 minutes)

**Equipment**: Microphone, headphones (optional)
**Content**: Read any text for 30+ seconds
**Environment**: Quiet room, consistent volume

#### Step 1: Start Recording
1. **Select preset**: "Character Recordings"
2. **Click** "Start Recording"
3. **Verify** recording started:
   - Timer should show "00:00" and counting up
   - "Start Recording" button disabled
   - Real-time metrics visible
   - Initialization time logged

#### Step 2: Record Audio (30+ seconds)
1. **Read test text** at normal speaking volume:
   ```
   "This is a test recording for the Auditions Recorder application.
   Please speak at a normal volume and maintain consistent distance
   from the microphone. This recording will be used to validate
   the audio quality and capture settings."
   ```
2. **Observe during recording**:
   - Peak meter updates smoothly
   - Average level tracks speech volume
   - Clipping count remains 0 (no loud peaks)
   - Timer increments properly
3. **Duration**: Record for at least 30 seconds

#### Step 3: Stop Recording
1. **Click** "Stop Recording" button
2. **Wait** for analysis to complete (< 2 seconds)
3. **Review results** section appearing with:
   - Duration: Should show ~30+ seconds
   - Sample Rate: Should show "48.0 kHz" (exact)
   - Bit Depth: Should show "24-bit"
   - Channels: Should show "Mono"
   - File Size: Should show ~4.3 MB for 30 seconds

#### Step 4: Validate Results
1. **Check validation cards**:
   - ✅ Sample Rate Match = PASS
   - ✅ Channels Match = PASS
   - ✅ Duration Check = PASS
2. **Download file**:
   - Click "📥 Download Recording" button
   - File saves as `recording-[timestamp].wav`
3. **Test playback**:
   - Open downloaded file in audio player
   - Should play cleanly without distortion
   - Should sound like your recorded voice
   - Duration should match shown value

**Pass if**:
- ✅ Recording initializes quickly (< 1 sec)
- ✅ Real-time metrics display smoothly
- ✅ Timer counts correctly
- ✅ Recording stops cleanly
- ✅ Analysis completes successfully
- ✅ All validation checks pass
- ✅ Downloaded file plays correctly
- ✅ Audio quality is clear

---

### Phase 4: Preset Testing (15 minutes per preset)

**Test each preset** using same procedure as Phase 3:

#### Preset 1: Character Recordings (48kHz, 24-bit, Mono)
- Expected Sample Rate: 48.0 kHz
- Expected Bit Depth: 24-bit
- Expected Channels: Mono
- Min Duration: 30s

#### Preset 2: Three Hour (44.1kHz, 16-bit, Stereo)
- Expected Sample Rate: 44.1 kHz
- Expected Bit Depth: 16-bit
- Expected Channels: Stereo
- Min Duration: 60s
- **Note**: Use stereo microphone or recording won't show stereo

#### Preset 3: Bilingual (44.1kHz, 16-bit, Stereo)
- Expected Sample Rate: 44.1 kHz
- Expected Bit Depth: 16-bit
- Expected Channels: Stereo
- Min Duration: 60s

---

### Phase 5: Noise & Clipping Tests (10 minutes)

#### Test 5a: Noise Floor Detection
**Environment**: Noisy room (TV on, traffic sounds, etc.)

1. **Select preset**: Character Recordings
2. **Start Mic Test**
3. **Check noise floor value**:
   - Normal: -65 dB or lower
   - Noisy: -50 to -60 dB
   - Very noisy: -40 dB or higher
4. **Note**: Higher (less negative) values indicate more noise

**Pass if**:
- ✅ Noise floor reading changes with environment
- ✅ Value is accurate relative to room noise

#### Test 5b: Clipping Detection
**Content**: Shout or speak very loudly

1. **Start Recording**
2. **Shout** into microphone at close distance
3. **Check clipping count**: Should increment
4. **Review results**: Look for clipping warning

**Pass if**:
- ✅ Clipping count increases when audio peaks
- ✅ Visual indicator appears in results
- ✅ Detection is responsive (within 1-2 frames)

---

### Phase 6: Browser Compatibility (2-3 hours)

**Test on each browser** using Phase 3 (Full Recording) procedure:

#### Desktop Browsers
| Browser | Version | Start Test | Record | Download | Status |
|---------|---------|-----------|--------|----------|--------|
| Chrome  | Latest  | [ ]       | [ ]    | [ ]      | [ ]    |
| Firefox | Latest  | [ ]       | [ ]    | [ ]      | [ ]    |
| Safari  | Latest  | [ ]       | [ ]    | [ ]      | [ ]    |
| Edge    | Latest  | [ ]       | [ ]    | [ ]      | [ ]    |

#### Mobile Browsers
| Browser | Device | Version | Record | Download | Status |
|---------|--------|---------|--------|----------|--------|
| Chrome  | Android | Latest | [ ]    | [ ]      | [ ]    |
| Safari  | iPhone | Latest | [ ]    | [ ]      | [ ]    |

**For each browser, test**:
- ✅ Capability check runs
- ✅ Microphone access dialog appears
- ✅ Recording initializes
- ✅ Real-time meters display
- ✅ Recording stops cleanly
- ✅ File downloads
- ✅ No crashes or errors

---

### Phase 7: Error Handling (10 minutes)

#### Error Test 1: Deny Microphone Permission
1. **Start Mic Test**
2. **Click "Block"** or "Deny" when browser asks for permission
3. **Verify**: Error message appears, no crash
4. **Log error**: Note the message quality

#### Error Test 2: Unsupported Browser (if applicable)
1. **Open POC** in old browser (e.g., Safari 12)
2. **Check capabilities**: Should show multiple failures
3. **Verify**: Clear warning message displayed

#### Error Test 3: HTTPS Requirement
1. **Open using** `file://` protocol instead of http
2. **Try to start recording**
3. **Check**: Appropriate error if protocols aren't supported

---

## Data Collection

### Real-time Metrics to Record

During each recording session, note:

1. **Initialization Metrics**:
   - Time to getUserMedia access: _____ ms (target: < 500ms)
   - Time to AudioContext creation: _____ ms (target: < 100ms)
   - Total initialization: _____ ms (target: < 1000ms)

2. **Recording Metrics**:
   - Peak level (normal speech): _____ dB (target: -20 to -10 dB)
   - Average level: _____ dB
   - Clipping frames detected: _____ (target: 0)
   - Recording duration: _____ seconds

3. **File Output**:
   - File size: _____ MB
   - Playback quality: _____ (excellent/good/fair/poor)
   - Format validation: _____ (pass/fail)

### Performance Notes
- CPU usage during recording: _____ %
- Memory increase during session: _____ MB
- Any stuttering or lag: Yes / No
- Browser became unresponsive: Yes / No

---

## Troubleshooting During Testing

### Issue: "Microphone permission not granted"
**Solution**:
- Refresh page, try again
- Check browser settings for microphone permission
- Verify microphone is connected
- Try different browser

### Issue: "Sample Rate Mismatch"
**Solution**:
- Browser may not honor exact sample rate request
- This is browser-dependent behavior
- Note in report as "best effort"
- Try different browser or preset

### Issue: "No audio in recording"
**Solution**:
- Check microphone is not muted
- Check volume levels in system
- Ensure quiet room (noise floor test helps)
- Try different microphone

### Issue: "File won't download"
**Solution**:
- Check browser download settings
- Try different browser
- Check browser console for errors
- May be browser security restriction

### Issue: "Page freezes during recording"
**Solution**:
- Try shorter recording (10 seconds instead of 30)
- Close other applications
- Check browser console for JS errors
- Try different browser

### Issue: "Playback has crackling/distortion"
**Solution**:
- Microphone may be too loud (clipping)
- Try recording at lower volume
- Check for background noise
- Verify microphone isn't damaged

---

## Reporting Results

### After Each Test Session
1. **Update PHASE_1.5_TECHNICAL_REPORT.md** with findings
2. **Record Pass/Fail** for each criterion
3. **Note any issues** in the "Known Issues" section
4. **Update browser compatibility matrix**

### Final Report Should Include
- ✅ All test cases documented
- ✅ Browser compatibility matrix completed
- ✅ Performance metrics collected
- ✅ Error scenarios tested
- ✅ Recommendations for Phase 2
- ✅ Known limitations documented
- ✅ Sign-off on Phase 1.5 readiness

---

## Expected Outcomes

### Successful Phase 1.5 Should Demonstrate
1. **Recording Works**: WAV files recorded at correct specs
2. **Real-time Analysis Works**: Meters update smoothly
3. **Browser Support**: Works on modern browsers (Chrome, Firefox, Safari)
4. **File Quality**: Downloaded files are valid and playable
5. **Error Handling**: Graceful failures with helpful messages
6. **Performance**: No noticeable lag or CPU spikes

### Decision Points
- **If all tests pass**: ✅ Proceed to Phase 2
- **If some tests fail**: ⚠️ Document workarounds, proceed to Phase 2
- **If critical features fail**: ❌ May need to reconsider approach (e.g., use RecordRTC)

---

## Notes

- **Test in quiet environment** for accurate noise floor measurements
- **Use quality microphone** for best results (built-in mics are ok)
- **Clear browser cache** between major tests
- **Close other applications** that use audio
- **Record multiple sessions** if possible for consistency
- **Document any issues** immediately for troubleshooting

---

## Time Estimates

| Phase | Time | Status |
|-------|------|--------|
| Phase 1: Initial Check | 5 min | Pending |
| Phase 2: Mic Test | 10 min | Pending |
| Phase 3: Full Recording | 20 min | Pending |
| Phase 4: Preset Testing | 45 min | Pending |
| Phase 5: Noise/Clipping | 10 min | Pending |
| Phase 6: Browser Compat | 2-3 hrs | Pending |
| Phase 7: Error Handling | 10 min | Pending |
| **Total** | **3-4 hours** | **Pending** |

---

## References

- POC Page: `packages/web/poc/recording-test/index.html`
- README: `packages/web/poc/recording-test/README.md`
- Technical Report: `packages/web/poc/PHASE_1.5_TECHNICAL_REPORT.md`
- Feature Branch: `feature/phase-1.5-poc`
- Dev Server: `http://localhost:3000/poc/recording-test/`
