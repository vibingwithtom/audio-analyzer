# Phase 1.5 POC: Get Started Guide

## 🚀 Quick Start (2 minutes)

### 1. Start the Development Server
```bash
cd packages/web
npm run dev
```

You'll see:
```
VITE v7.1.11 ready in 481 ms

  ➜  Local:   http://localhost:3000/
```

### 2. Open the POC Page
Visit in your browser:
```
http://localhost:3000/poc/recording-test/
```

### 3. You're Ready!
You should see the purple gradient page with:
- Browser Compatibility Check section
- Preset Configuration dropdown
- Microphone Test controls
- Recording Interface
- Results display area

---

## 📋 What to Do Next

### Option A: Quick 5-Minute Test
1. Click **"Run Compatibility Check"** button
2. Select preset and click **"Start Mic Test"**
3. Observe the real-time meters
4. Click **"Stop Mic Test"**
5. Note the results

### Option B: Full Recording Test (15 minutes)
1. Click **"Run Compatibility Check"**
2. Select **"Character Recordings"** preset
3. Click **"Start Recording"**
4. Speak into microphone for 30+ seconds
5. Click **"Stop Recording"**
6. Review validation results
7. Click **"📥 Download Recording"**
8. Test playback in audio player

### Option C: Full Test Suite (3-4 hours)
Follow the detailed guide: **See TESTING_GUIDE.md**

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `index.html` | Main POC application (open this in browser) |
| `README.md` | POC user guide and feature documentation |
| `TESTING_GUIDE.md` | Step-by-step manual testing procedures |
| `PHASE_1.5_TECHNICAL_REPORT.md` | Technical specifications and test cases |
| `PHASE_1.5_SUMMARY.md` | Implementation summary and findings |
| `GET_STARTED.md` | This file - quick reference |

---

## 🎯 What We're Validating

Phase 1.5 POC tests these critical assumptions:

### ✅ Audio Recording Works
- Can record WAV files with specific sample rates
- Respects preset constraints (48kHz, 44.1kHz, channels, bit depth)
- Files are valid and downloadable

### ✅ Real-time Analysis Works
- Peak level metering updates smoothly
- Noise floor detection is accurate
- Clipping detection is responsive
- All happens without lag

### ✅ Browser Compatibility
- Works in Chrome, Firefox, Safari
- Mobile browsers supported
- Graceful handling of unsupported features
- Clear error messages when features unavailable

---

## 🧪 Simple Test (5 minutes)

Don't want to read everything? Do this quick test:

1. **Open POC**: http://localhost:3000/poc/recording-test/
2. **Click**: "Run Compatibility Check"
   - Should show ✓ for all 4 items
3. **Click**: "Start Mic Test"
   - Meters should update in real-time
   - Noise floor value should appear
4. **Click**: "Stop Mic Test"
   - All resources should cleanup
5. **Try**: "Start Recording"
   - Click "Stop Recording" after 5 seconds
   - Should show validation results
   - Download button should work

**If all this works → Phase 1.5 is successful!**

---

## 🎤 Test Environment

### Requirements
- ✅ Modern browser (Chrome, Firefox, or Safari)
- ✅ Microphone (built-in is fine)
- ✅ Quiet room (for accurate noise floor test)
- ✅ Dev server running (`npm run dev`)

### Setup
```bash
cd /Users/raia/XCodeProjects/audio-analyzer/packages/web
npm run dev
```

### Access
- Browser: `http://localhost:3000/poc/recording-test/`
- Or type the full URL in your browser's address bar

---

## 📊 Expected Results

### Browser Compatibility Check
You should see:
```
✓ getUserMedia API
✓ Web Audio API
✓ MediaRecorder API
✓ HTTPS (or localhost)
```

If any show ✗, note the error and check browser console.

### Microphone Test
- Peak meter shows current volume (in dB)
- Noise floor shows background noise level
- Clipping status shows "Clean" unless you shout
- Should initialize in < 1 second

### Recording
- Timer counts up: 00:00 → 00:01 → etc.
- Peak meter updates every frame
- Average level shows overall volume
- Clipping count increments on loud peaks

