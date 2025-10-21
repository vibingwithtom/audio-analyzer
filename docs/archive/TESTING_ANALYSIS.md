# Testing Strategy Analysis - Audio Analyzer

**Date:** January 13, 2025
**Current Status:** 729 tests passing, 17.66% coverage in web/src
**Documents Reviewed:** COMPREHENSIVE_TEST_PLAN.md, TEST_COVERAGE_STATUS.md

---

## Executive Summary

After reviewing the existing test plan documents and comparing them to the current state of the project, **both documents are significantly outdated** and no longer align with the current Svelte-based architecture. However, the **core testing strategy is still sound** and should be followed with updated approaches.

### Key Findings

✅ **What's Working:**
- 729 tests currently passing
- Core library (@audio-analyzer/core) has strong test coverage
- Critical services (audio-analysis-service.ts, auth-service.ts) have >80% coverage
- Testing infrastructure (Vitest) is solid

⚠️ **What's Outdated:**
- TEST_COVERAGE_STATUS.md shows 13.37% (current is 17.66% in web/src)
- Documents reference components that no longer exist (FileUpload.svelte, StatusBadge.svelte)
- Testing approaches don't account for Svelte 5 component testing patterns
- Store testing strategy doesn't reflect current store architecture

❌ **Major Gap:**
- **0% coverage on all Svelte components** (App.svelte, all tabs, ResultsDisplay, ResultsTable, SettingsTab)
- **0% coverage on all stores** (settings, auth, tabs, analysisMode, threeHourSettings)
- Google Drive API (google-drive-api.ts) has 0% coverage
- Validation logic (filename-validator.ts) has 0% coverage

---

## Current Test Coverage Breakdown

### High Coverage (>80%) ✅
| Module | Coverage | Status |
|--------|----------|--------|
| audio-analysis-service.ts | 88.19% | Excellent |
| auth-service.ts | 82.74% | Excellent |
| settings-manager.ts | 72.72% | Good |
| app-bridge.ts | 82.5% | Good |
| service-coordinator.ts | 94.84% | Excellent |
| config.js | 96.15% | Excellent |

### Medium Coverage (30-80%) ⚠️
| Module | Coverage | Status |
|--------|----------|--------|
| box-auth.js | 32.88% | Needs improvement |
| box-api.ts | 23.4% | Needs improvement |

### Zero Coverage (0%) ❌
| Category | Modules |
|----------|---------|
| **Components** | All .svelte files (11 components) |
| **Stores** | All store files (5 stores) |
| **Services** | google-auth.js, google-drive-api.ts |
| **Validation** | filename-validator.ts |
| **Utils** | format-utils.ts |

---

## Analysis of Existing Test Plan Documents

### COMPREHENSIVE_TEST_PLAN.md

**Status:** 🟡 **Partially Valid** - Core strategy is sound but needs updates

**What's Still Valid:**
1. ✅ **Phased approach** - Testing services before UI is the right strategy
2. ✅ **Risk-based prioritization** - Focus on critical paths first
3. ✅ **Isolation principles** - Mock external dependencies
4. ✅ **Behavior over implementation** - Test user interactions, not internals
5. ✅ **CI integration** - We already have GitHub Actions CI

**What's Outdated:**
1. ❌ **Phase 1 examples** - Show patterns that don't match current API structure
2. ❌ **Phase 2 store examples** - Reference old store patterns (e.g., `settingsManager` is now different)
3. ❌ **Phase 4 UI examples** - Reference components that don't exist or have changed significantly
4. ❌ **Coverage goals** - Aims for 80% but doesn't account for current architecture

**Recommendation:** **Archive and replace** with updated plan

---

### TEST_COVERAGE_STATUS.md

**Status:** ❌ **Severely Outdated** - Should be replaced

