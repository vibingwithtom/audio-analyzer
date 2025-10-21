# Phase 2 Component Testing Strategy

**Created:** October 21, 2025
**Status:** Planning Phase
**Goal:** Achieve 70%+ code coverage through comprehensive component testing
**Timeline:** November 2025 (2-4 weeks)
**Effort:** 20-30 hours

---

## Executive Summary

Phase 2 focuses on testing the UI layer of the application - all Svelte components. With Phase 1's solid foundation of utility and service tests (1,100+ tests), we now move to ensuring the user interface works correctly and maintains quality as the application evolves.

**Key Objectives:**
- Test all 11 Svelte components
- Achieve 70%+ overall code coverage
- Ensure UI reliability and maintainability
- Create reusable component testing infrastructure

---

## Component Inventory & Priority Matrix

### Priority 1 - Core User Interaction (Test First)

| Component | Lines | Complexity | Impact | Effort | Notes |
|-----------|-------|------------|--------|--------|-------|
| **LocalFileTab.svelte** | 996 | High | Critical | 4-5h | Primary user interface |
| **ResultsTable.svelte** | 1,371 | High | Critical | 5-6h | Core results display |
| **ResultsDisplay.svelte** | 887 | Medium | High | 3-4h | Results container |
| **SettingsTab.svelte** | 751 | Medium | High | 3-4h | Configuration UI |

**Total Priority 1:** 15-19 hours

### Priority 2 - Integration Points (Test Second)

| Component | Lines | Complexity | Impact | Effort | Notes |
|-----------|-------|------------|--------|--------|-------|
| **GoogleDriveTab.svelte** | 1,711 | Very High | High | 6-7h | Complex OAuth flow |
| **BoxTab.svelte** | 1,274 | High | Medium | 5-6h | Similar to Google Drive |
| **FileUpload.svelte** | 288 | Low | Medium | 2-3h | File handling component |

**Total Priority 2:** 13-16 hours

### Priority 3 - Support Components (Test Last)

| Component | Lines | Complexity | Impact | Effort | Notes |
|-----------|-------|------------|--------|--------|-------|
| **App.svelte** | 290 | Medium | Medium | 2-3h | Main app wrapper |
| **TabNavigation.svelte** | 95 | Low | Low | 1-2h | Navigation UI |
| **UpdateBanner.svelte** | 174 | Low | Low | 1-2h | Update notifications |
| **StatusBadge.svelte** | 45 | Very Low | Low | 1h | Simple status display |

**Total Priority 3:** 5-8 hours

**Grand Total:** 33-43 hours (conservative estimate)

---

## Testing Approach & Infrastructure

### 1. Component Test Setup (2-3 hours)

Create foundational testing infrastructure:

```javascript
// packages/web/tests/utils/component-test-helpers.js
import { render, cleanup } from '@testing-library/svelte';
import { vi } from 'vitest';

export function createComponentTest(Component) {
  return {
    render: (props = {}) => render(Component, props),
    cleanup: () => cleanup(),
    mockStore: (initialState = {}) => {
      // Mock Svelte stores
    },
    mockApi: () => {
      // Mock API calls
    }
  };
}
```

### 2. Common Test Patterns

#### Testing User Interactions
```javascript
import { fireEvent, waitFor } from '@testing-library/svelte';

it('should handle file selection', async () => {
  const { getByLabelText } = render(LocalFileTab);
  const input = getByLabelText('Select files');

  const files = [new File(['content'], 'test.wav')];
  await fireEvent.change(input, { target: { files } });

  await waitFor(() => {
    expect(getByText('test.wav')).toBeInTheDocument();
  });
});
```

#### Testing Store Updates
```javascript
it('should update settings store on change', async () => {
  const mockSettings = writable({ preset: 'auditions' });
  const { getByLabelText } = render(SettingsTab, { settings: mockSettings });

  await fireEvent.change(getByLabelText('Preset'), {
    target: { value: 'threehour' }
  });

  const value = get(mockSettings);
  expect(value.preset).toBe('threehour');
});
```

