# Component Tests - Local Development Only

This directory contains **135 comprehensive component tests** for the main Svelte components:

- `LocalFileTab.test.ts` (45 tests)
- `ResultsDisplay.test.ts` (30 tests)
- `ResultsTable.test.ts` (20 tests)
- `SettingsTab.test.ts` (40 tests)

## ✅ Local Testing

All tests pass **100% locally**. Run them during development:

```bash
# Run individual test files
npm test tests/components/LocalFileTab.test.ts
npm test tests/components/ResultsDisplay.test.ts
npm test tests/components/ResultsTable.test.ts
npm test tests/components/SettingsTab.test.ts

# Or run all at once
npm test tests/components/
```

## ⚠️ CI Status

**These tests are excluded from CI** and will not run in GitHub Actions.

### Why Excluded?

Tests fail in CI due to an incompatibility between:
- Svelte 5's `componentApi: 4` compatibility mode (required for other tests)
- DOM emulation libraries (both jsdom and happy-dom)

**The Issue:** In CI environment, `document.createElement()` returns plain JavaScript Objects instead of actual DOM elements, causing `appendChild is not a function` errors.

**Local vs CI:** Works locally because macOS/local Node.js handles optional dependencies differently than Linux CI runners.

### Full Technical Details

See `../CI_TESTING_ISSUE.md` for:
- Complete investigation (6 attempted solutions)
- Why both jsdom and happy-dom fail
- Potential future solutions

## 🔮 Future

These tests will be re-enabled in CI when:

1. **`componentApi: 4` is removed** - when Svelte 5 migration is complete
2. **Vitest 4.x stable** - enables `vitest-browser-svelte` (real browser testing)
3. **Time allows** - for implementing a comprehensive solution

## 💡 For Developers

**Use these tests!** They provide excellent coverage:

- Component rendering
- Props and state management
- User interactions (clicks, form inputs)
- Error handling
- Edge cases
- Batch processing flows

Run them locally before committing component changes to catch bugs early.