### Validation Results
Should show:
- Sample Rate Match: ✓ PASS
- Channels Match: ✓ PASS
- Duration Check: ✓ PASS
- File size displayed in MB

### Download
- Downloaded file is named: `recording-[timestamp].wav`
- File should play in any audio player
- Audio should sound like your voice clearly

---

## 🔧 Troubleshooting

### "Microphone permission not granted"
- Click "Allow" when browser asks for microphone access
- If denied, reset browser permissions and refresh

### "AudioContext error"
- Try a different browser
- Check browser console for specific error
- Ensure using http:// or https:// (not file://)

### "No audio in recording"
- Check microphone volume in system settings
- Ensure microphone is not muted
- Try different microphone if available
- Record in quiet room first

### Meters not updating
- Check browser console for JavaScript errors
- Refresh the page
- Try a different browser
- Check if microphone is connected

---

## 📚 Documentation Overview

### For Users: Start Here
- **GET_STARTED.md** ← You are here
- **recording-test/README.md** - Feature descriptions

### For Testers: Follow This
- **TESTING_GUIDE.md** - Step-by-step test procedures
- **PHASE_1.5_TECHNICAL_REPORT.md** - Expected results

### For Developers: Technical Details
- **PHASE_1.5_SUMMARY.md** - Implementation overview
- **index.html** - Source code with comments
- **AUDITIONS_IMPLEMENTATION_PLAN.md** - Master plan

---

## 🎯 Success Indicators

Phase 1.5 is successful when:

1. ✅ Browser compatibility check passes
2. ✅ Microphone test shows realistic values
3. ✅ Full recording works (30+ seconds)
4. ✅ Validation results show all PASS
5. ✅ Downloaded files are playable
6. ✅ Works on Chrome, Firefox, and Safari
7. ✅ No crashes or major errors
8. ✅ Smooth real-time updates (no stuttering)

---

## 🚦 Next Steps

### After Quick Test
- ✅ If all works → Ready for detailed testing
- ⚠️ If issues → Check troubleshooting, try different browser
- ❌ If broken → Check browser console, report error

### After Detailed Testing
1. Run full test suite (TESTING_GUIDE.md)
2. Fill in PHASE_1.5_TECHNICAL_REPORT.md
3. Document findings
4. Review for Phase 2 readiness

### For Phase 2
Once Phase 1.5 is validated:
- Convert POC to SvelteKit components
- Integrate core package modules
- Add cloud storage
- Deploy as full application

---

## 💡 Key Features to Try

### Noise Floor Detection
1. Start mic test in quiet room
2. Note noise floor value (should be very low, like -65 dB)
3. Move next to fan or air conditioning
4. Noise floor should increase (less negative)
5. This validates environmental noise detection

### Clipping Detection
1. Start mic test
2. Speak normally at first (should be clean)
3. Gradually increase volume
4. When you shout, clipping status should change
5. This validates loud input detection

### Real-time Metering
1. Start recording
2. Watch meters during normal speech
3. Speak louder - peak meter should move higher
4. Confirm smooth updates with no freezing
5. This validates real-time performance

### Preset Validation
1. Record 30 seconds with Character Recordings preset
2. Check results show 48.0 kHz (exact)
3. Check shows Mono (1 channel)
4. Try different preset (44.1 kHz)
5. Confirm each preset specifies different audio settings

---

## 📞 Questions?

### Read These First
1. **TESTING_GUIDE.md** - How to run each test
2. **PHASE_1.5_TECHNICAL_REPORT.md** - What to expect
3. **recording-test/README.md** - Feature details
4. **index.html comments** - Code explanation

### Check Browser Console
- Press `F12` or `Cmd+Option+I`
- Look for error messages
- JavaScript errors usually have helpful context
- Copy-paste errors into troubleshooting section

---

## ✨ You're All Set!

Everything is ready for Phase 1.5 testing.

**Start here**:
```bash
http://localhost:3000/poc/recording-test/
```

**Have fun testing!** 🎉

---

*Phase 1.5 POC created October 25, 2025*
*Ready for manual testing and validation*
