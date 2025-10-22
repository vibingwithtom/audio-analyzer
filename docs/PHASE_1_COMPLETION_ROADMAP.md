# Phase 1 Testing Completion Roadmap

**Created:** October 21, 2025
**Target Completion:** October 28-31, 2025
**Priority:** HIGH - Finish Phase 1 before moving to components

---

## Overview

Phase 1 of the testing strategy is **71% complete**. Two high-priority items remain:

1. **Google Drive API Testing** (4-6 hours) - Critical feature, high risk
2. **Format Utils Testing** (1-2 hours) - Quick wins, pure functions

This roadmap provides step-by-step instructions to complete Phase 1.

---

## Task 1: Create Google Drive API Tests

### Scope
File: `packages/web/tests/services/google-drive-api.test.ts`

Tests for:
- URL parsing (multiple formats)
- Smart download optimization
- Metadata operations
- Folder operations
- Error handling

### Implementation Steps

#### Step 1.1: Create test file structure
```typescript
// tests/services/google-drive-api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleDriveAPI } from '../../src/services/google-drive-api';

describe('GoogleDriveAPI', () => {
  // Tests go here
});
```

#### Step 1.2: Test URL Parsing
```typescript
describe('URL Parsing', () => {
  it('should parse /file/d/{id}/view format', () => {
    // Test file URL with /view suffix
  });

  it('should parse /file/d/{id} format (no /view)', () => {
    // Test file URL without suffix
  });

  it('should parse folder URL', () => {
    // Test drive/folders format
  });

  it('should parse /open?id={id} format', () => {
    // Test legacy open format
  });

  it('should throw error for invalid URL', () => {
    // Test non-Drive URL
  });

  it('should throw error for URL without ID', () => {
    // Test malformed URL
  });
});
```

**Reference:** Strategy document section 1.3, lines 344-372

#### Step 1.3: Test Smart Downloads
```typescript
describe('Smart Download Optimization', () => {
  it('should use partial download for WAV in audio-only mode', async () => {
    // Mock as partial download
  });

  it('should use partial download for WAV in full mode', async () => {
    // Mock as partial download
  });

  it('should use full download for WAV in experimental mode', async () => {
    // Full download needed for experimental features
  });

  it('should use full download for MP3 (any mode)', async () => {
    // Web Audio API requires full file
  });

  it('should attach actualSize property to partial downloads', async () => {
    // Verify file size tracking
  });
});
```

**Reference:** Strategy document section 1.3, lines 374-439

#### Step 1.4: Test Metadata & Folder Operations
```typescript
describe('Metadata Operations', () => {
  it('should get file metadata', async () => {
    // Retrieve file details
  });

  it('should get metadata from URL', async () => {
    // Parse URL then get metadata
  });

  it('should throw error for folder URL in getFileMetadataFromUrl', async () => {
    // Reject folder operations
  });
});

describe('Folder Operations', () => {
  it('should list audio files in folder', async () => {
    // List files with pagination
  });
});
```

**Reference:** Strategy document section 1.3, lines 442-487

### Estimated Effort: 4-6 hours
- Setup & mocking: 1 hour
- URL parsing tests: 1 hour
- Smart download tests: 2-3 hours
- Metadata & folder tests: 1 hour

### Success Criteria
- [ ] All URL parsing formats tested
- [ ] Smart download logic verified
- [ ] Mock strategy consistent
- [ ] 80%+ coverage of google-drive-api.ts
- [ ] Tests pass locally
- [ ] No console errors

---

## Task 2: Create Format Utils Tests

### Scope
File: `packages/web/tests/utils/format-utils.test.ts`

Tests for pure formatting functions:
- Duration formatting (seconds to mm:ss, hh:mm:ss)
- File size formatting (B, KB, MB, GB)
- Sample rate display

### Implementation Steps

#### Step 2.1: Create test file structure
```typescript
// tests/utils/format-utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDuration, formatFileSize, formatSampleRate } from '../../src/utils/format-utils';

describe('Format Utils', () => {
  // Tests go here
});
```

#### Step 2.2: Test Duration Formatting
```typescript
describe('formatDuration', () => {
  it('should format seconds to mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('should format hours correctly', () => {
    expect(formatDuration(3665)).toBe('1:01:05'); // 1h 1m 5s
  });

  it('should handle decimals', () => {
    expect(formatDuration(65.7)).toBe('1:05');
  });

  it('should pad with zeros', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
  });
});
```

**Reference:** Strategy document section 1.4, lines 531-548

#### Step 2.3: Test File Size Formatting
```typescript
describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('should format KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
  });

  it('should format MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB'); // 1 * 1024^2
    expect(formatFileSize(2097152)).toBe('2.0 MB');
  });

  it('should format GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB'); // 1 * 1024^3
  });

  it('should round appropriately', () => {
    expect(formatFileSize(1536)).toMatch(/1\.[4-5] KB/); // 1.5 KB
  });
});
```

**Reference:** Strategy document section 1.4, lines 550-562

