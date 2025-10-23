# Vitest 4 Upgrade Migration Plan

**Status:** ⚠️ BLOCKED - Requires Significant Refactoring
**Branch:** `feature/upgrade-vitest-4`
**Date:** 2025-10-23
**Last Updated:** 2025-10-23 (After attempting upgrade)

## Overview
Upgrade Vitest from v3.2.4 to v4.0.1, including related packages and configuration updates.

## Risk Assessment Summary

### ⚠️ CRITICAL FINDINGS FROM UPGRADE ATTEMPT

**Status:** Upgrade attempt revealed **130 failing tests (out of 1225)** when upgrading from Vitest 3.2.4 to 4.0.1.

### Root Cause: Arrow Function Constructor Mocking
Vitest 4 introduced stricter handling of constructor mocks. The breaking change affects mock factories that use arrow functions:

```javascript
// This pattern breaks in Vitest 4:
vi.mock('@package/module', () => ({
  default: (content, options) => ({  // ❌ Arrow function causes "not a constructor" error
    size: 1024
  })
}))

// Vitest 4 requires:
vi.mock('@package/module', () => ({
  default: function(content, options) {  // ✅ Regular function
    return { size: 1024 }
  }
}))
```

### Affected Areas
- **export-enhanced.test.js**: 14+ failures from arrow function factory mocks
- **Multiple test files**: Using arrow function mocks in `vi.mock()` factory functions
- **scope**: ~130 tests across 6 test suites

### Breaking Changes Confirmed
1. **Configuration syntax change** (REQUIRED): `poolOptions.forks.singleFork` → `maxWorkers: 1` ✅
2. **V8 coverage provider overhaul**: More accurate AST-based remapping ✅
3. **Mock behavior - Arrow Functions**: Arrow functions in factory functions fail as constructors ❌
4. **Constructor mocking**: Stricter validation of constructor implementations ❌

### Overall Risk Level
🔴 **HIGH** - Requires refactoring all mock factories that use arrow functions. Estimated impact: 15-20+ files with 100+ tests need updates.

---

## Pre-Upgrade Preparation

### 1. Create Feature Branch ✅
```bash
git checkout -b feature/upgrade-vitest-4
```

### 2. Capture Baseline Metrics
```bash
# Run full test suite and record results
npm run test:run --workspace=@audio-analyzer/web

# Run coverage and save report
npm run test:coverage --workspace=@audio-analyzer/web

# Document:
# - Test pass/fail counts (baseline: 1225 tests passing)
# - Coverage percentages
# - Test execution time
```

---

## Configuration Updates

### 3. Update vitest.config.js
**File:** `packages/web/vitest.config.js`

**Change 1 - Pool Options (BREAKING - REQUIRED):**

**REMOVE (lines 40-44):**
```javascript
poolOptions: {
  forks: {
    singleFork: true
  }
}
```

**REPLACE WITH:**
```javascript
maxWorkers: 1
```

**Change 2 - Coverage Include Patterns (OPTIONAL - RECOMMENDED):**
```javascript
coverage: {
  provider: 'v8',
  include: ['src/**/*.{js,ts,svelte}'],  // Add explicit include patterns
  reporter: ['text', 'html', 'lcov'],
  exclude: [
    'node_modules/',
    'dist/',
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js'
  ]
}
```

---

## Package Upgrades

### 4. Upgrade Vitest Packages
```bash
cd packages/web
npm install vitest@^4.0.1 @vitest/coverage-v8@^4.0.1 @vitest/ui@^4.0.1
```

**Packages to upgrade:**
- `vitest`: 3.2.4 → 4.0.1
- `@vitest/coverage-v8`: 3.2.4 → 4.0.1
- `@vitest/ui`: 3.2.4 → 4.0.1

---

## Verification & Testing

### 5. Run Full Test Suite
```bash
npm test --workspace=@audio-analyzer/web
```

**Expected:**
- All 1225+ tests should pass
- Watch for any new failures or warnings
- Some Svelte 5 deprecation warnings are expected (not errors)

**Tests to watch:**
- `tests/unit/box-auth.test.js` (uses `vi.restoreAllMocks()`)
- Component tests (may benefit from v4 improvements)

### 6. Run Coverage Analysis
```bash
npm run test:coverage --workspace=@audio-analyzer/web
```

**Expected:**
- Coverage numbers WILL differ from v3 (AST-based remapping is more accurate)
- Reports should generate correctly
- Compare with baseline captured in step 2

### 7. Run TypeScript Checks
```bash
npm run typecheck --workspace=@audio-analyzer/web
```

**Expected:**
- No new type errors

### 8. Spot-Check Critical Tests
Manually review behavior of:
- `tests/unit/box-auth.test.js` (uses `vi.restoreAllMocks()`)
- Mock-heavy tests for any behavioral changes
- Component tests (potentially improved in v4)

---

## Documentation & Commit