**What's Outdated:**
1. ❌ **Coverage percentage** - Shows 13.37%, current is 17.66%
2. ❌ **Last updated** - October 13, 2025 (3 months ago)
3. ❌ **Component list** - References FileUpload.svelte, StatusBadge.svelte (don't exist)
4. ❌ **Status markers** - Show work "in progress" that's actually complete or abandoned
5. ❌ **Blocking issues** - References "gapi global mock" issues that may be resolved

**Recommendation:** **Replace** with current coverage report

---

## Recommended Testing Strategy (Updated for 2025)

### Priority 1: Fill Critical Gaps (Immediate) 🔴

These modules are **high-risk** and currently have **zero coverage**:

#### 1.1 Stores (0% → Target: 100%)
**Why Critical:** Stores manage all application state. Bugs here affect the entire app.

**Files to Test:**
- `src/stores/settings.ts` - Preset and criteria management
- `src/stores/analysisMode.ts` - Mode switching logic
- `src/stores/auth.ts` - Authentication state
- `src/stores/tabs.ts` - Tab navigation
- `src/stores/threeHourSettings.ts` - Three Hour config

**Approach:**
```typescript
// Example: tests/stores/settings.test.ts
import { get } from 'svelte/store';
import { currentPresetId, setPreset } from '../../src/stores/settings';

describe('Settings Store', () => {
  it('should update preset when setPreset is called', () => {
    setPreset('auditions-character-recordings');
    expect(get(currentPresetId)).toBe('auditions-character-recordings');
  });

  // Test derived stores
  it('hasValidPresetConfig should be false when no preset selected', () => {
    setPreset('none');
    expect(get(hasValidPresetConfig)).toBe(false);
  });
});
```

**Estimated Effort:** 4-6 hours
**Impact:** High - Stores are the backbone of the application

---

#### 1.2 Validation Logic (0% → Target: 90%)
**Why Critical:** Filename validation is a core feature for Two presets (Three Hour, Bilingual).

**Files to Test:**
- `src/validation/filename-validator.ts`

**Approach:**
```typescript
// Example: tests/validation/filename-validator.test.ts
import { FilenameValidator } from '../../src/validation/filename-validator';

describe('FilenameValidator - Bilingual', () => {
  it('should pass valid scripted conversation filename', () => {
    const result = FilenameValidator.validateBilingual('CONV001-en-user-U123-agent-A456.wav');
    expect(result.status).toBe('pass');
    expect(result.issue).toBeUndefined();
  });

  it('should fail invalid language code', () => {
    const result = FilenameValidator.validateBilingual('CONV001-zz-user-U123-agent-A456.wav');
    expect(result.status).toBe('fail');
    expect(result.issue).toContain('language code');
  });
});

describe('FilenameValidator - Three Hour', () => {
  it('should pass when script exists in list', () => {
    const scriptsList = ['Script_001', 'Script_002'];
    const result = FilenameValidator.validateThreeHour('Script_001_SP001.wav', scriptsList, 'SP001');
    expect(result.status).toBe('pass');
  });
});
```

**Estimated Effort:** 3-4 hours
**Impact:** High - Critical for two major presets

---

#### 1.3 Google Drive API (0% → Target: 80%)
**Why Critical:** Second most used file source after local files.

**Files to Test:**
- `src/services/google-drive-api.ts`

**Approach:**
```typescript
// Example: tests/services/google-drive-api.test.ts
import { vi } from 'vitest';
import { GoogleDriveAPI } from '../../src/services/google-drive-api';

describe('GoogleDriveAPI', () => {
  let mockGoogleAuth;

  beforeEach(() => {
    mockGoogleAuth = {
      downloadFile: vi.fn(),
      downloadFileHeaders: vi.fn(),
      getFileMetadata: vi.fn(),
      listAudioFilesInFolder: vi.fn(),
    };
  });

  describe('URL Parsing', () => {
    it('should parse file URL', () => {
      const api = new GoogleDriveAPI(mockGoogleAuth);
      const result = api.parseUrl('https://drive.google.com/file/d/ABC123/view');
      expect(result).toEqual({ id: 'ABC123', type: 'file' });
    });

    it('should parse folder URL', () => {
      const api = new GoogleDriveAPI(mockGoogleAuth);
      const result = api.parseUrl('https://drive.google.com/drive/folders/FOLDER123');
      expect(result).toEqual({ id: 'FOLDER123', type: 'folder' });
    });
  });

  describe('Smart Downloads', () => {
    it('should use partial download for WAV in audio-only mode', async () => {
      mockGoogleAuth.downloadFileHeaders.mockResolvedValue(new Blob());
      mockGoogleAuth.getFileMetadata.mockResolvedValue({ name: 'test.wav', size: 1000000 });

      const api = new GoogleDriveAPI(mockGoogleAuth);
      await api.downloadFile('ABC123', { mode: 'audio-only', filename: 'test.wav' });

      expect(mockGoogleAuth.downloadFileHeaders).toHaveBeenCalled();
      expect(mockGoogleAuth.downloadFile).not.toHaveBeenCalled();
    });

    it('should use full download for MP3', async () => {
      mockGoogleAuth.downloadFile.mockResolvedValue(new File([], 'test.mp3'));

      const api = new GoogleDriveAPI(mockGoogleAuth);
      await api.downloadFile('ABC123', { mode: 'audio-only', filename: 'test.mp3' });

      expect(mockGoogleAuth.downloadFile).toHaveBeenCalled();
      expect(mockGoogleAuth.downloadFileHeaders).not.toHaveBeenCalled();
    });
  });
});
```

**Estimated Effort:** 4-6 hours
**Impact:** High - Major file source

---

### Priority 2: UI Component Testing (Next Phase) 🟡

**Current Status:** 0% coverage on all Svelte components

**Why Lower Priority:**
- UI components have lower defect risk than business logic
- Svelte 5 component testing requires specific setup
- Components are relatively thin wrappers around services/stores

**Recommended Approach:**

#### 2.1 Test Strategy for Svelte 5 Components

Use `@testing-library/svelte` with the new Svelte 5 patterns:

```typescript
// Example: tests/components/LocalFileTab.test.ts
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import LocalFileTab from '../../src/components/LocalFileTab.svelte';

// Mock the analysis service
vi.mock('../../src/services/audio-analysis-service', () => ({
  analyzeAudioFile: vi.fn().mockResolvedValue({
    filename: 'test.wav',
    status: 'pass',
    sampleRate: 48000,
    // ... other properties
  })
}));

describe('LocalFileTab', () => {
  it('should render file upload area', () => {
    render(LocalFileTab);
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it('should call analyzeAudioFile when file is selected', async () => {
    const { analyzeAudioFile } = await import('../../src/services/audio-analysis-service');
    render(LocalFileTab);

    const input = screen.getByLabelText(/browse/i);
    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });

    await userEvent.upload(input, file);

    expect(analyzeAudioFile).toHaveBeenCalledWith(file, expect.objectContaining({
      analysisMode: expect.any(String),
      preset: expect.anything(),
    }));
  });
});
```

#### 2.2 Component Testing Priority

**High Priority:**
1. `SettingsTab.svelte` - Configuration is critical
2. `ResultsTable.svelte` - Core display component
3. `ResultsDisplay.svelte` - Results orchestration

**Medium Priority:**
4. `LocalFileTab.svelte` - Most used tab
5. `GoogleDriveTab.svelte` - Second most used
6. `BoxTab.svelte` - Third most used

**Lower Priority:**
7. `App.svelte` - Integration test, covered by E2E
8. `TabNavigation.svelte` - Simple component
9. `ErrorDisplay.svelte` - Simple component

**Estimated Effort:** 12-16 hours for all components
**Impact:** Medium - Good for regression prevention

---

### Priority 3: Improve Existing Coverage (Ongoing) 🟢

**Box Auth (32.88% → Target: 70%)**
- Focus on testable methods
- Accept that some OAuth flow parts can't be unit tested
- Consider E2E tests for full OAuth flow

**Google Auth (0% → Target: 70%)**
- Same approach as Box Auth
- Mock `gapi` global carefully
- Test token management and refresh logic

**Format Utils (0% → Target: 100%)**
- Pure functions, easy to test
- Low effort, high impact

---

## Updated Testing Goals

### Short Term (1-2 weeks)
- ✅ Store tests: 100% coverage (all 5 stores)
- ✅ Validation tests: 90%+ coverage
- ✅ Google Drive API: 80%+ coverage
- ✅ Format utils: 100% coverage

**Target Overall Coverage:** 40-50% in web/src

---

### Medium Term (1-2 months)
- ✅ Component tests: High-priority components (3)
- ✅ Box Auth improvements: 70%
- ✅ Google Auth improvements: 70%

**Target Overall Coverage:** 60-70% in web/src

---

### Long Term (3+ months)
- ✅ All component tests complete
- ✅ E2E tests for critical user flows
- ✅ Visual regression tests (optional)

**Target Overall Coverage:** 75-80% in web/src

---

## Why Not Aim for Higher Coverage?

**80% is the sweet spot because:**

1. **Diminishing Returns**: Getting from 80% to 90% requires 3-4x the effort for marginal gain
2. **Some code is untestable**: OAuth redirects, browser APIs, Svelte internals
3. **E2E tests cover the gap**: Full user flows are better tested end-to-end
4. **Maintenance burden**: Every test requires maintenance when code changes

**Industry Standard:**
- 70-80% coverage is considered excellent for web applications
- Google's internal standard is 70%
- Microsoft recommends 70-80% for production code

---

## Recommended Action Plan

### Step 1: Archive Old Documents
```bash
mv docs/COMPREHENSIVE_TEST_PLAN.md docs/Archive_COMPREHENSIVE_TEST_PLAN.md
mv docs/TEST_COVERAGE_STATUS.md docs/Archive_TEST_COVERAGE_STATUS.md
```

### Step 2: Create New Test Plan
Create `docs/TESTING_STRATEGY_2025.md` with:
- Updated priorities (stores, validation, Google Drive API)
- Svelte 5 testing patterns
- Realistic coverage goals (40% → 60% → 75%)
- Component testing approaches

### Step 3: Create Coverage Tracking
Create automated coverage reporting in CI:
```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
```

### Step 4: Execute Priority 1 Tests
Start with stores (highest ROI):
1. Write store tests (4-6 hours)
2. Write validation tests (3-4 hours)
3. Write Google Drive API tests (4-6 hours)
4. Write format-utils tests (1-2 hours)

**Total Estimated Effort:** 12-18 hours
**Expected Coverage Increase:** 17% → 45%+

---

## Conclusion

**The existing test plan documents are outdated but the core strategy is sound.**

### Recommendations:

1. ✅ **Archive** COMPREHENSIVE_TEST_PLAN.md and TEST_COVERAGE_STATUS.md
2. ✅ **Create** new TESTING_STRATEGY_2025.md with updated approach
3. ✅ **Focus** on Priority 1 (stores, validation, Google Drive API) first
4. ✅ **Set realistic goals**: 40% → 60% → 75% over 3-6 months
5. ✅ **Component testing** is lower priority - services and stores are more critical
6. ❌ **Don't aim for 90%+** - diminishing returns and maintenance burden

### Key Insight:

**We have 729 tests with 17.66% coverage because most tests are in @audio-analyzer/core, not the web package.** The core library is well-tested. The web package needs focused effort on:
1. Stores (state management)
2. Validation (business logic)
3. API services (Google Drive)
4. Then components (UI)

This analysis provides a clear, actionable path forward that aligns with the current Svelte 5 architecture.

---

**Next Steps:**
1. Archive old test documents
2. Create TESTING_STRATEGY_2025.md
3. Start with store tests (highest impact, lowest effort)
4. Track progress with automated coverage reporting

---

**Maintained by:** @vibingwithtom
**Last Updated:** January 13, 2025
