# CI Testing Issue: Phase 2 Component Tests Failing in GitHub Actions

## Status
🔴 **BLOCKED** - All 135 Phase 2 component tests pass locally (100%) but fail in CI with jsdom DOM creation issues.

## Background

### Context
- **Branch**: `feature/phase-2-component-testing`
- **PR**: #27
- **Tests**: 135 P1 component tests (LocalFileTab, ResultsDisplay, ResultsTable, SettingsTab)
- **Framework**: Svelte 5 with componentApi: 4 compatibility mode
- **Test Environment**: Vitest with jsdom
- **Local Environment**: macOS ARM64 (tests pass 100%)
- **CI Environment**: Ubuntu latest (tests fail 100%)

### Test Configuration
```javascript
// vitest.config.js
svelte({
  hot: !process.env.VITEST,
  compilerOptions: {
    dev: true,
    compatibility: {
      componentApi: 4  // Required for other test compatibility
    }
  }
})
```

### Package Versions
- `svelte`: 5.41.1
- `jsdom`: 27.0.1
- `vitest`: 3.2.4
- `@testing-library/svelte`: 5.2.8
- Node.js: 20 (CI)

---

## The Problem

### Primary Error
```
TypeError: 'appendChild' called on an object that is not a valid instance of Node.
  at Object.appendChild (node_modules/jsdom/lib/jsdom/living/generated/Node.js:393:15)
  at node_modules/svelte/src/internal/client/render.js:210:38
```

### Root Cause
In CI's jsdom environment, **`document.createElement()` returns plain JavaScript Objects instead of DOM elements**. This happens specifically when:
1. Tests run in GitHub Actions (Ubuntu)
2. Svelte 5 is in componentApi: 4 compatibility mode
3. Components are mounted using Svelte 5's `mount()` function

### Evidence
```javascript
// Local (works):
const div = document.createElement('div');
console.log(div.constructor.name);  // "HTMLDivElement"
console.log(!!div.appendChild);      // true

// CI (broken):
const div = document.createElement('div');
console.log(div.constructor.name);  // "Object"
console.log(!!div.appendChild);      // false
```

---

## Attempts to Fix

### Attempt 1: Fix npm ci Dependency Resolution ✅
**Problem**: Platform-specific Rollup dependencies breaking on Linux
**Solution**: Added fallback in CI workflow
```yaml
- name: Install dependencies
  run: |
    npm ci --no-audit || npm install --no-audit
```
**Result**: ✅ Dependencies install successfully, but tests still fail

---

### Attempt 2: Polyfill document.createTextNode ✅
**Problem**: `document.createTextNode is not a function`
**Solution**: Added polyfill using native Text constructor
```javascript
if (typeof document.createTextNode !== 'function') {
  document.createTextNode = function(data) {
    return new Text(data);
  };
}
```
**Result**: ✅ createTextNode works, revealed createElement issue

---

### Attempt 3: Copy Methods from HTMLElement.prototype ⚠️
**Problem**: Created elements lack DOM methods
**Approach**: Capture methods from HTMLElement.prototype and bind to broken elements
```javascript
const HTMLElementProto = HTMLElement.prototype;
const workingMethods = {
  appendChild: HTMLElementProto.appendChild,
  removeChild: HTMLElementProto.removeChild,
  insertBefore: HTMLElementProto.insertBefore,
  // ... etc
};

// When createElement returns broken element:
element.appendChild = workingMethods.appendChild.bind(element);
```
**Result**: ⚠️ Methods exist on objects, but jsdom rejects them as "not a valid instance of Node"

**CI Logs**:
```
[APPENDCHILD] Called on: Object nodeType: 1 hasAppendChild: true
TypeError: 'appendChild' called on an object that is not a valid instance of Node.
```

---

### Attempt 4: Create Real Elements via innerHTML ❌
**Problem**: Plain Objects aren't valid Nodes
**Approach**: Use innerHTML to create actual DOM elements
```javascript
const container = document.body;
container.innerHTML = `<${tagName}></${tagName}>`;
const realElement = container.firstChild;
return realElement;
```
**Result**: ❌ `firstChild` returns `null` - innerHTML doesn't create children

