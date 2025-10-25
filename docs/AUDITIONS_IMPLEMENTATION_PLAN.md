# Auditions Recorder - Implementation Plan

## Project Status

**Phase 1: ✅ COMPLETE** (Oct 24, 2025)
- Extracted preset system, formatters, evaluators, and validation logic to core package
- Updated web package imports
- All tests passing (1,270 tests, 42 test suites)
- CI/CD verified
- Beta deployment confirmed
- **Code is production-ready and can stand alone as infrastructure improvement**

**Phases 2+: Not yet started** (Optional - can be implemented anytime)

---

## Version History
- v1.2: Phase 1 completion update
  - Phase 1 successfully implemented and deployed to production
  - Code extraction enables future phase implementations
  - Standing infrastructure improvement for audio analyzer monorepo
- v1.1: Updated based on critical review with following key changes:
  - RecordRTC for direct WAV recording (no conversion needed)
  - Root imports pattern for cleaner code
  - TypeScript compilation to dist/ folder
  - Added Phase 1.5 proof-of-concept
  - Expanded error handling and browser compatibility
  - Added mobile browser limitations and solutions
  - Adjusted timeline to be more realistic (2-3 weeks for Phase 2)
- v1.0: Initial plan

## Project Overview

**Auditions** is a new audio recording tool that leverages the existing audio analysis infrastructure from the Audio Analyzer project. It allows users to record auditions with preset-driven recording configurations and automatic quality validation.

**Key Features**:
- Preset-based recording (settings determined by URL parameters, not user selection)
- Pre-recording microphone test with noise floor detection
- Real-time audio level metering during recording
- Post-recording quality validation using existing analyzer logic
- Script display (text or selection from list)
- Local file saving (Phase 1), cloud storage integration (Phase 2)

---

## Phase 1: Extract Shared Code to Core Package

### Objectives
- Move high-priority reusable code from `packages/web` to `packages/core`
- Ensure zero breakage in existing web app
- Create clean, importable modules for Phase 2 (Auditions package)

### Phase 1 Timeline
**Estimated Duration**: 1-2 days

### Detailed Steps

#### Step 1.1: Set Up Core Package Structure
Create new directories in `packages/core/`:

```
packages/core/
├── src/                       # Source TypeScript files
│   ├── presets/
│   │   ├── types.ts          # PresetConfig, AudioCriteria, PresetConfigurations
│   │   ├── definitions.ts    # DEFAULT_PRESETS constant
│   │   └── index.ts          # Export presets
│   ├── formatters/
│   │   ├── audio-formatters.ts # All format functions
│   │   └── index.ts
│   ├── evaluators/
│   │   ├── status-evaluator.ts # All status classification functions
│   │   └── index.ts
│   ├── validation/
│   │   ├── filename-validator.ts # FilenameValidator class
│   │   ├── types.ts          # ValidationResult, BilingualValidationData
│   │   └── index.ts
├── dist/                      # Compiled JavaScript output (gitignored)
```

**Commands**:
```bash
mkdir -p packages/core/src/{presets,formatters,evaluators,validation}
mkdir -p packages/core/dist
```

#### Step 1.2: Move Preset System

**Source**: `packages/web/src/settings/types.ts`
**Destination**: `packages/core/presets/`

**Files to create**:
1. `packages/core/presets/types.ts` - Contains:
   - `AudioCriteria` interface
   - `PresetConfig` interface
   - `PresetConfigurations` interface

2. `packages/core/presets/definitions.ts` - Contains:
   - `DEFAULT_PRESETS` constant

3. `packages/core/presets/index.ts` - Exports:
   - All types
   - DEFAULT_PRESETS

**Note**: Keep in web package (UI-specific):
- `STORAGE_KEYS` (localStorage keys)
- `FilenameValidationSettings` (UI state)
- `BoxFilenameValidationSettings` (UI state)
- `LocalFilenameValidationSettings` (UI state)
- `AppSettings` (UI state)
- `PeakDetectionMode` (UI preference)

#### Step 1.3: Move Format Utilities

**Source**: `packages/web/src/utils/format-utils.ts`
**Destination**: `packages/core/formatters/audio-formatters.ts`

**Functions moving**:
- `formatSampleRate()` - Format sample rate to kHz
- `formatDuration()` - Format duration to human-readable format
- `formatBitDepth()` - Format bit depth with "-bit" suffix
- `formatChannels()` - Format channels to descriptive text (Mono, Stereo, etc.)
- `formatBytes()` - Format bytes to human-readable size