#### Testing Component Props
```javascript
it('should display results correctly', () => {
  const mockResults = [
    { filename: 'test.wav', status: 'pass', duration: 120 }
  ];

  const { getByText } = render(ResultsTable, { results: mockResults });
  expect(getByText('test.wav')).toBeInTheDocument();
  expect(getByText('Pass')).toBeInTheDocument();
  expect(getByText('2:00')).toBeInTheDocument();
});
```

---

## Implementation Phases

### Week 1: Infrastructure & Priority 1 Components (Oct 21-27)

**Day 1-2: Setup & LocalFileTab**
- [ ] Create test helper utilities (2h)
- [ ] Set up component mocking framework (1h)
- [ ] Write LocalFileTab tests (4-5h)
  - File selection
  - Drag and drop
  - Batch processing
  - Error handling
  - Progress tracking

**Day 3-4: ResultsTable**
- [ ] Write ResultsTable tests (5-6h)
  - Data display
  - Sorting
  - Filtering
  - Export functionality
  - Column customization
  - Sticky columns
  - Horizontal scrolling

**Day 5: ResultsDisplay & SettingsTab**
- [ ] Write ResultsDisplay tests (3-4h)
  - Results aggregation
  - Summary statistics
  - Mode switching
- [ ] Write SettingsTab tests (3-4h)
  - Preset selection
  - Custom criteria
  - Settings persistence

### Week 2: Priority 2 Components (Oct 28 - Nov 3)

**Day 6-7: GoogleDriveTab**
- [ ] Write GoogleDriveTab tests (6-7h)
  - OAuth flow mocking
  - File/folder selection
  - URL parsing
  - Download progress
  - Error states

**Day 8-9: BoxTab & FileUpload**
- [ ] Write BoxTab tests (5-6h)
  - Similar to GoogleDriveTab
  - Box-specific auth flow
- [ ] Write FileUpload tests (2-3h)
  - Drag and drop
  - File validation
  - Multiple file handling

### Week 3: Priority 3 & Polish (Nov 4-10)

**Day 10: Support Components**
- [ ] Write App.svelte tests (2-3h)
- [ ] Write TabNavigation tests (1-2h)
- [ ] Write UpdateBanner tests (1-2h)
- [ ] Write StatusBadge tests (1h)

**Day 11-12: Integration & Coverage**
- [ ] Run coverage report
- [ ] Fill coverage gaps
- [ ] Update documentation
- [ ] Create PR to staging

---

## Test Coverage Strategy

### What to Test

**Critical Paths (Must Test):**
1. File selection and upload flow
2. Results display and export
3. Settings changes and persistence
4. OAuth authentication flows
5. Error handling and recovery
6. Data validation and processing

**UI Behaviors (Should Test):**
1. Loading states
2. Error states
3. Empty states
4. Progress indicators
5. Modal dialogs
6. Tab switching
7. Form validation

**Edge Cases (Nice to Have):**
1. Large file handling
2. Network interruptions
3. Browser compatibility issues
4. Memory leaks
5. Performance under load

### What NOT to Test

**Skip Testing:**
1. Third-party library internals
2. Pure CSS styling
3. Browser APIs (unless mocked)
4. External service responses (mock instead)

---

## Success Metrics

### Quantitative Metrics
- [ ] 70%+ overall code coverage
- [ ] 100% of Priority 1 components tested
- [ ] 80%+ of Priority 2 components tested
- [ ] 50%+ of Priority 3 components tested
- [ ] Zero failing tests
- [ ] < 60 second total test runtime

### Qualitative Metrics
- [ ] Tests are maintainable and clear
- [ ] Test failures provide helpful error messages
- [ ] Mocking strategy is consistent
- [ ] Documentation is comprehensive
- [ ] Team can easily add new tests

---

## Risk Mitigation

### Technical Risks

