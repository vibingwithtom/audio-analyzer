# Svelte Component Testing Infrastructure Issue

## Problem
@sveltejs/vite-plugin-svelte v6.0.0 is incompatible with Vitest's component testing setup due to HMR (Hot Module Replacement) configuration issues.

### Error Details
```
TypeError: Cannot convert undefined or null to object
    at Object.values (<anonymous>)
    at configureServer (file:///.../@sveltejs/vite-plugin-svelte/src/plugins/hot-update.js:56:37)
```

The `configureServer` hook in the Svelte plugin is trying to access HMR configuration that is `undefined` in the test environment.

### Attempted Fixes (All Failed)
1. **Setting `hot: false`** - Plugin still attempts configureServer hook
2. **Disabling HMR explicitly** - Hook still executes
3. **Removing configureServer hook** - Creates new error in load-custom.js hook (missing config context)
4. **Spread operator wrapper** - Hook state not properly initialized
5. **Compiler options** - Doesn't prevent hook execution

## Root Cause Analysis
The Svelte plugin maintains internal state that is initialized in the `configureServer` hook. Removing or disabling this hook breaks the plugin's load-custom and transform hooks, which depend on the initialized config context.

The plugin's architecture expects a full Vite server lifecycle (with HMR) even in test mode, but Vitest runs plugins without proper HMR setup for testing.

## Solution Options

### Option 1: Upgrade @sveltejs/vite-plugin-svelte (Recommended)
**Status**: Not tested - newer versions may have better test support
```bash
npm update @sveltejs/vite-plugin-svelte
```
Check releases for fixes to HMR/test mode compatibility.

### Option 2: Downgrade to v5.x (Safer)
Older versions may have better Vitest compatibility:
```bash
npm install --save-dev @sveltejs/vite-plugin-svelte@^5.0.0
```

### Option 3: Use Svelte Test Library Alternative
Switch to snapshot testing or use `svelte-jester` instead of the Vite plugin.

### Option 4: Custom Test Transformer
Create a custom Vite plugin specifically for Svelte + Vitest that handles component transformation without HMR.

### Option 5: Extract Component Logic to Functions
Move complex logic from components to separate, testable utility functions that don't require component testing.

## Test Status
- **LocalFileTab.test.ts**: Created with 50+ comprehensive test cases
- **Test Helpers**: Fully implemented (component-test-helpers.ts)
- **Mock Data**: Fully implemented (mockData.ts)
- **Status**: Ready to run once infrastructure is fixed

## Next Steps
1. Try upgrading @sveltejs/vite-plugin-svelte to latest version
2. If that doesn't work, downgrade to v5.x
3. If neither works, implement Option 4 or 5 above

## Related Files
- `vitest.config.js` - Contains attempted Svelte plugin configuration
- `tests/components/LocalFileTab.test.ts` - Comprehensive test suite waiting for infrastructure fix
- `tests/utils/component-test-helpers.ts` - Test utilities (working)
- `tests/fixtures/mockData.ts` - Mock data (working)