**Actions**:
1. Copy entire file to core (it's pure functions with no dependencies)
2. Export from `packages/core/formatters/index.ts`

#### Step 1.4: Move Status Utilities

**Source**: `packages/web/src/utils/status-utils.ts`
**Destination**: `packages/core/evaluators/status-evaluator.ts`

**Functions moving**:
- `getNormalizationStatus()` - Classify normalization into validation result
- `getReverbStatus()` - Classify reverb quality into validation result
- `getNoiseFloorStatus()` - Classify noise floor dB into validation result
- `getSilenceStatus()` - Classify silence duration into validation result
- `getClippingStatus()` - Classify clipping analysis into validation result
- `getMicBleedStatus()` - Classify mic bleed detection
- `computeExperimentalStatus()` - Unified status computation from all metrics

**Actions**:
1. Copy entire file with all type definitions
2. Export from `packages/core/evaluators/index.ts`

#### Step 1.5: Move Filename Validator

**Source**: `packages/web/src/validation/filename-validator.ts`
**Destination**: `packages/core/validation/filename-validator.ts`

**Classes and types moving**:
- `FilenameValidator` class with methods:
  - `validateThreeHour()` - Validate Three Hour preset filename format
  - `validateBilingual()` - Validate Bilingual Conversational preset filename format

**Dependency Decision**: `bilingual-validation-data.json`
- Currently located in: `packages/web/src/bilingual-validation-data.json`
- **Decision**: Copy to `packages/core/validation/bilingual-validation-data.json`
- This keeps the validation logic self-contained in core

**Actions**:
1. Copy FilenameValidator class to core
2. Copy validation types (ValidationResult, BilingualValidationData)
3. Copy bilingual-validation-data.json to core
4. Export from `packages/core/validation/index.ts`

#### Step 1.6: Update Core Package Configuration

**Create `packages/core/tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Update `packages/core/package.json`**:
```json
{
  "name": "@audio-analyzer/core",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

**Update `packages/core/.gitignore`**:
```
dist/
```

#### Step 1.7: Create Index Files for New Modules

**`packages/core/presets/index.ts`**:
```typescript
export type { AudioCriteria, PresetConfig, PresetConfigurations } from './types';
export { DEFAULT_PRESETS } from './definitions';
```

**`packages/core/formatters/index.ts`**:
```typescript
export {
  formatSampleRate,
  formatDuration,
  formatBitDepth,
  formatChannels,
  formatBytes
} from './audio-formatters';
```

**`packages/core/evaluators/index.ts`**:
```typescript
export {
  getNormalizationStatus,
  getReverbStatus,
  getNoiseFloorStatus,
  getSilenceStatus,
  getClippingStatus,
  getMicBleedStatus,
  computeExperimentalStatus
} from './status-evaluator';
```

**`packages/core/validation/index.ts`**:
```typescript
export type { ValidationResult, BilingualValidationData } from './types';
export { FilenameValidator } from './filename-validator';
```

#### Step 1.8: Update Core Main Index

**Create `packages/core/src/index.ts`** (TypeScript source):
```typescript
// Re-export all modules from root for clean imports
export * from './presets/index.js';
export * from './formatters/index.js';
export * from './evaluators/index.js';
export * from './validation/index.js';
```

**Update `packages/core/index.js`** (existing file for backward compatibility):
```javascript
// Existing exports
export { AudioAnalyzer } from './audio-analyzer.js';
export { LevelAnalyzer } from './level-analyzer.js';
export { CriteriaValidator } from './criteria-validator.js';
export { BatchProcessor } from './batch-processor.js';
export { GoogleDriveHandler } from './google-drive.js';

// NEW exports from TypeScript modules (after build)
export * from './dist/index.js';
```

#### Step 1.9: Update Web Package Imports

**IMPORTANT**: All imports now use root imports from `@audio-analyzer/core` for cleaner, more maintainable code.

**In `packages/web/src/settings/settings-manager.ts`**:
```typescript
// OLD
import { STORAGE_KEYS, DEFAULT_PRESETS } from './types';
import type { PresetConfig, PresetConfigurations } from './types';

// NEW
import { DEFAULT_PRESETS, type PresetConfig, type PresetConfigurations } from '@audio-analyzer/core';
import { STORAGE_KEYS } from './types'; // Still local - UI-specific
```

**In all files using formatters**:
Find and replace imports:
```typescript
// OLD
import { formatDuration, formatSampleRate } from '../utils/format-utils';

// NEW
import { formatDuration, formatSampleRate } from '@audio-analyzer/core';
```

**In all files using status utils**:
Find and replace imports:
```typescript
// OLD
import { computeExperimentalStatus, getNoiseFloorStatus } from '../utils/status-utils';

// NEW
import { computeExperimentalStatus, getNoiseFloorStatus } from '@audio-analyzer/core';
```

**In files using filename validator**:
Find and replace imports:
```typescript
// OLD
import { FilenameValidator } from '../validation/filename-validator';

// NEW
import { FilenameValidator } from '@audio-analyzer/core';
```

**Files to update** (identified from earlier grep):
- `packages/web/src/components/LocalFileTab.svelte`
- `packages/web/src/components/GoogleDriveTab.svelte`
- `packages/web/src/components/BoxTab.svelte`
- `packages/web/src/components/ResultsDisplay.svelte`
- `packages/web/src/utils/file-validation-utils.ts`
- `packages/web/src/utils/validation-formatting.ts`
- `packages/web/src/settings/settings-manager.ts`
- `packages/web/src/stores/settings.ts`
- Any test files importing these modules

#### Step 1.10: Testing Strategy for Core Refactor

**Unit Tests for Moved Modules**:
Create test files in `packages/core/src/__tests__/`:

```typescript
// packages/core/src/__tests__/formatters.test.ts
import { formatDuration, formatSampleRate, formatBitDepth } from '../formatters';

describe('Audio Formatters', () => {
  test('formatDuration formats seconds correctly', () => {
    expect(formatDuration(65)).toBe('1m 05s');
    expect(formatDuration(3665)).toBe('1h 01m 05s');
    expect(formatDuration(45)).toBe('45s');
  });

  test('formatSampleRate formats Hz to kHz', () => {
    expect(formatSampleRate(48000)).toBe('48.0 kHz');
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
  });
});

// packages/core/src/__tests__/evaluators.test.ts
import { getNoiseFloorStatus, getClippingStatus } from '../evaluators';

describe('Status Evaluators', () => {
  test('noise floor evaluation thresholds', () => {
    expect(getNoiseFloorStatus(-65)).toBe('success'); // Good
    expect(getNoiseFloorStatus(-55)).toBe('warning'); // Fair
    expect(getNoiseFloorStatus(-45)).toBe('error');   // Poor
  });
});
```

**Integration Tests**:
```typescript
// packages/web/tests/integration/core-imports.test.ts
import { DEFAULT_PRESETS, formatDuration, FilenameValidator } from '@audio-analyzer/core';

describe('Core Package Integration', () => {
  test('can import all modules from root', () => {
    expect(DEFAULT_PRESETS).toBeDefined();
    expect(formatDuration).toBeDefined();
    expect(FilenameValidator).toBeDefined();
  });
});
```

**Regression Testing**:
```bash
# Run existing web tests to ensure nothing broke
cd packages/web
npm test

# Test specific components that use moved code
npm test -- LocalFileTab
npm test -- ResultsDisplay
npm test -- settings-manager
```

**TypeScript Check**:
```bash
# Build core first
cd packages/core
npm run build

# Then check web
cd packages/web
npm run typecheck
```

**Manual Testing Checklist**:
- [ ] Preset dropdown works and loads correct criteria
- [ ] Audio analysis validates against correct preset
- [ ] Formatted values display correctly (duration, sample rate, bit depth, channels)
- [ ] Status colors are correct (pass/warning/fail)
- [ ] Filename validation works for Three Hour preset
- [ ] Filename validation works for Bilingual preset
- [ ] All tabs work: Local File, Google Drive, Box
- [ ] Export CSV includes all formatted values

#### Step 1.11: Validation & Beta Deployment

**Build all packages**:
```bash
cd packages/core
npm run build

cd ../web
npm run build
```

**Beta deployment**:
```bash
cd packages/web
npm run deploy:beta
```

Visit: https://audio-analyzer.tinytech.site/beta/ and test all functionality

#### Step 1.11: Commit Changes

When all tests pass:
```bash
git checkout -b feature/extract-shared-code-to-core
git add .
git commit -m "refactor: extract preset, formatter, evaluator, and validation modules to core package

- Move preset types and definitions to @audio-analyzer/core/presets
- Move formatting utilities to @audio-analyzer/core/formatters
- Move status evaluators to @audio-analyzer/core/evaluators
- Move filename validator to @audio-analyzer/core/validation
- Update web package imports to use core modules
- Add TypeScript support to core package
- All existing tests pass, no functional changes to web app"

git push origin feature/extract-shared-code-to-core
```

---

## Phase 1.5: Recording Proof-of-Concept

### Objectives
- Validate technical approach for WAV recording
- Test browser compatibility
- Measure performance impact
- Confirm real-time analysis feasibility

### Phase 1.5 Timeline
**Estimated Duration**: 2-3 days

### Technical Validation Tasks

1. **Test RecordRTC for WAV Recording**
   - Install and test RecordRTC library
   - Confirm it can record directly to WAV at required specifications
   - Test file sizes and quality

2. **Validate Real-time Analysis**
   - Peak level metering with Web Audio API
   - Noise floor detection (buffer and analyze)
   - Clipping detection in real-time
   - Measure CPU usage

3. **Browser Compatibility Testing**
   ```javascript
   // Test on:
   // - Chrome/Edge (latest)
   // - Firefox (latest)
   // - Safari (latest, special handling for audio context)
   // - Mobile browsers (iOS Safari, Chrome Android)
   ```

4. **Create Minimal Demo**
   - Simple HTML page with recording
   - Validate MediaRecorder settings work with presets
   - Test download functionality

---

## Phase 2: Build Auditions Recorder Package

### Objectives
- Create new SvelteKit-based recorder package
- Leverage `@audio-analyzer/core` modules
- Build MVP with preset-driven recording workflow
- Deploy as separate web application

### Phase 2 Timeline
**Estimated Duration**: 2-3 weeks (adjusted for thorough testing and polish)

### High-Level Architecture

```
packages/auditions/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Landing page (optional)
│   │   ├── +layout.svelte            # App shell
│   │   └── record/
│   │       ├── +page.svelte          # Main recording interface
│   │       ├── +page.ts              # Load preset/script from URL
│   │       └── +layout.svelte        # Recording layout
│   ├── lib/
│   │   ├── components/
│   │   │   ├── MicTestPanel.svelte   # Pre-recording setup
│   │   │   ├── RecordingInterface.svelte # Recording UI
│   │   │   ├── AudioMeter.svelte     # Level visualization
│   │   │   ├── ScriptDisplay.svelte  # Show script text
│   │   │   ├── ValidationResults.svelte # Post-recording validation
│   │   ├── audio/
│   │   │   ├── recorder.ts           # MediaRecorder wrapper
│   │   │   └── analyzer.ts           # Real-time analysis
│   │   ├── stores/
│   │   │   ├── recording.svelte.ts   # Recording state (Svelte 5 runes)
│   │   │   └── validation.svelte.ts  # Validation state
│   ├── app.html
│   ├── app.css
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
└── IMPLEMENTATION_NOTES.md
```

### Phase 2 Steps (Detailed)

#### Step 2.1: Initialize SvelteKit project
```bash
cd packages/
npm create svelte@latest auditions
# Choose: Skeleton project, TypeScript, ESLint, Prettier

cd auditions
npm install
npm install @audio-analyzer/core
npm install recordrtc  # Direct WAV recording library
```

#### Step 2.2: Audio Recording Implementation with RecordRTC

**Why RecordRTC**: Direct WAV recording without conversion, perfect for our single-format requirement.

**`packages/auditions/src/lib/audio/recorder.ts`**:
```typescript
import RecordRTC from 'recordrtc';
import type { PresetConfig } from '@audio-analyzer/core';

export class AudioRecorder {
  private recorder: RecordRTC | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  async initialize(preset: PresetConfig) {
    // Request mic with preset-specific settings
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: parseInt(preset.sampleRate![0]),
        channelCount: parseInt(preset.channels![0]),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    // Set up AudioContext for real-time analysis
    this.audioContext = new AudioContext({
      sampleRate: parseInt(preset.sampleRate![0])
    });

    // Set up analyser for real-time metering
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);

    // Configure RecordRTC for direct WAV recording
    this.recorder = new RecordRTC(this.stream, {
      type: 'audio',
      mimeType: 'audio/wav',
      recorderType: RecordRTC.StereoAudioRecorder,
      desiredSampRate: parseInt(preset.sampleRate![0]),
      numberOfAudioChannels: parseInt(preset.channels![0]),
      bufferSize: 16384,
      bitsPerSample: parseInt(preset.bitDepth![0]) // 16 or 24 bit
    });
  }

  startRecording() {
    if (!this.recorder) throw new Error('Recorder not initialized');
    this.recorder.startRecording();
  }

  async stopRecording(): Promise<Blob> {
    if (!this.recorder) throw new Error('Recorder not initialized');

    return new Promise((resolve) => {
      this.recorder!.stopRecording(() => {
        const blob = this.recorder!.getBlob();
        resolve(blob);
      });
    });
  }

  // Real-time analysis methods
  getPeakLevel(): number {
    if (!this.analyser) return -Infinity;

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);

    const peak = Math.max(...dataArray.map(Math.abs));
    return 20 * Math.log10(peak); // Convert to dB
  }

  async analyzeNoiseFloor(durationMs: number = 2000): Promise<number> {
    // Collect samples over duration and calculate noise floor
    // Implementation based on LevelAnalyzer logic
  }

  detectClipping(threshold: number = 0.99): boolean {
    if (!this.analyser) return false;

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);

    return dataArray.some(sample => Math.abs(sample) >= threshold);
  }

  cleanup() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.recorder = null;
  }
}
```

#### Step 2.3: Real-time Analysis Features

**Confirmed scope for real-time analysis**:
- ✅ **Peak level metering**: Visual feedback during recording
- ✅ **Noise floor detection**: Pre-recording environment check
- ✅ **Clipping detection**: Warn if input is too loud
- ❌ **Frequency visualization**: Not needed

#### Step 2.4: Error Handling Strategy

**`packages/auditions/src/lib/audio/error-handler.ts`**:
```typescript
export enum RecordingError {
  MIC_PERMISSION_DENIED = 'MIC_PERMISSION_DENIED',
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
  NO_AUDIO_CONTEXT = 'NO_AUDIO_CONTEXT',
  RECORDING_INTERRUPTED = 'RECORDING_INTERRUPTED',
  INVALID_PRESET = 'INVALID_PRESET'
}

export class RecordingErrorHandler {
  static async checkCapabilities(): Promise<string[]> {
    const issues: string[] = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      issues.push('Microphone access not supported in this browser');
    }

    if (!window.AudioContext && !window.webkitAudioContext) {
      issues.push('Web Audio API not supported');
    }

    // Check for HTTPS (required for getUserMedia)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      issues.push('HTTPS required for microphone access');
    }

    return issues;
  }

  static handleError(error: any): string {
    if (error.name === 'NotAllowedError') {
      return 'Microphone permission denied. Please allow access and try again.';
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone found. Please connect a microphone and try again.';
    }
    if (error.name === 'NotReadableError') {
      return 'Microphone is in use by another application.';
    }
    return `Recording error: ${error.message}`;
  }
}
```

#### Step 2.5: Browser Compatibility Handling

**Target Browsers**: Latest versions of Chrome, Firefox, Safari (desktop and mobile)

```typescript
// Safari audio context fix
const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

// Check RecordRTC support
if (typeof RecordRTC === 'undefined') {
  // Fallback or error message
}

// Mobile detection for UI adjustments
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
```

#### Step 2.6: Mobile Browser Limitations & Solutions

**iOS Safari Specific Issues**:
1. **Audio Context must be created after user gesture**
   ```typescript
   // Wrong - will fail on iOS
   const audioContext = new AudioContext();

   // Right - create after user clicks "Start Recording"
   startButton.addEventListener('click', async () => {
     const audioContext = new AudioContext();
   });
   ```

2. **Background tab suspension**
   - Recording stops if browser is backgrounded
   - Solution: Warn users not to switch apps during recording
   - Add visual indicator that recording has stopped

3. **Sample rate limitations**
   - iOS may not honor all sample rate requests
   - Solution: Verify actual sample rate after recording

**Android Chrome Issues**:
1. **Echo cancellation forced on some devices**
   - Despite setting `echoCancellation: false`, some Android devices force it on
   - Solution: Warn users about potential quality impact

2. **Bluetooth headset compatibility**
   - Bluetooth mic quality often limited to 8kHz
   - Solution: Detect bluetooth and warn about quality

**General Mobile Considerations**:
```typescript
// Mobile-specific handling
export class MobileRecordingHandler {
  static getConstraints(preset: PresetConfig): MediaStreamConstraints {
    const base = {
      audio: {
        sampleRate: parseInt(preset.sampleRate![0]),
        channelCount: parseInt(preset.channels![0]),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    };

    // iOS specific
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // iOS may ignore some constraints, but we still request them
      return base;
    }

    // Android specific
    if (/Android/.test(navigator.userAgent)) {
      // Some Android devices have issues with 48kHz
      // May need to fallback to device default
      return {
        audio: {
          ...base.audio,
          // Add Android-specific workarounds if needed
        }
      };
    }

    return base;
  }

  static showMobileWarnings(): string[] {
    const warnings: string[] = [];

    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      warnings.push('Keep browser in foreground during recording');
      warnings.push('Do not switch to other apps while recording');
    }

    if (/Android/.test(navigator.userAgent)) {
      warnings.push('Avoid using Bluetooth headsets for best quality');
    }

    warnings.push('Ensure phone is not in silent mode');
    warnings.push('Close other audio apps before recording');

    return warnings;
  }
}
```

**UI Adjustments for Mobile**:
- Larger touch targets (minimum 44x44px for iOS)
- Disable zoom on input focus
- Responsive layout for portrait/landscape
- Touch-friendly sliders for volume adjustment

#### Step 2.7: Testing Strategy for Auditions Recorder

**Unit Tests** (`packages/auditions/src/__tests__/`):
```typescript
// audio/recorder.test.ts
import { vi, describe, test, expect } from 'vitest';
import { AudioRecorder } from '../lib/audio/recorder';

describe('AudioRecorder', () => {
  test('initializes with correct preset settings', async () => {
    const preset = {
      sampleRate: ['48000'],
      channels: ['1'],
      bitDepth: ['24']
    };

    const recorder = new AudioRecorder();
    await recorder.initialize(preset);

    // Verify RecordRTC configuration
    expect(recorder.config.desiredSampRate).toBe(48000);
    expect(recorder.config.numberOfAudioChannels).toBe(1);
  });

  test('handles microphone permission denial', async () => {
    // Mock getUserMedia rejection
    navigator.mediaDevices.getUserMedia = vi.fn()
      .mockRejectedValue(new Error('NotAllowedError'));

    const recorder = new AudioRecorder();
    await expect(recorder.initialize(preset)).rejects.toThrow('NotAllowedError');
  });
});

// components/MicTestPanel.test.ts
describe('MicTestPanel', () => {
  test('detects high noise floor', async () => {
    const { getByTestId } = render(MicTestPanel);

    // Simulate high noise floor
    mockAnalyzer.getNoiseFloor.mockReturnValue(-40); // Poor

    await waitFor(() => {
      expect(getByTestId('noise-warning')).toBeVisible();
      expect(getByTestId('noise-level')).toHaveClass('error');
    });
  });
});
```

**Integration Tests**:
```typescript
// routes/record.test.ts
import { describe, test, expect } from 'vitest';

describe('Record Route', () => {
  test('loads preset from URL parameters', async () => {
    const response = await fetch('/record?preset=auditions-character-recordings');
    const html = await response.text();

    expect(html).toContain('48 kHz');
    expect(html).toContain('24-bit');
    expect(html).toContain('Mono');
  });

  test('validates recording against preset', async () => {
    // Simulate recording session
    const recorder = await startRecording('auditions-character-recordings');
    const blob = await recorder.stop();

    const validation = await validateRecording(blob, preset);
    expect(validation.sampleRate.status).toBe('pass');
    expect(validation.bitDepth.status).toBe('pass');
  });
});
```

**E2E Tests** (Playwright):
```typescript
// e2e/recording-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete recording flow', async ({ page, context }) => {
  // Grant microphone permissions
  await context.grantPermissions(['microphone']);

  // Navigate to recording page
  await page.goto('/record?preset=auditions-character-recordings');

  // Start mic test
  await page.click('[data-testid="start-mic-test"]');
  await expect(page.locator('[data-testid="noise-status"]')).toBeVisible();

  // Start recording
  await page.click('[data-testid="start-recording"]');
  await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();

  // Wait and stop
  await page.waitForTimeout(3000);
  await page.click('[data-testid="stop-recording"]');

  // Check validation results
  await expect(page.locator('[data-testid="validation-results"]')).toBeVisible();
  await expect(page.locator('[data-testid="download-button"]')).toBeEnabled();
});

test('handles browser incompatibility', async ({ page }) => {
  // Mock incompatible browser
  await page.addInitScript(() => {
    delete window.MediaRecorder;
  });

  await page.goto('/record?preset=auditions-character-recordings');
  await expect(page.locator('[data-testid="browser-error"]')).toContainText('not supported');
});
```

**Browser Compatibility Matrix Testing**:
```yaml
# .github/workflows/browser-tests.yml
name: Browser Compatibility Tests
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e -- --browser=${{ matrix.browser }}
```

#### Step 2.8: Analytics Implementation

**Analytics Events to Track**:

```typescript
// packages/auditions/src/lib/analytics/events.ts
export enum AnalyticsEvent {
  // Session Events
  SESSION_START = 'auditions_session_start',
  SESSION_END = 'auditions_session_end',

  // Recording Events
  MIC_PERMISSION_REQUESTED = 'mic_permission_requested',
  MIC_PERMISSION_GRANTED = 'mic_permission_granted',
  MIC_PERMISSION_DENIED = 'mic_permission_denied',

  RECORDING_STARTED = 'recording_started',
  RECORDING_STOPPED = 'recording_stopped',
  RECORDING_ERROR = 'recording_error',

  // Quality Events
  NOISE_FLOOR_CHECK = 'noise_floor_check',
  CLIPPING_DETECTED = 'clipping_detected',

  // Validation Events
  VALIDATION_PASSED = 'validation_passed',
  VALIDATION_FAILED = 'validation_failed',
  VALIDATION_WARNING = 'validation_warning',

  // User Actions
  FILE_DOWNLOADED = 'file_downloaded',
  RE_RECORD_CLICKED = 're_record_clicked',
  SCRIPT_DISPLAYED = 'script_displayed',

  // Technical Events
  BROWSER_INCOMPATIBLE = 'browser_incompatible',
  SAMPLE_RATE_MISMATCH = 'sample_rate_mismatch',
  MOBILE_BACKGROUND_STOP = 'mobile_background_stop'
}

interface AnalyticsPayload {
  event: AnalyticsEvent;
  properties: {
    preset: string;
    browser: string;
    platform: 'desktop' | 'mobile';
    os: string;
    duration_ms?: number;
    error_message?: string;
    noise_floor_db?: number;
    validation_results?: Record<string, string>;
  };
}
```

**Analytics Service**:
```typescript
// packages/auditions/src/lib/analytics/analytics-service.ts
export class AnalyticsService {
  private static instance: AnalyticsService;
  private sessionId: string;
  private startTime: number;

  constructor() {
    this.sessionId = crypto.randomUUID();
    this.startTime = Date.now();
  }

  track(event: AnalyticsEvent, properties: Record<string, any>) {
    const payload = {
      event,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      elapsed_ms: Date.now() - this.startTime,
      properties: {
        ...properties,
        url: window.location.href,
        preset: new URLSearchParams(window.location.search).get('preset'),
        browser: this.getBrowserInfo(),
        platform: this.getPlatform(),
        os: this.getOS()
      }
    };

    // Send to analytics endpoint (Google Analytics, Mixpanel, custom)
    if (window.gtag) {
      window.gtag('event', event, payload.properties);
    }

    // Also log to console in dev
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event, payload);
    }
  }

  trackRecordingQuality(analysis: AudioAnalysis) {
    this.track(AnalyticsEvent.NOISE_FLOOR_CHECK, {
      noise_floor_db: analysis.noiseFloorDb,
      status: getNoiseFloorStatus(analysis.noiseFloorDb)
    });

    if (analysis.clippingDetected) {
      this.track(AnalyticsEvent.CLIPPING_DETECTED, {
        clipping_percentage: analysis.clippingPercentage
      });
    }
  }

  trackValidationResults(validation: ValidationResults) {
    const overallStatus = this.getOverallStatus(validation);

    const event = overallStatus === 'pass'
      ? AnalyticsEvent.VALIDATION_PASSED
      : overallStatus === 'warning'
      ? AnalyticsEvent.VALIDATION_WARNING
      : AnalyticsEvent.VALIDATION_FAILED;

    this.track(event, {
      validation_details: validation,
      failed_criteria: this.getFailedCriteria(validation)
    });
  }

  private getBrowserInfo(): string {
    // Detect Chrome, Firefox, Safari, etc.
  }

  private getPlatform(): 'desktop' | 'mobile' {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      ? 'mobile'
      : 'desktop';
  }

  private getOS(): string {
    // Detect Windows, macOS, Linux, iOS, Android
  }
}
```

**Privacy Considerations**:
```typescript
// Only track anonymous usage data
// No personal information
// Respect Do Not Track header
if (navigator.doNotTrack !== '1') {
  analytics.track(event, properties);
}

// GDPR compliance - get consent first
if (hasUserConsent()) {
  analytics.enable();
}
```

### Phase 2 Deployment Configuration

**`packages/auditions/svelte.config.js`**:
```javascript
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: null,
      precompress: false,
      strict: true
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/auditions' : ''
    }
  }
};
```

**`packages/auditions/package.json` scripts**:
```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "deploy": "npm run build && gh-pages -d build -e auditions",
    "deploy:beta": "npm run build && gh-pages -d build -e auditions/beta"
  }
}
```

### Usage Examples

Once complete, users will access Auditions with URLs like:

```
# Auditions: Character Recordings
https://auditions.tinytech.site/record?preset=auditions-character-recordings

# Auditions: Bilingual Partner with specific script
https://auditions.tinytech.site/record?preset=auditions-bilingual-partner&script=dialogue-001

# Beta version
https://auditions.tinytech.site/auditions/beta/record?preset=auditions-character-recordings
```

The preset determines:
- Recording sample rate
- Bit depth
- Channels (mono/stereo)
- Minimum duration
- Validation thresholds
- Post-recording checks

Users cannot change these settings - they're locked to ensure consistency.

---

## Implementation Order

### Phase 1: Core Package Refactor (1-2 days)
- [ ] Create core package directories with src/dist structure
- [ ] Move preset system to core/src/presets
- [ ] Move format utilities to core/src/formatters
- [ ] Move status utilities to core/src/evaluators
- [ ] Move filename validator to core/src/validation
- [ ] Create TypeScript configuration with dist output
- [ ] Create index files for all new modules
- [ ] Update core/index.js to export from dist
- [ ] Update all web package imports to use root imports
- [ ] Build core package (`npm run build`)
- [ ] Run tests and validate
- [ ] Deploy to beta
- [ ] Create and merge PR

### Phase 1.5: Recording Proof-of-Concept (2-3 days)
- [ ] Install RecordRTC in test environment
- [ ] Validate WAV recording at different presets
- [ ] Test real-time peak level metering
- [ ] Test noise floor detection
- [ ] Test clipping detection
- [ ] Browser compatibility matrix
- [ ] Performance benchmarking
- [ ] Create technical report

### Phase 2: Auditions Recorder MVP (2-3 weeks)
- [ ] Initialize SvelteKit project
- [ ] Install dependencies (RecordRTC, @audio-analyzer/core)
- [ ] Configure for GitHub Pages deployment
- [ ] Create route structure
- [ ] Implement URL parameter loading
- [ ] Build AudioRecorder class with RecordRTC
- [ ] Build pre-recording components (mic test, noise check)
- [ ] Build recording interface (countdown, meters, stop)
- [ ] Build post-recording validation
- [ ] Implement error handling
- [ ] Implement file saving (local download)
- [ ] Test across browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile browsers
- [ ] Deploy to beta
- [ ] User acceptance testing
- [ ] Deploy to production

---

## Risk Mitigation

### Risks for Phase 1
**Risk**: Breaking changes in web app
**Mitigation**: Run full test suite before and after each import update

**Risk**: Import path issues with monorepo
**Mitigation**: Test imports locally before committing

**Risk**: TypeScript compilation errors in core
**Mitigation**: Use strict tsconfig, validate types

### Risks for Phase 2
**Risk**: Audio capture not working on all browsers
**Mitigation**: Use feature detection, provide helpful error messages

**Risk**: File format conversion issues
**Mitigation**: Start with WAV output, test thoroughly

**Risk**: Validation logic mismatch with analyzer
**Mitigation**: Use exact same core validators and formatters

---

## Success Criteria

### Phase 1 Complete When:
✅ All core modules export correctly
✅ All web package imports updated
✅ TypeScript check passes with no errors
✅ All existing tests pass
✅ Web app functions identically as before
✅ Beta deployment successful
✅ Code review approved
✅ Merged to staging/main

### Phase 2 Complete When:
✅ Preset-based URL configuration works
✅ Pre-recording mic test accurate
✅ Recording captures at correct format
✅ Post-recording validation matches analyzer
✅ File downloads successfully
✅ Works on Chrome, Firefox, Safari
✅ Mobile browser compatible
✅ Beta deployment successful
✅ Code review approved
✅ Merged to staging/main
✅ Production deployment successful

---

## Notes

- Keep Phase 1 and Phase 2 in separate branches and PRs
- Phase 1 is prerequisite for Phase 2
- Phase 2 can be paused/resumed without affecting Phase 1
- Document any decisions in corresponding IMPLEMENTATION_NOTES.md files
- Update CLAUDE.md if workflow patterns change