**CI Logs**:
```
[CREATEELEMENT] Container exists: true hasAppendChild: true
[CREATEELEMENT] innerHTML created element: false constructor: undefined
```

---

### Attempt 5: Use Fresh Document Context ❌
**Problem**: Main document's createElement is broken
**Approach**: Create fresh document and import elements
```javascript
const freshDocument = document.implementation.createHTMLDocument('temp');
const realElement = freshDocument.createElement(tagName);
const importedElement = document.importNode(realElement, true);
return importedElement;
```
**Result**: ❌ `createHTMLDocument()` returns `null` in some test files

**CI Logs**:
```
[SETUP] Fresh document created: true   // in most tests
[SETUP] Fresh document created: false  // in SettingsTab tests
```

---

### Attempt 6: Wrap appendChild for Debugging ✅
**Approach**: Log what appendChild is called on to understand the issue
```javascript
HTMLElementProto.appendChild = function(this: any, child: Node) {
  console.log('[APPENDCHILD] Called on:', this.constructor?.name);
  return originalAppendChild.call(this, child);
};
```
**Result**: ✅ Confirmed plain Objects are being used, not HTMLElements

---

## Technical Deep Dive

### Why Copied Methods Don't Work

jsdom implements strict type checking using `instanceof`:

```javascript
// jsdom/lib/jsdom/living/generated/Node.js:393
exports.appendChild = function appendChild(node) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  // ... validation fails for plain Objects
};
```

Even though our Objects have the `appendChild` method, they fail the `module.exports.is(this)` check which validates the object is actually a Node instance.

### Why createElement Breaks

The issue appears related to:
1. **Svelte 5's componentApi: 4 compatibility mode** uses legacy-client code
2. **Some interaction with Vitest/jsdom** that breaks createElement mid-test
3. **Timing**: createElement works initially, breaks during SettingsTab tests specifically

Evidence:
- Some test files show `[SETUP] Initial createElement working: true`
- SettingsTab tests show `[SETUP] Initial createElement working: false`
- This suggests createElement breaks AFTER certain tests run

### Why We Can't Remove Compatibility Mode

The `componentApi: 4` setting was added to resolve other test issues. Removing it would:
- Break other existing tests
- Lose Svelte 4 API compatibility needed for some components
- Not guaranteed to fix the createElement issue

---

## Current Status

### What Works
- ✅ All 135 tests pass locally (macOS)
- ✅ npm dependency installation in CI
- ✅ createTextNode polyfill
- ✅ Method capture from HTMLElement.prototype
- ✅ TypeScript compilation
- ✅ Debugging/logging infrastructure

### What's Broken
- ❌ All component tests fail in CI
- ❌ document.createElement returns plain Objects (not DOM elements)
- ❌ innerHTML doesn't create child nodes
- ❌ Fresh document approach returns null
- ❌ jsdom instanceof validation rejects patched Objects

### Affected Tests
All 135 Phase 2 P1 component tests across 4 test files:
- `tests/components/LocalFileTab.test.ts` (45 tests)
- `tests/components/ResultsDisplay.test.ts` (30 tests)
- `tests/components/ResultsTable.test.ts` (20 tests)
- `tests/components/SettingsTab.test.ts` (40 tests)

---

## Possible Solutions

### Option 1: Mock jsdom's instanceof Check ⚠️
**Approach**: Override jsdom's Node validation to accept our patched Objects
**Pros**:
- Might be quickest fix
- Keeps current test structure

**Cons**:
- Very hacky
- Fragile - could break with jsdom updates
- May have unintended side effects

**Effort**: Medium

---

### Option 2: Switch to happy-dom 🤔
**Approach**: Replace jsdom with happy-dom in vitest config
```javascript
test: {
  environment: 'happy-dom'  // instead of 'jsdom'
}
```
**Pros**:
- happy-dom is lighter, faster
- May not have this createElement issue
- Drop-in replacement for jsdom

**Cons**:
- Might have different incompatibilities
- Less mature than jsdom
- Could reveal new issues

**Effort**: Low (change config, test)

---

### Option 3: Split CI Jobs by Compatibility Mode 🔧
**Approach**:
- Job 1: componentApi: 4 for old tests (excluded ones)
- Job 2: No compatibility mode for Phase 2 tests

