# Svelte 5 Migration and Refactoring Plan

## Overview
This document outlines a plan to address issues and suggestions identified by the Svelte autofixer tool across the `packages/web/src/components` directory. The primary goals are to align the codebase with Svelte 5's runes mode best practices, improve accessibility, update deprecated syntax, and enhance overall code quality.

## Guiding Principles
*   **Iterative Approach:** Changes will be implemented component by component, prioritizing core functionality and high-impact issues first.
*   **Test-Driven Development:** Where applicable, new tests will be added or existing tests will be updated to ensure the correctness of changes.
*   **Maintainability:** Focus on clear, idiomatic Svelte 5 code.
*   **Performance:** Leverage Svelte 5's reactivity model for optimal performance.

## Identified Problem Areas (Summary)
*   **Reactivity Model Misuse:** Incorrect application of `$state`, `$derived`, and `$effect` leading to non-reactive updates or inefficient computations.
*   **Deprecated Event Handling:** Usage of `on:event` syntax instead of `onevent` attributes.
*   **Accessibility (A11y) Gaps:** Missing ARIA roles, keyboard event handlers for interactive elements.
*   **Code Cleanliness:** Unused CSS selectors, missing `key` attributes in `{#each}` blocks.
*   **Svelte-specific Data Structures:** Opportunity to use `SvelteSet` and `SvelteMap` for reactive collections.

## Detailed Plan

### Phase 1: Foundational Reactivity & Event Handling Updates

**Goal:** Address the most critical reactivity and event handling issues to ensure core functionality is stable and uses modern Svelte 5 syntax.

**Components to Address:**
*   `ResultsTable.svelte`
*   `LocalFileTab.svelte`
*   `GoogleDriveTab.svelte`
*   `BoxTab.svelte`

**Tasks for each component:**
1.  **Update Deprecated Event Handlers:**
    *   Replace `on:click`, `on:change`, `on:keydown`, `on:blur` with `onclick`, `onchange`, `onkeydown`, `onblur` respectively.
2.  **Correct `$state` and `$derived` Usage:**
    *   Identify variables updated within `$effect` blocks that should be `$state` or `$derived`.
    *   Refactor `$effect` blocks that reassign stateful variables to use `$derived` where appropriate, or ensure `$state` variables are correctly declared.
3.  **Address `bind:this` (in `ResultsTable.svelte`):**
    *   Evaluate if `bind:this` can be replaced with Svelte actions or attachments for better encapsulation and reusability.
4.  **Replace Native `Map`/`Set` with Svelte Equivalents (in `GoogleDriveTab.svelte`, `BoxTab.svelte`):**
    *   Change `new Map()` to `new SvelteMap()` and `new Set()` to `new SvelteSet()` where reactivity is desired for these collections.

### Phase 2: Accessibility & Code Cleanliness

**Goal:** Improve the application's accessibility and remove code cruft.

**Components to Address:**
*   `FileUpload.svelte`
*   `LocalFileTab.svelte`
*   `GoogleDriveTab.svelte`
*   `BoxTab.svelte`
*   `SettingsTab.svelte`

**Tasks for each component:**
1.  **Add ARIA Roles and Keyboard Handlers:**
    *   For non-interactive elements with click handlers (e.g., `<div>`, `<span>`), add appropriate `role` attributes (e.g., `role="button"`) and `onkeydown` handlers for keyboard accessibility.
2.  **Remove Unused CSS Selectors:**
    *   Delete any CSS rules identified as unused by the autofixer.
3.  **Add `key` attributes to `{#each}` blocks (in `SettingsTab.svelte`):**
    *   Ensure all `{#each}` blocks have a `key` attribute for efficient list rendering.

### Phase 3: Minor Adjustments & Review

**Goal:** Address remaining minor issues and perform a final review.

**Components to Address:**
*   `ResultsDisplay.svelte`

**Tasks:**
1.  **Update `export let` to `$props()` (in `ResultsDisplay.svelte`):**
    *   Change `export let` declarations to use the new `$props()` syntax for component properties in runes mode.

## Verification
After each phase, the following verification steps will be performed:
*   **Local Testing:** Run the application locally (`npm run dev`) to ensure all features function as expected.
*   **Unit Tests:** Run existing unit tests (`npm test`). New tests will be added for critical changes.
*   **Linter/Type Checker:** Run `ruff check .` (or equivalent) and `tsc --noEmit` to ensure code quality and type correctness.

## Timeline (Estimated)
*   **Phase 1:** 3-5 days
*   **Phase 2:** 2-3 days
*   **Phase 3:** 1 day

## Deliverables
*   Updated Svelte components with fixes.
*   (Potentially) New/updated test files.
*   This Markdown plan document.