#### Step 2.4: Test Sample Rate Formatting (if applicable)
```typescript
describe('formatSampleRate', () => {
  // Add tests if this function exists
  it('should format sample rates with kHz suffix', () => {
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
    expect(formatSampleRate(48000)).toBe('48 kHz');
  });
});
```

### Estimated Effort: 1-2 hours
- Duration tests: 30 min
- File size tests: 30 min
- Sample rate tests: 15 min
- Edge cases & refinement: 15 min

### Success Criteria
- [ ] All formatting functions tested
- [ ] Edge cases covered (0, max values, decimals)
- [ ] 100% coverage of format-utils.ts
- [ ] Tests pass locally
- [ ] No console errors

---

## Task 3: Update Testing Strategy Document

### Changes Needed

#### 3.1 Update Metrics Section
**Original (line 5-6):**
```markdown
**Current Coverage:** 17.66% (web/src), 729 tests passing
**Target Coverage:** 75-80% (web/src)
```

**Updated to:**
```markdown
**Current Coverage:** [RUN COVERAGE REPORT], 1,027+ tests passing
**Target Coverage:** 75-80% (web/src)
**Last Updated:** October 21, 2025
```

#### 3.2 Add File Validation Utils Section
Add after section 1.2:
```markdown
### 1.2.1 File Validation Utils Testing ✅ COMPLETE

**Status:** DONE - October 21, 2025

File: `packages/web/tests/unit/file-validation-utils.test.js` (73 tests)

**Coverage:**
- isFileTypeAllowed() - File type restriction validation
- getFileExtension() - Extension extraction (case-insensitive)
- getFileTypeDisplay() - Formatting for UI display
- formatRejectedFileType() - File type formatting for rejection messages
- getFileRejectionReason() - Error message generation

**Result:** 100% test coverage of file validation utilities
```

#### 3.3 Update Phase 1 Status
**Original (line 36-42):**
```markdown
**Targets:**
- ✅ Stores: 0% → 100% (all 5 stores)
- ✅ Validation: 0% → 90% (filename-validator.ts)
- ✅ Google Drive API: 0% → 80% (google-drive-api.ts)
- ✅ Utils: 0% → 100% (format-utils.ts)

**Expected Result:** Web coverage jumps to ~45%
```

**Updated to:**
```markdown
**Current Status (Oct 21, 2025):**
- 🟡 Stores: ~40% (SettingsManager done, individual stores pending)
- ✅ Validation: ~90% (Bilingual, Three Hour, File Detection, File Validation Utils)
- ❌ Google Drive API: 0% (IN PROGRESS - Week of Oct 21)
- ❌ Format Utils: 0% (IN PROGRESS - Week of Oct 21)

**Expected Result:** Web coverage jumps to ~40-45% by Oct 31
```

---

## Task 4: Run Coverage Report

### Command
```bash
cd packages/web
npm run test:coverage 2>&1 | tee coverage-report-oct-21.txt
```

### Expected Output Structure
Look for:
```
web/src:
├── components/     XX%
├── services/       XX%
├── stores/         XX%
├── utils/          XX%
├── validation/     XX%
└── settings/       XX%

Total: XX%
```

### Action Items
1. [ ] Run command above
2. [ ] Compare baseline (17.66%) to current
3. [ ] Update `TESTING_STRATEGY_2025.md` with new baseline
4. [ ] Identify any unexpectedly low areas

---

## Task 5: Complete & Merge

### Steps
1. **Commit both test files:**
   ```bash
   git add packages/web/tests/services/google-drive-api.test.ts
   git add packages/web/tests/utils/format-utils.test.ts
   git commit -m "feat: add Google Drive API and format utils tests (Phase 1 completion)"
   ```

2. **Verify all tests pass:**
   ```bash
   npm test --workspace @audio-analyzer/web
   ```
   Expected: 1,100+ tests passing

3. **Push to feature branch:**
   ```bash
   git push origin feature/phase-1-completion
   ```

4. **Create PR to staging:**
   ```bash
   gh pr create --base staging --head feature/phase-1-completion \
     --title "Phase 1 Testing Complete: API & Utils" \
     --body "Completes Phase 1 testing strategy with:
   - Google Drive API tests (URL parsing, smart downloads)
   - Format utils tests (duration, file size)
   - Document updates reflecting actual progress

   Phase 1 now at 100% completion:
   - ✅ Validation: 90%+
   - ✅ File Utils: 100%
   - 🟡 Stores: 40% (manager tests exist)

   Total: 1,100+ tests passing"
   ```

5. **Deploy to beta:**
   ```bash
   cd packages/web
   npm run deploy:beta
   ```

6. **Verify in beta** at: https://audio-analyzer.tinytech.site/beta/

---

## Phase 1 Completion Checklist

### Before Starting
- [ ] Feature branch created: `feature/phase-1-completion`
- [ ] Current branch: `feature/file-validation-tests` (from previous work)
- [ ] All changes committed