**Risk:** Svelte component testing complexity
- **Mitigation:** Use @testing-library/svelte for standardized testing
- **Mitigation:** Create comprehensive test helpers upfront

**Risk:** OAuth flow testing difficulty
- **Mitigation:** Mock authentication entirely
- **Mitigation:** Focus on post-auth behavior

**Risk:** Store reactivity testing challenges
- **Mitigation:** Use controlled store instances in tests
- **Mitigation:** Test store updates separately from UI

### Schedule Risks

**Risk:** Underestimated effort (33-43 hours may be optimistic)
- **Mitigation:** Focus on Priority 1 first
- **Mitigation:** Accept 60% coverage if time constrained
- **Mitigation:** Defer Priority 3 to Phase 3 if needed

---

## Dependencies

### Required Packages
```json
{
  "devDependencies": {
    "@testing-library/svelte": "^4.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^22.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0"
  }
}
```

### Configuration Updates

**vitest.config.js updates:**
```javascript
export default {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/component-test-setup.js'],
    coverage: {
      include: ['src/components/**/*.svelte']
    }
  }
}
```

---

## Example Test File Structure

```
packages/web/tests/components/
├── LocalFileTab.test.js
├── ResultsTable.test.js
├── ResultsDisplay.test.js
├── SettingsTab.test.js
├── GoogleDriveTab.test.js
├── BoxTab.test.js
├── FileUpload.test.js
├── App.test.js
├── TabNavigation.test.js
├── UpdateBanner.test.js
├── StatusBadge.test.js
└── __fixtures__/
    ├── mockResults.js
    ├── mockSettings.js
    └── mockFiles.js
```

---

## Next Steps

### Immediate Actions (Today)
1. ✅ Review this strategy document
2. [ ] Install required testing packages
3. [ ] Create component test setup file
4. [ ] Start with LocalFileTab tests

### This Week
1. [ ] Complete Priority 1 components
2. [ ] Run first coverage report
3. [ ] Adjust strategy based on findings

### By End of November
1. [ ] All components tested
2. [ ] 70%+ coverage achieved
3. [ ] Documentation updated
4. [ ] Ready for Phase 3

---

## Appendix A: Component Complexity Analysis

### LocalFileTab.svelte (996 lines)
**Key Features:**
- File selection (single/multiple)
- Drag and drop
- File validation
- Batch processing
- Progress tracking
- Results display
- Export functionality

**Testing Challenges:**
- File API mocking
- Drag/drop events
- Progress updates
- Worker communication

### ResultsTable.svelte (1,371 lines)
**Key Features:**
- Dynamic columns
- Sorting
- Filtering
- Sticky columns
- Horizontal scrolling
- Export to CSV
- Responsive design

**Testing Challenges:**
- Complex DOM manipulation
- Scroll behavior
- Dynamic column generation
- Export functionality

### GoogleDriveTab.svelte (1,711 lines)
**Key Features:**
- OAuth authentication
- File picker
- Folder navigation
- URL parsing
- Download progress
- Smart downloads
- Error recovery

**Testing Challenges:**
- OAuth mocking
- Google API mocking
- Async operations
- Network states

---

## Appendix B: Coverage Goals by Component

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| LocalFileTab | 0% | 80%+ | P1 |
| ResultsTable | 0% | 80%+ | P1 |
| ResultsDisplay | 0% | 70%+ | P1 |
| SettingsTab | 0% | 70%+ | P1 |
| GoogleDriveTab | 0% | 60%+ | P2 |
| BoxTab | 0% | 60%+ | P2 |
| FileUpload | 0% | 70%+ | P2 |
| App | 0% | 50%+ | P3 |
| TabNavigation | 0% | 50%+ | P3 |
| UpdateBanner | 0% | 40%+ | P3 |
| StatusBadge | 0% | 40%+ | P3 |

---

**Document Status:** Active - Planning Phase
**Next Review:** October 28, 2025
**Owner:** Development Team