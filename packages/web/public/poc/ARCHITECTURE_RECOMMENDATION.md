# Phase 1.5 Architecture Recommendation: Tauri vs Browser

**Status**: Architecture decision pending team approval
**Date**: October 25, 2025
**Context**: Web Audio API limitation discovered regarding true bit depth recording

---

## Executive Summary

During Phase 1.5 POC development, we discovered a **fundamental Web Audio API limitation**: the browser abstracts all audio through Float32, making it impossible to guarantee true bit depth recording (16-bit, 24-bit, etc.).

**Recommendation**: Move from web POC to **desktop framework** (Tauri or Flutter) to achieve the hard requirement of guaranteed bit depth recording.

---

## The Problem: Web Audio API Limitation

### Current Situation
- Built custom 24-bit WAV encoder in browser
- Works technically, but **cannot guarantee true bit depth**
- Microphone data → Float32 (abstraction) → WAV file claims 24-bit
- Actually recorded data may be 16-bit (limited by hardware)
- **Shows false green checkmark** when we don't know actual quality

### Root Cause
Browser's Web Audio API:
1. Gets audio from microphone (any bit depth)
2. Immediately converts to Float32 internally
3. JavaScript never sees original bit depth
4. No API to query microphone capabilities
5. Result: **Can't detect or guarantee actual bit depth**

### User Impact
```
✅ Files created successfully
✅ Files play correctly
❌ 24-bit file may only contain 16-bit audio
❌ Claims quality we can't verify
```

---

## Solution Comparison

### Option 1: Tauri (Recommended for Desktop)

**Stack**: Svelte UI + Tauri + Rust (cpal)

#### What Tauri Solves
```
Svelte UI (existing code - reusable)
    ↓
Tauri Bridge (command invocation)
    ↓
Rust Backend (cpal audio library)
    ↓
Direct OS Audio APIs
    ↓
✅ Query microphone capabilities
✅ Detect supported bit depths
✅ Record at true bit depth
✅ No Float32 abstraction
```

#### Capabilities
- **Device enumeration**: Query what the microphone supports
- **True recording**: Record at actual 24-bit if available
- **Bit depth detection**: Check `SampleFormat::I24` support
- **Fallback**: Honest 16-bit if 24-bit unavailable