**Pros**:
- Isolates the issue
- Both test suites can pass
- Clean separation of concerns

**Cons**:
- More complex CI configuration
- Longer CI runs (parallel jobs)
- Doesn't solve root cause

**Effort**: Medium

---

### Option 4: Use Playwright Component Testing 🚀
**Approach**: Switch from jsdom to real browser testing
```javascript
// Use @playwright/experimental-ct-svelte
```
**Pros**:
- Real browser environment (no jsdom quirks)
- More realistic testing
- Better debugging tools

**Cons**:
- Significant refactor required
- Slower test execution
- More complex setup

**Effort**: High

---

### Option 5: Downgrade jsdom Version 📦
**Approach**: Try older jsdom version that might not have this issue
```json
"jsdom": "^24.0.0"  // or other older version
```
**Pros**:
- Simple to test
- Might just work

**Cons**:
- May lose bug fixes/features
- May have different issues
- Not a long-term solution

**Effort**: Low

---

### Option 6: Use Testing Library's render() with Svelte 4 Mode 🔄
**Approach**: Rewrite tests using @testing-library/svelte's render()
```javascript
// Instead of:
import { mount } from 'svelte';
component = mount(Component, { target, props });

// Use:
import { render } from '@testing-library/svelte';
const { container } = render(Component, { props });
```
**Pros**:
- Well-tested library
- Better abstraction
- More community support

**Cons**:
- Would need to rewrite all 135 tests
- Already tried this approach earlier (excluded tests)
- May still have issues

**Effort**: High

---

## Relevant Files

### Modified Files
- `.github/workflows/ci.yml` - npm install fallback
- `packages/web/tests/setup.ts` - All polyfills and workarounds
- `packages/web/tests/ci-debug.test.ts` - Debugging test
- `packages/web/vitest.config.js` - Test configuration

### Test Files
- `packages/web/tests/components/LocalFileTab.test.ts`
- `packages/web/tests/components/ResultsDisplay.test.ts`
- `packages/web/tests/components/ResultsTable.test.ts`
- `packages/web/tests/components/SettingsTab.test.ts`

### Debug Logs
Available in GitHub Actions runs on `feature/phase-2-component-testing` branch:
- Look for `[SETUP]` and `[CREATEELEMENT]` prefixed logs
- Run IDs: 18701913352, 18701941169, 18701992033, 18702016433

---

## Questions to Answer

1. **Why does createElement work in some test files but not others?**
   - Is there a specific operation that breaks it?
   - Does test execution order matter?

2. **Why does innerHTML not create child nodes?**
   - Is innerHTML setter broken too?
   - Or is the parsing mechanism broken?

3. **Can we reproduce this issue locally?**
   - Are there environment variables to make jsdom behave like CI?
   - Can we use Docker to replicate CI environment?

4. **Is this a known issue?**
   - Search Svelte 5 + jsdom issues
   - Search vitest + svelte 5 + componentApi issues
   - Check if happy-dom has similar issues

---

## Recommendation

**Try in this order:**

1. **First: Switch to happy-dom** (Effort: Low, Impact: Potentially High)
   - Quick test to see if different DOM implementation works
   - If it works, problem solved with minimal changes

2. **If that fails: Split CI Jobs** (Effort: Medium, Impact: High)
   - Practical workaround that lets us merge PR
   - Can investigate root cause in parallel

3. **Long-term: Investigate Playwright Component Testing** (Effort: High, Impact: High)
   - Most robust solution
   - Better testing overall
   - Worth exploring for future

---

## Commands for Further Investigation

```bash
# Run tests locally with CI-like settings
VITEST=true npm run test:run

# Check jsdom version in CI
npm ls jsdom

# Try happy-dom
npm install --save-dev happy-dom
# Edit vitest.config.js: environment: 'happy-dom'

# Run single test file to isolate issue
npm test -- tests/components/SettingsTab.test.ts

# Get detailed CI logs
gh run view <RUN_ID> --log | grep -E "\[SETUP\]|\[CREATEELEMENT\]"
```

---

**Last Updated**: 2025-10-22
**Investigation Time**: ~3 hours
**Attempts**: 6 major approaches
**Lines of Debug Code Added**: ~150