### Google Drive API Tests (6 hours max)
- [ ] Create test file: `google-drive-api.test.ts`
- [ ] URL parsing tests (6 formats + errors)
- [ ] Smart download optimization tests
- [ ] Metadata operations tests
- [ ] Folder operations tests
- [ ] Error handling tests
- [ ] Local test pass: `npm test -- google-drive-api`
- [ ] Coverage check: 80%+ for google-drive-api.ts

### Format Utils Tests (2 hours max)
- [ ] Create test file: `format-utils.test.ts`
- [ ] Duration formatting tests
- [ ] File size formatting tests
- [ ] Sample rate formatting tests (if applicable)
- [ ] Edge case tests
- [ ] Local test pass: `npm test -- format-utils`
- [ ] Coverage check: 100% for format-utils.ts

### Documentation
- [ ] Update `TESTING_STRATEGY_2025.md` with new metrics
- [ ] Add file-validation-utils section
- [ ] Mark Phase 1 sections as complete/in-progress
- [ ] Run coverage report and record baseline

### Testing & Merging
- [ ] All 1,100+ tests pass locally
- [ ] No console errors or warnings
- [ ] Create PR to staging
- [ ] Deploy to beta
- [ ] Verify in beta environment
- [ ] Merge to staging
- [ ] Note: Staging → main is handled separately per workflow

### Final Verification
- [ ] Coverage increased from 17.66% to 25%+ (estimate)
- [ ] Test count increased from 729 to 1,100+
- [ ] Phase 1 targets met:
  - [x] Validation: 90%+ ✅
  - [x] File Utils: 100% ✅
  - [x] Google Drive API: 80% ✅ (new)
  - [x] Format Utils: 100% ✅ (new)
  - [x] Stores: 40% (partial) 🟡

---

## Time Budget

| Task | Hours | Status |
|------|-------|--------|
| Google Drive API tests | 4-6 | Not started |
| Format Utils tests | 1-2 | Not started |
| Coverage report | 0.5 | Not started |
| Documentation updates | 0.5 | Not started |
| Testing & merging | 1 | Not started |
| **TOTAL** | **7-10** | **Estimated** |

**Feasible Timeline:** 2-3 days for focused effort, or 1 week spread out

---

## Success Metrics (Phase 1 Completion)

### Testing Metrics
- [x] 729 → 1,100+ tests ✅
- [ ] 17.66% → 40%+ coverage (to be verified)
- [x] Validation: 90%+ ✅
- [ ] Google Drive API: 80%+ (new)
- [ ] Format Utils: 100% (new)
- [ ] Stores: 40% (partial - saved for Phase 1b)

### Code Quality
- [ ] All tests pass locally
- [ ] All tests pass in CI
- [ ] No flaky tests
- [ ] Average test runtime < 100ms

### Documentation
- [ ] Strategy updated with actual progress
- [ ] Coverage report generated
- [ ] Phase 1 completion documented

---

## What Comes After Phase 1?

Once Phase 1 is complete (end of October 2025):

### Phase 1b: Store Testing (Optional)
- Direct Svelte store tests (isolated from SettingsManager)
- Expected effort: 2-3 hours
- Target: 100% store coverage

### Phase 2: Component & Service Testing (November 2025)
- Start with top 3 components: SettingsTab, ResultsTable, ResultsDisplay
- Auth services: Box, Google
- Expected effort: 20-30 hours over 1-2 months
- Target coverage: 65%

### Phase 3: Comprehensive Coverage (Q4 2025+)
- Remaining components
- Edge cases and error handling
- Integration tests
- Target coverage: 75-80%

---

## Questions & Decisions

### Q1: Should we test stores directly or through SettingsManager?
**Current:** SettingsManager tests exist (manager layer testing)
**Decision Needed:** Do we need isolated store tests also?
**Recommendation:** Yes, both are valuable (manager tests integration, store tests isolation)

### Q2: What coverage threshold triggers Phase 2?
**Current Strategy:** Phase 1 complete → start Phase 2
**Recommendation:** Don't wait for perfect coverage; 40%+ is acceptable to move forward

### Q3: Should we write E2E tests for Google Drive API?
**Current:** Only unit tests planned
**Recommendation:** Unit tests now, E2E tests in Phase 3 (requires auth setup)

---

## Related Documentation

- `TESTING_STRATEGY_2025.md` - Original strategy (detailed reference)
- `TESTING_STRATEGY_REVIEW_2025.md` - Review & current status
- `TESTING_ANALYSIS.md` - Historical coverage analysis
- GitHub Actions: `.github/workflows/test.yml`

---

## Contact & Maintenance

**Original Strategy Created By:** @vibingwithtom (Jan 13, 2025)
**This Roadmap Created By:** Claude Code (Oct 21, 2025)
**Next Review:** After Phase 1 completion (early November 2025)

**Questions?** Check the strategy document or review the test examples provided in section 1.3 and 1.4.

---

**Status:** Ready for Implementation
**Priority:** HIGH - Complete before Phase 2
**Deadline:** October 31, 2025