#### Advantages
- ✅ Reuse ~90% of existing Svelte code
- ✅ Lightweight (~50MB vs Electron's ~150MB)
- ✅ Fast startup and performance
- ✅ Native Rust backend (powerful audio libraries)
- ✅ Cross-desktop: Windows, Mac, Linux
- ✅ Professional audio quality

#### Disadvantages
- ❌ Desktop only (no mobile)
- ⚠️ Requires Rust knowledge for audio backend
- ⚠️ Separate distribution per OS (.exe, .dmg, etc)

#### Timeline
- Setup + Integration: ~2-3 hours
- Rust audio backend (cpal): ~6-8 hours
- Testing: ~2 hours
- **Total**: ~1 full day

#### Example Rust Implementation
```rust
#[tauri::command]
async fn get_audio_devices() -> Result<Vec<DeviceInfo>, String> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    for device in host.input_devices()? {
        let mut supports_24bit = false;
        if let Ok(configs) = device.supported_input_configs() {
            for config in configs {
                if config.sample_format() == cpal::SampleFormat::I24 {
                    supports_24bit = true;
                }
            }
        }
        devices.push(DeviceInfo {
            name: device.name()?,
            supports_24bit,
        });
    }
    Ok(devices)
}
```

---

### Option 2: Flutter (Best for Cross-Platform)

**Stack**: Flutter + native platform APIs

#### What Flutter Solves
- **All platforms**: iOS, Android, Windows, Mac, Linux
- **Native APIs**: Direct access to each platform's audio system
- **Bit depth**: `MicStream.bitDepth` property available
- **True recording**: Record at native bit depth per platform

#### Advantages
- ✅ Single codebase for ALL platforms
- ✅ Built-in bit depth detection
- ✅ Better for mobile (iOS/Android primary)
- ✅ Native performance on each platform
- ✅ Easier audio library ecosystem

#### Disadvantages
- ❌ Rewrite from Svelte (~3-4 days learning curve)
- ❌ Learn Dart language
- ❌ Larger codebase rewrite
- ⚠️ Overkill if desktop only

#### Timeline
- Setup Flutter project: ~2-3 hours
- Port UI from Svelte: ~4-6 hours
- Audio integration: ~4-6 hours
- Testing: ~2-3 hours
- **Total**: ~2-3 days

---

### Option 3: Keep Web (NOT Recommended)

#### What We'd Accept
- Accept Float32 limitation
- Create 16-bit files only (honest)
- Document as browser limitation
- Defer 24-bit to future if needed

#### Reality Check
- ❌ Can't detect microphone capabilities
- ❌ Can't guarantee any bit depth
- ❌ Users would need high-end tools to verify quality
- ❌ Defeats the hard requirement

---

## Decision Matrix

| Criteria | Tauri | Flutter | Web |
|----------|-------|---------|-----|
| **Desktop (Win/Mac/Linux)** | ✅ Yes | ✅ Yes | ❌ No |
| **Mobile (iOS/Android)** | ❌ No | ✅ Yes | ✅ (Limited) |
| **Bit depth detection** | ✅ Yes | ✅ Yes | ❌ No |
| **True bit depth recording** | ✅ Yes | ✅ Yes | ❌ No |
| **Code reuse** | 90% Svelte | 0% Svelte | 100% (current) |
| **Learning curve** | Low (Rust basics) | High (Dart) | None |
| **Timeline** | 1 day | 2-3 days | N/A |
| **Distribution** | Native apps | Native apps | Web URL |
| **Team expertise** | Existing (JS/Rust) | New (Dart) | Existing (JS) |

---

## Recommendation by Use Case

### Desktop Only Requirement
→ **Tauri + Svelte**
- Fastest to market (1 day)
- Reuse existing Svelte code
- Professional audio quality
- Lightweight and fast

### Mobile Required (Now or Future)
→ **Flutter**
- True cross-platform solution
- Better mobile support
- Built-in bit depth detection
- Worth the rewrite for long-term

### Phase 1.5 POC Continues As-Is (No Changes)
→ **Web browser version**
- Already built and tested
- Good for remote testing/feedback
- Documents the limitation
- Can stay as reference

---

## Important Caveats

### OS/Driver Limitations Apply to Both Desktop Options
Even with native access, limitations exist:
- OS driver may not accurately report bit depth
- Hardware may claim 24-bit but deliver 16-bit
- Platform audio stack may do internal conversion
- This is **hardware/driver limitation**, not software limitation

### What We CAN Guarantee with Tauri/Flutter
✅ What microphone **claims** to support
✅ What OS **allows** us to record
✅ File format at that bit depth
✅ No artificial Float32 constraint

### What We CAN'T Guarantee
❌ True hardware bit depth (driver dependent)
❌ OS internal conversion/processing
❌ Actual audio fidelity beyond hardware capability

---

## Implementation Phases

### Phase 1.5 (Current)
✅ **Keep**: Web POC complete and deployed
- Shows feasibility of recording and analysis
- Identifies Float32 limitation
- Documents the discovery

### Phase 2 (After Decision)
- **If Tauri**: Build production Tauri app with Rust audio backend
- **If Flutter**: Build production Flutter app with native APIs
- **If Web only**: Accept 16-bit limitation, document clearly

---

## Questions for Team Review

1. **Desktop-only acceptable?** → Tauri is fastest (1 day)
2. **Mobile needed?** → Flutter required (2-3 days, bigger rewrite)
3. **Timeline pressure?** → Affects choice (1 day vs 3 days)
4. **Rust expertise available?** → Tauri needs Rust backend
5. **Long-term maintenance?** → Tauri lighter, Flutter more portable
6. **User distribution model?** → Desktop apps vs web URL trade-off

---

## Recommendation Summary

**For Phase 2 Desktop Audio Recorder with True Bit Depth**:

```
PRIMARY: Tauri + Svelte + Rust
├─ Fastest implementation (1 day)
├─ Reuses existing Svelte UI
├─ True bit depth detection
├─ Desktop only (Windows/Mac/Linux)
└─ Lightweight and performant

ALTERNATIVE: Flutter
├─ If mobile needed now/future
├─ True cross-platform (all platforms)
├─ Bit depth support built-in
├─ Longer implementation (2-3 days)
└─ Complete rewrite from Svelte

NOT RECOMMENDED: Continue Web
├─ Keeps float32 limitation
├─ Can't detect bit depth
├─ Can only do 16-bit honestly
└─ Defeats hard requirement
```

---

## Next Steps

1. **Team review** this document
2. **Decide**: Tauri (desktop) vs Flutter (mobile) vs Web (limited)
3. **Approve**: Architecture choice for Phase 2
4. **If approved**: Start Tauri/Flutter POC conversion

**Current status**: Phase 1.5 web POC complete, pending architecture decision for Phase 2.

---

**Prepared by**: Claude Code
**Date**: October 25, 2025
**Status**: Awaiting team review and decision