### 9. Document Coverage Changes
- Note any significant coverage percentage differences in commit message
- If coverage drops significantly, investigate before committing

### 10. Commit Changes
```bash
git add packages/web/package.json packages/web/vitest.config.js package-lock.json
git commit -m "chore: upgrade Vitest from v3.2.4 to v4.0.1

- vitest: 3.2.4 → 4.0.1
- @vitest/coverage-v8: 3.2.4 → 4.0.1
- @vitest/ui: 3.2.4 → 4.0.1

Configuration updates:
- Replace poolOptions.forks.singleFork with maxWorkers: 1 (breaking change)
- Add coverage.include patterns for better control

All [X] tests passing ✓
TypeScript type checking passed ✓
Coverage: [document changes if significant]

V4 uses AST-based coverage remapping (more accurate than v3).
Minor coverage percentage differences expected.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Deployment & Integration

### 11. Follow Standard Workflow
```bash
# Push feature branch
git push origin feature/upgrade-vitest-4

# Merge to staging
git checkout staging
git pull origin staging
git merge feature/upgrade-vitest-4
git push origin staging

# Deploy to beta
cd packages/web
npm run deploy:beta

# Test at: https://audio-analyzer.tinytech.site/beta/

# When satisfied, create PR from staging → main
gh pr create --base main --head staging --title "Release: Vitest 4 upgrade"
```

---

## Rollback Plan

If critical issues arise:

```bash
# Revert commit
git revert HEAD

# Or reset to previous commit
git reset --hard <previous-commit-hash>

# Reinstall v3 packages
npm install vitest@^3.2.4 @vitest/coverage-v8@^3.2.4 @vitest/ui@^3.2.4 --workspace=@audio-analyzer/web

# Restore original vitest.config.js
git checkout HEAD~1 -- packages/web/vitest.config.js
```

---

## Expected Outcomes

✅ All tests continue to pass (1225+)
✅ Coverage reports show more accurate numbers
✅ Configuration compatible with Vitest 4
⚠️ Coverage percentages may differ (expected, more accurate)
🎯 Potential improvement: Component tests may work better in CI

---

## Risk Mitigation

- ✅ All changes tested locally before merge
- ✅ Beta deployment for integration testing
- ✅ Full test suite validation at each step
- ✅ Clear rollback path if needed
- ✅ Migration plan documented for reference

---

## Files Modified

1. `packages/web/package.json` - Package version updates
2. `packages/web/vitest.config.js` - Configuration syntax updates
3. `package-lock.json` - Dependency lockfile updates

---

## References

- [Vitest 4 Migration Guide](https://vitest.dev/guide/migration.html#vitest-4)
- [V8 Coverage Provider Changes](https://vitest.dev/guide/coverage.html)
- Project CLAUDE.md workflow requirements

---

---

## Recommendation & Next Steps

### Current Status (2025-10-23)
- ✅ Vitest 4 upgrade attempted
- ❌ 130 tests failing due to arrow function constructor mocking issues
- ✅ Root cause identified: Stricter constructor mock validation in Vitest 4

### For Future Vitest 4 Migration

**Estimated Effort:** 8-12 hours of refactoring

**Required Changes:**
1. **Refactor all mock factories** (15-20+ files):
   - Convert arrow functions to regular functions in `vi.mock()` factory definitions
   - Update any dynamic mock returns that use arrow functions
   - Test each file after refactoring

2. **Update configuration** (simple, < 5 mins):
   - Replace `poolOptions.forks.singleFork` with `maxWorkers: 1`
   - Add `coverage.include` patterns

3. **Comprehensive testing**:
   - Run full test suite after each file batch
   - Verify coverage reports
   - Run typecheck

**Files Known to Need Changes:**
- `tests/unit/export-enhanced.test.js` (14+ failures)
- `tests/setup.ts` (mock setup)
- `tests/bridge/app-bridge.test.ts`
- `tests/bridge/service-coordinator.test.ts`
- `tests/services/auth-service.test.ts`
- And others using arrow function mocks

**Recommendation:**
- ⏸️ **DEFER** Vitest 4 upgrade until:
  - More time available for refactoring (not urgent)
  - Desktop app work can be paused
  - Can dedicate focused time to test migration
- 🎯 **DO** keep this documentation for future reference
- 📋 **TRACK** this as a "Tech Debt" item for future sprint

### Alternative: Vitest 3.x Updates
Consider staying on Vitest 3.2.4 for now and:
- Apply minor/patch updates as they're released
- Monitor Vitest 4 adoption in ecosystem
- Revisit migration in 6-12 months when patterns stabilize

---

## Progress Tracker

- [x] Create feature branch
- [x] Capture baseline metrics (1225 tests passing)
- [x] Update vitest.config.js (reverted)
- [x] Upgrade packages (reverted after test failures)
- [x] Run test suite (found 130 failures with v4)
- [x] Identify root cause (arrow function constructor mocks)
- [x] Document findings
- [ ] Commit documentation
- [ ] Return to main branch
