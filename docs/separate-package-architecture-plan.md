# Separate Package Architecture Plan
## AudioTalent External Site Implementation

## Executive Summary

**Decision:** Create a separate package (`web-external`) for the external user-facing tool (AudioTalent) rather than using build modes in the existing `web` package.

**Rationale:**
- Complete isolation prevents breaking external users when adding power features
- Smaller bundle sizes for each audience
- Independent evolution paths
- Clearer mental model and safer deployments
- Aligns with existing monorepo pattern (web, extension, desktop)

---

## Architecture Overview

### Current Structure
```
packages/
  core/           - Shared analysis engine
  web/            - Internal power user tool
  extension/      - Chrome extension
  desktop/        - Electron app
```

### Proposed Structure
```
packages/
  core/              - Shared analysis engine (no changes)
  ui-common/         - NEW: Shared UI components
  web/               - Internal power user tool (minimal changes)
  web-external/      - NEW: External simplified tool (audiotalent)
  extension/         - Chrome extension (no changes)
  desktop/           - Electron app (no changes)
```

### Dependency Flow
```
web-external ──→ ui-common ──→ core
                    ↑
web ───────────────┘
```

---

## Phase 1: Create UI Common Package

### 1.1 Package Setup

**Create new package:**
```bash
mkdir -p packages/ui-common/src/{components,utils,styles}
cd packages/ui-common
npm init -y
```

**packages/ui-common/package.json:**
```json
{
  "name": "@audio-analyzer/ui-common",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./components/*": "./src/components/*.js",
    "./utils/*": "./src/utils/*.js",
    "./styles/*": "./src/styles/*.css"
  },
  "dependencies": {
    "@audio-analyzer/core": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### 1.2 Identify Shared Components

**Components to extract from web package:**

**File Upload & Selection:**
- `FileUploadArea.js` - Drag & drop file selection
- `FileSelector.js` - File picker button
- `FileListDisplay.js` - Display selected files

**Results Display:**
- `ResultsTable.js` - Show analysis results
- `ValidationStatus.js` - Pass/Fail/Warning badges
- `PropertyDisplay.js` - Format audio properties
- `StatusIcon.js` - Visual status indicators

**Progress & Loading:**
- `ProgressBar.js` - Analysis progress
- `LoadingSpinner.js` - Loading states
- `BatchProgress.js` - Batch processing progress

**UI Components:**
- `Tabs.js` - Tab navigation
- `Button.js` - Styled buttons
- `Modal.js` - Modal dialogs
- `Tooltip.js` - Help tooltips
- `Alert.js` - Alert messages

**Utility Functions:**
- `formatting.js` - Format file sizes, durations, sample rates
- `validation-display.js` - Format validation messages
- `status-calculation.js` - Calculate overall status

### 1.3 Extract Shared Components

**Step-by-step extraction:**

1. **Create component in ui-common:**
```javascript
// packages/ui-common/src/components/ResultsTable.js
export class ResultsTable {
  constructor() {
    this.container = null;
  }

  render(results) {
    // Render logic (extracted from web package)
  }

  formatValue(key, value) {
    // Formatting logic
  }
}
```

2. **Update web package to import from ui-common:**
```javascript
// packages/web/src/tabs/local-file-tab.js
// OLD:
// import { ResultsTable } from '../components/results-table.js';

// NEW:
import { ResultsTable } from '@audio-analyzer/ui-common/components/ResultsTable';
```

3. **Update package.json dependencies:**
```json
// packages/web/package.json
{
  "dependencies": {
    "@audio-analyzer/core": "workspace:*",
    "@audio-analyzer/ui-common": "workspace:*"
  }
}
```

4. **Remove component from web package:**
```bash
git rm packages/web/src/components/results-table.js
```

### 1.4 Component Extraction Priority

**Phase 1A - Critical shared components:**
1. `ResultsTable.js`
2. `ValidationStatus.js`
3. `ProgressBar.js`
4. `formatting.js` utilities

**Phase 1B - Secondary components:**
5. `FileUploadArea.js`
6. `LoadingSpinner.js`
7. `StatusIcon.js`
8. `Alert.js`

**Phase 1C - Nice-to-have:**
9. `Tabs.js`
10. `Button.js`
11. `Modal.js`
12. `Tooltip.js`

### 1.5 Testing Strategy for ui-common

**packages/ui-common/tests/components/ResultsTable.test.js:**
```javascript
import { describe, it, expect } from 'vitest';
import { ResultsTable } from '../../src/components/ResultsTable.js';

describe('ResultsTable', () => {
  it('should render audio properties correctly', () => {
    const table = new ResultsTable();
    const results = {
      fileType: 'WAV (PCM)',
      sampleRate: 48000,
      bitDepth: 24,
      channels: 2
    };

    const html = table.render(results);
    expect(html).toContain('WAV (PCM)');
    expect(html).toContain('48.0 kHz');
  });

  it('should format validation status with correct badges', () => {
    // Test validation display logic
  });
});
```

**Run tests:**
```bash
cd packages/ui-common
npm test
```

---

## Phase 2: Create web-external Package

### 2.1 Initial Package Setup

**Create from web package template:**
```bash
# Copy web package as starting point
cp -r packages/web packages/web-external

# Update package name
cd packages/web-external
```

**packages/web-external/package.json:**
```json
{
  "name": "@audio-analyzer/web-external",
  "version": "1.0.0",
  "description": "AudioTalent - Simplified audio validation tool for external users",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@audio-analyzer/core": "workspace:*",
    "@audio-analyzer/ui-common": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### 2.2 Remove Unwanted Features

**Files to delete:**
```bash
# Box integration
rm -rf src/services/box-*.js
rm -rf src/tabs/box-tab.js
rm -rf tests/unit/box-*.test.js

# Custom presets
rm -rf src/settings/custom-presets.js
rm -rf tests/unit/preset-*.test.js

# Experimental features
rm -rf src/analysis/experimental-*.js
rm -rf tests/unit/experimental-*.test.js

# Advanced export features
rm -rf src/export/advanced-export.js
```

**Features to remove from code:**
- Box OAuth integration
- Custom preset creation/editing
- Experimental analysis mode toggle
- Advanced export options
- Technical debug information
- Batch processing from Box

### 2.3 Simplify Main Application

**packages/web-external/src/main.js:**
```javascript
import { AudioAnalyzer } from '@audio-analyzer/core';
import { LocalFileTab } from './tabs/local-file-tab.js';
import { GoogleDriveTab } from './tabs/google-drive-tab.js';
import { PresetManager } from './presets/preset-manager.js';
import { TipsManager } from './tips/tips-manager.js';

// Set app title and branding
document.title = 'AudioTalent - Audio Validator';

// Initialize simplified app
class AudioTalentApp {
  constructor() {
    this.currentTab = 'local';
    this.presetManager = new PresetManager({ simplified: true });
    this.tipsManager = new TipsManager();

    this.initTabs();
    this.initPresets();
    this.showWelcomeTips();
  }

  initTabs() {
    // Only Local and Google Drive tabs
    this.tabs = {
      local: new LocalFileTab(),
      'google-drive': new GoogleDriveTab()
    };

    // No Box tab
  }

  initPresets() {
    // Limited preset options
    const allowedPresets = [
      'auditions',
      'character-recordings',
      'three-hour',
      'bilingual-conversational'
    ];

    this.presetManager.filterPresets(allowedPresets);
  }

  showWelcomeTips() {
    this.tipsManager.showTip({
      title: 'Welcome to AudioTalent!',
      message: 'Upload your audio files to validate quality and format.',
      type: 'info'
    });
  }
}

// Initialize app
const app = new AudioTalentApp();
```

### 2.4 Add User Guidance Features

**Create tips system:**
```javascript
// packages/web-external/src/tips/tips-manager.js
export class TipsManager {
  constructor() {
    this.tips = this.loadTips();
  }

  loadTips() {
    return {
      fileUpload: {
        title: 'Uploading Files',
        message: 'Drag and drop audio files or click to browse. Supports WAV, MP3, and more.',
        showWhen: 'on-page-load'
      },
      presetSelection: {
        title: 'Choose Your Preset',
        message: 'Select the type of recording you\'re validating for automatic quality checks.',
        showWhen: 'before-analysis'
      },
      googleDrive: {
        title: 'Google Drive Integration',
        message: 'Connect your Google account to validate files directly from Google Drive.',
        showWhen: 'first-gdrive-visit'
      },
      results: {
        title: 'Understanding Results',
        message: 'Green means pass, yellow is a warning, red means the file needs attention.',
        showWhen: 'first-results'
      }
    };
  }

  showTip(tipKey) {
    const tip = this.tips[tipKey];
    if (!tip) return;

    // Check if user has already seen this tip
    if (this.hasSeenTip(tipKey)) return;

    this.displayTip(tip);
    this.markTipAsSeen(tipKey);
  }

  displayTip(tip) {
    // Display tooltip/modal with tip content
    const tipElement = document.createElement('div');
    tipElement.className = 'tip-card';
    tipElement.innerHTML = `
      <div class="tip-header">
        <span class="tip-icon">💡</span>
        <h3>${tip.title}</h3>
        <button class="tip-close">×</button>
      </div>
      <p>${tip.message}</p>
    `;

    document.body.appendChild(tipElement);
  }

  hasSeenTip(tipKey) {
    const seenTips = JSON.parse(localStorage.getItem('seenTips') || '[]');
    return seenTips.includes(tipKey);
  }

  markTipAsSeen(tipKey) {
    const seenTips = JSON.parse(localStorage.getItem('seenTips') || '[]');
    seenTips.push(tipKey);
    localStorage.setItem('seenTips', JSON.stringify(seenTips));
  }
}
```

### 2.5 Simplify Preset Manager

**packages/web-external/src/presets/preset-manager.js:**
```javascript
export class PresetManager {
  constructor(options = {}) {
    this.simplified = options.simplified || false;
    this.presets = this.loadPresets();
  }

  loadPresets() {
    const allPresets = {
      'auditions': {
        name: 'Auditions',
        description: 'Voice acting auditions and demos',
        icon: '🎤',
        criteria: {
          fileType: ['WAV', 'MP3'],
          sampleRate: [44100, 48000],
          bitDepth: [16, 24],
          channels: [1, 2]
        }
      },
      'character-recordings': {
        name: 'Character Recordings',
        description: 'Game or animation character dialogue',
        icon: '🎮',
        criteria: {
          fileType: 'WAV',
          sampleRate: 48000,
          bitDepth: [16, 24],
          channels: 1
        }
      },
      'three-hour': {
        name: 'Three Hour Sessions',
        description: 'Long-form recording sessions',
        icon: '⏱️',
        criteria: {
          fileType: 'WAV',
          sampleRate: 48000,
          bitDepth: 24,
          channels: 2,
          minDuration: 10800 // 3 hours
        }
      },
      'bilingual-conversational': {
        name: 'Bilingual Conversations',
        description: 'Multi-language conversational audio',
        icon: '🌐',
        criteria: {
          fileType: ['WAV', 'MP3'],
          sampleRate: [44100, 48000],
          bitDepth: [16, 24],
          channels: 2
        }
      }
    };

    // Return all presets if not simplified
    if (!this.simplified) return allPresets;

    // For simplified mode, only return basic presets with descriptions
    return allPresets;
  }

  renderPresetSelector() {
    const container = document.getElementById('preset-selector');

    if (this.simplified) {
      // Simplified UI with icons and descriptions
      container.innerHTML = `
        <div class="preset-grid">
          ${Object.entries(this.presets).map(([id, preset]) => `
            <div class="preset-card" data-preset="${id}">
              <div class="preset-icon">${preset.icon}</div>
              <h3>${preset.name}</h3>
              <p>${preset.description}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Technical UI (existing implementation)
      // ...
    }
  }
}
```

### 2.6 Simplified Results Display

**packages/web-external/src/results/results-display.js:**
```javascript
import { ResultsTable } from '@audio-analyzer/ui-common/components/ResultsTable';
import { formatFileSize, formatDuration } from '@audio-analyzer/ui-common/utils/formatting';

export class SimplifiedResultsDisplay {
  constructor() {
    this.resultsTable = new ResultsTable();
  }

  render(results) {
    const container = document.getElementById('results-container');

    // Friendly summary at top
    const summary = this.createSummary(results);

    // Simplified results table
    const table = this.createSimplifiedTable(results);

    // Helpful next steps
    const nextSteps = this.createNextSteps(results);

    container.innerHTML = `
      ${summary}
      ${table}
      ${nextSteps}
    `;
  }

  createSummary(results) {
    const status = results.status || 'pass';
    const statusMessages = {
      pass: {
        icon: '✅',
        title: 'Great! Your file passed all checks.',
        message: 'This audio file meets the quality requirements.'
      },
      warning: {
        icon: '⚠️',
        title: 'Almost there! Minor issues found.',
        message: 'Your file has some warnings but may still be usable.'
      },
      fail: {
        icon: '❌',
        title: 'Issues found that need attention.',
        message: 'This file doesn\'t meet the requirements. See details below.'
      }
    };

    const msg = statusMessages[status];

    return `
      <div class="summary-card status-${status}">
        <div class="summary-icon">${msg.icon}</div>
        <div class="summary-content">
          <h2>${msg.title}</h2>
          <p>${msg.message}</p>
        </div>
      </div>
    `;
  }

  createSimplifiedTable(results) {
    // Hide technical details, show only key info
    const displayFields = [
      { key: 'filename', label: 'File Name' },
      { key: 'fileType', label: 'Format' },
      { key: 'duration', label: 'Length', format: formatDuration },
      { key: 'fileSize', label: 'Size', format: formatFileSize },
      { key: 'sampleRate', label: 'Quality' },
      { key: 'channels', label: 'Audio Type', format: (v) => v === 1 ? 'Mono' : 'Stereo' }
    ];

    // Only show validation issues if present
    const issues = this.extractIssues(results);

    return `
      <div class="results-table-simple">
        <h3>File Details</h3>
        <table>
          ${displayFields.map(field => {
            const value = results[field.key];
            const displayValue = field.format ? field.format(value) : value;
            return `
              <tr>
                <td class="label">${field.label}</td>
                <td class="value">${displayValue}</td>
              </tr>
            `;
          }).join('')}
        </table>

        ${issues.length > 0 ? `
          <h3>Issues to Address</h3>
          <ul class="issues-list">
            ${issues.map(issue => `
              <li class="issue-${issue.severity}">
                ${issue.icon} ${issue.message}
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  extractIssues(results) {
    const issues = [];

    if (results.validation) {
      Object.entries(results.validation).forEach(([key, validation]) => {
        if (validation.status === 'fail') {
          issues.push({
            severity: 'error',
            icon: '❌',
            message: validation.message || `${key} does not meet requirements`
          });
        } else if (validation.status === 'warning') {
          issues.push({
            severity: 'warning',
            icon: '⚠️',
            message: validation.message || `${key} has minor issues`
          });
        }
      });
    }

    return issues;
  }

  createNextSteps(results) {
    const status = results.status || 'pass';

    const nextStepsContent = {
      pass: `
        <h3>What's Next?</h3>
        <ul>
          <li>✅ Your file is ready to use</li>
          <li>📤 You can proceed with uploading or submitting</li>
          <li>📁 Want to check more files? Upload another one above</li>
        </ul>
      `,
      warning: `
        <h3>What's Next?</h3>
        <ul>
          <li>⚠️ Review the warnings above</li>
          <li>🤔 Decide if these warnings are acceptable for your use case</li>
          <li>🔄 Or re-record/re-export to fix the issues</li>
        </ul>
      `,
      fail: `
        <h3>How to Fix</h3>
        <ul>
          <li>📝 Review the issues listed above</li>
          <li>🎙️ Re-record your audio with the correct settings</li>
          <li>🔧 Or use audio editing software to convert the file</li>
          <li>❓ Need help? <a href="#support">Contact support</a></li>
        </ul>
      `
    };

    return `
      <div class="next-steps-card">
        ${nextStepsContent[status]}
      </div>
    `;
  }
}
```

### 2.7 Styling for External Site

**packages/web-external/src/styles/main.css:**
```css
/* AudioTalent branding - warmer, friendlier colors */
:root {
  --primary-color: #4A90E2;      /* Friendly blue */
  --success-color: #7ED321;      /* Bright green */
  --warning-color: #F5A623;      /* Warm orange */
  --error-color: #D0021B;        /* Clear red */
  --background: #F9FAFB;         /* Light, clean background */
  --card-bg: #FFFFFF;
  --border-radius: 12px;         /* Softer corners */
  --shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Simplified, card-based layout */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 30px 0;
}

.preset-card {
  background: var(--card-bg);
  border: 2px solid #E8E8E8;
  border-radius: var(--border-radius);
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.preset-card:hover {
  border-color: var(--primary-color);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.preset-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.preset-card h3 {
  font-size: 18px;
  margin: 10px 0;
  color: #333;
}

.preset-card p {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

/* Friendly summary cards */
.summary-card {
  display: flex;
  align-items: center;
  padding: 25px;
  border-radius: var(--border-radius);
  margin-bottom: 30px;
  box-shadow: var(--shadow);
}

.summary-card.status-pass {
  background: linear-gradient(135deg, #7ED321 0%, #6BC314 100%);
  color: white;
}

.summary-card.status-warning {
  background: linear-gradient(135deg, #F5A623 0%, #E89D1A 100%);
  color: white;
}

.summary-card.status-fail {
  background: linear-gradient(135deg, #D0021B 0%, #B80118 100%);
  color: white;
}

.summary-icon {
  font-size: 60px;
  margin-right: 25px;
}

.summary-content h2 {
  font-size: 24px;
  margin: 0 0 10px 0;
}

.summary-content p {
  font-size: 16px;
  margin: 0;
  opacity: 0.95;
}

/* Simplified results table */
.results-table-simple {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 30px;
  box-shadow: var(--shadow);
}

.results-table-simple h3 {
  font-size: 20px;
  margin: 0 0 20px 0;
  color: #333;
}

.results-table-simple table {
  width: 100%;
  border-collapse: collapse;
}

.results-table-simple td {
  padding: 12px 0;
  border-bottom: 1px solid #F0F0F0;
}

.results-table-simple td.label {
  font-weight: 500;
  color: #666;
  width: 150px;
}

.results-table-simple td.value {
  color: #333;
  font-weight: 400;
}

/* Issues list */
.issues-list {
  list-style: none;
  padding: 0;
  margin: 20px 0 0 0;
}

.issues-list li {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 15px;
}

.issues-list .issue-error {
  background: #FFEBEE;
  color: #C62828;
  border-left: 4px solid var(--error-color);
}

.issues-list .issue-warning {
  background: #FFF8E1;
  color: #F57C00;
  border-left: 4px solid var(--warning-color);
}

/* Tip cards */
.tip-card {
  position: fixed;
  bottom: 30px;
  right: 30px;
  max-width: 350px;
  background: white;
  border-radius: var(--border-radius);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  padding: 20px;
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    transform: translateY(100px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.tip-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.tip-icon {
  font-size: 24px;
  margin-right: 10px;
}

.tip-header h3 {
  flex: 1;
  font-size: 16px;
  margin: 0;
  color: #333;
}

.tip-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  line-height: 1;
}

.tip-card p {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

/* Next steps card */
.next-steps-card {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 30px;
  margin-top: 30px;
  box-shadow: var(--shadow);
}

.next-steps-card h3 {
  font-size: 20px;
  margin: 0 0 15px 0;
  color: #333;
}

.next-steps-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.next-steps-card li {
  padding: 10px 0;
  font-size: 15px;
  color: #555;
  line-height: 1.6;
}

/* Hide advanced features */
.advanced-options,
.experimental-mode-toggle,
.custom-preset-editor,
.technical-details {
  display: none !important;
}
```

---

## Phase 3: Update Root Configuration

### 3.1 Root package.json

**Update workspace packages:**
```json
{
  "name": "audio-analyzer",
  "workspaces": [
    "packages/core",
    "packages/ui-common",
    "packages/web",
    "packages/web-external",
    "packages/extension",
    "packages/desktop"
  ],
  "scripts": {
    "dev:internal": "npm run dev --workspace=@audio-analyzer/web",
    "dev:external": "npm run dev --workspace=@audio-analyzer/web-external",
    "build:all": "npm run build --workspaces --if-present",
    "build:internal": "npm run build --workspace=@audio-analyzer/web",
    "build:external": "npm run build --workspace=@audio-analyzer/web-external",
    "test:all": "npm run test --workspaces --if-present",
    "deploy:internal": "npm run build:internal && firebase deploy --only hosting:audio-analyzer",
    "deploy:external": "npm run build:external && firebase deploy --only hosting:audiotalent"
  }
}
```

### 3.2 Firebase Configuration

**firebase.json:**
```json
{
  "hosting": [
    {
      "site": "audio-analyzer",
      "public": "packages/web/dist",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css|png|jpg|svg)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "max-age=31536000"
            }
          ]
        }
      ]
    },
    {
      "site": "audiotalent",
      "public": "packages/web-external/dist",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css|png|jpg|svg)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "max-age=31536000"
            }
          ]
        }
      ]
    }
  ]
}
```

**.firebaserc:**
```json
{
  "projects": {
    "default": "audio-analyzer"
  },
  "targets": {
    "audio-analyzer": {
      "hosting": {
        "internal": ["audio-analyzer"],
        "external": ["audiotalent"]
      }
    }
  }
}
```

---

## Phase 4: GitHub Actions Configuration

### 4.1 Separate Workflows

**.github/workflows/deploy-internal.yml:**
```yaml
name: Deploy Internal Site (Audio Analyzer)

on:
  push:
    branches:
      - main
    paths:
      - 'packages/core/**'
      - 'packages/ui-common/**'
      - 'packages/web/**'
      - '.github/workflows/deploy-internal.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm run test:all

      - name: Build internal site
        run: npm run build:internal

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          target: internal
          projectId: audio-analyzer
```

**.github/workflows/deploy-external.yml:**
```yaml
name: Deploy External Site (AudioTalent)

on:
  push:
    branches:
      - main
    paths:
      - 'packages/core/**'
      - 'packages/ui-common/**'
      - 'packages/web-external/**'
      - '.github/workflows/deploy-external.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm run test:all

      - name: Build external site
        run: npm run build:external

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          target: external
          projectId: audio-analyzer
```

### 4.2 Path-based Deployment Triggers

**Key feature:** Each workflow only triggers on changes to relevant packages.

- Changes to `packages/web` → Deploy internal only
- Changes to `packages/web-external` → Deploy external only
- Changes to `packages/core` or `packages/ui-common` → Deploy BOTH (shared dependencies)

---

## Phase 5: Testing Strategy

### 5.1 Test Structure

```
packages/
  ui-common/
    tests/
      components/
        ResultsTable.test.js
        ValidationStatus.test.js
      utils/
        formatting.test.js

  web/
    tests/
      unit/
        (existing tests)
      integration/
        (existing tests)

  web-external/
    tests/
      unit/
        preset-manager.test.js
        tips-manager.test.js
        simplified-results.test.js
      integration/
        local-file-flow.test.js
        gdrive-flow.test.js
```

### 5.2 Cross-Package Testing

**Test that shared components work in both contexts:**

```javascript
// packages/ui-common/tests/cross-package.test.js
import { describe, it, expect } from 'vitest';
import { ResultsTable } from '../src/components/ResultsTable.js';

describe('ResultsTable - Cross-package compatibility', () => {
  it('should work with internal app data format', () => {
    const table = new ResultsTable();
    const internalResults = {
      // Full featured results with all fields
    };
    expect(() => table.render(internalResults)).not.toThrow();
  });

  it('should work with external app data format', () => {
    const table = new ResultsTable();
    const externalResults = {
      // Simplified results
    };
    expect(() => table.render(externalResults)).not.toThrow();
  });
});
```

### 5.3 Test Commands

```bash
# Test all packages
npm run test:all

# Test specific package
npm run test --workspace=@audio-analyzer/ui-common
npm run test --workspace=@audio-analyzer/web
npm run test --workspace=@audio-analyzer/web-external

# Test coverage
npm run test:coverage --workspaces

# Run tests in CI
npm run test:ci --workspaces
```

---

## Phase 6: Migration Checklist

### 6.1 Pre-Migration

- [ ] Review current web package structure
- [ ] Identify all shared components
- [ ] Document all features to hide in external version
- [ ] Create feature comparison matrix
- [ ] Back up current deployment

### 6.2 Phase 1 - UI Common Package

- [ ] Create `packages/ui-common` directory
- [ ] Set up package.json
- [ ] Extract ResultsTable component
- [ ] Extract formatting utilities
- [ ] Write tests for ui-common
- [ ] Update web package to use ui-common
- [ ] Verify web package still works
- [ ] Run all tests
- [ ] Commit: "refactor: extract shared UI components to ui-common package"

### 6.3 Phase 2 - Web External Package

- [ ] Copy web package to web-external
- [ ] Update package.json name and dependencies
- [ ] Remove Box integration files
- [ ] Remove experimental features
- [ ] Remove custom preset functionality
- [ ] Simplify main.js entry point
- [ ] Create TipsManager
- [ ] Create SimplifiedResultsDisplay
- [ ] Update styles for external branding
- [ ] Test locally with `npm run dev:external`
- [ ] Commit: "feat: create web-external package for AudioTalent"

### 6.4 Phase 3 - Integration

- [ ] Update root package.json workspaces
- [ ] Update Firebase configuration
- [ ] Create GitHub Actions workflows
- [ ] Test builds for both packages
- [ ] Verify no cross-contamination
- [ ] Run full test suite
- [ ] Commit: "chore: configure deployment for dual-site architecture"

### 6.5 Phase 4 - Deployment

- [ ] Deploy to Firebase preview channels
- [ ] Test internal site preview
- [ ] Test external site preview
- [ ] Configure DNS for audiotalent.tinytech.site
- [ ] Deploy to production (external site first)
- [ ] Monitor for issues
- [ ] Update documentation
- [ ] Commit: "docs: update deployment documentation for dual-site"

---

## Phase 7: Feature Comparison Matrix

### Features by Site

| Feature | Internal (web) | External (web-external) |
|---------|---------------|------------------------|
| **File Sources** |
| Local file upload | ✅ | ✅ |
| Google Drive | ✅ | ✅ |
| Box integration | ✅ | ❌ |
| **Analysis** |
| Basic analysis | ✅ | ✅ |
| Experimental mode | ✅ | ❌ |
| Batch processing | ✅ | ✅ (limited) |
| **Presets** |
| Standard presets | ✅ | ✅ (4 only) |
| Custom presets | ✅ | ❌ |
| Preset import/export | ✅ | ❌ |
| **Results** |
| Technical details | ✅ | ❌ (simplified) |
| Advanced metrics | ✅ | ❌ |
| Export results | ✅ | ✅ (basic) |
| **UX** |
| Technical language | ✅ | ❌ (friendly) |
| Tips and guidance | ❌ | ✅ |
| Contextual help | ❌ | ✅ |
| **Settings** |
| Advanced settings | ✅ | ❌ |
| Debug mode | ✅ | ❌ |

---

## Phase 8: Deployment Strategy

### 8.1 Phased Rollout Timeline

**Week 1: Foundation**
- Day 1-2: Create ui-common package
- Day 3-4: Extract shared components
- Day 5: Test web package with ui-common

**Week 2: External Package**
- Day 1-2: Copy and clean up web-external
- Day 3: Implement simplified UI
- Day 4: Add tips and guidance
- Day 5: Local testing

**Week 3: Integration**
- Day 1: Configure Firebase and GitHub Actions
- Day 2: Deploy to preview channels
- Day 3-4: Testing and bug fixes
- Day 5: Production deployment prep

**Week 4: Launch**
- Day 1: Deploy external site to production
- Day 2-5: Monitor, gather feedback, iterate

### 8.2 Rollback Plan

**If web package breaks:**
```bash
# Revert ui-common extraction
git revert <commit-hash>
npm install
npm run build:internal
firebase deploy --only hosting:audio-analyzer
```

**If web-external has issues:**
```bash
# External site is separate, no impact on internal
# Just fix and redeploy
npm run build:external
firebase deploy --only hosting:audiotalent

# Or rollback via Firebase Console
firebase hosting:rollback --only hosting:audiotalent
```

**If ui-common breaks both:**
```bash
# Fix ui-common
cd packages/ui-common
# Make fixes
npm test

# Rebuild and redeploy both
cd ../..
npm run build:all
firebase deploy
```

---

## Phase 9: Maintenance & Evolution

### 9.1 Adding Features

**New feature for internal users only:**
```bash
# Work in packages/web only
cd packages/web
# Add feature
# Test
# Deploy (only internal site affected)
```

**New feature for external users only:**
```bash
# Work in packages/web-external only
cd packages/web-external
# Add feature
# Test
# Deploy (only external site affected)
```

**Shared component update:**
```bash
# Work in packages/ui-common
cd packages/ui-common
# Update component
# Test in both contexts
# Deploy both sites
```

### 9.2 Dependency Management

**Updating shared dependency:**
```bash
# Update in root or specific packages
npm update <package-name>

# Test all packages
npm run test:all

# Rebuild all
npm run build:all
```

**Package-specific dependency:**
```bash
# Only affects one package
cd packages/web-external
npm install <package-name>

# Only rebuild and test that package
npm run build
npm test
```

### 9.3 Monitoring

**Firebase Analytics:**
- Track usage per site
- Monitor bandwidth per site
- Check error rates

**Key Metrics:**
- Internal site: Power user feature usage
- External site: Conversion rates, tip engagement
- Both: File analysis success rates, performance

---

## Success Metrics

### Technical Success
- [ ] Both sites build successfully
- [ ] Bundle size for external < 60% of internal
- [ ] Test coverage > 80% for all packages
- [ ] Zero production errors in first week
- [ ] Page load time < 2s for both sites

### User Success
- [ ] External users complete analysis successfully > 90%
- [ ] Support tickets from external users decrease by 50%
- [ ] Internal users report no disruption
- [ ] External users engage with tips/guidance

### Operational Success
- [ ] Clear separation reduces confusion
- [ ] Independent deployment works smoothly
- [ ] Changes to internal don't affect external
- [ ] Maintenance overhead manageable

---

## Risk Assessment & Mitigation

### High Risk
**Risk:** Breaking internal site during ui-common extraction
**Mitigation:**
- Extract incrementally, one component at a time
- Full test suite run after each extraction
- Deploy to staging/preview first

### Medium Risk
**Risk:** ui-common changes breaking one or both sites
**Mitigation:**
- Comprehensive cross-package tests
- Version pinning in package.json
- Preview deployments before production

### Low Risk
**Risk:** External site not meeting user needs
**Mitigation:**
- User testing before launch
- Feedback mechanism built in
- Easy to iterate and improve

---

## Documentation Updates Required

1. **CLAUDE.md** - Add separate package architecture section
2. **README.md** - Update monorepo structure
3. **packages/web/README.md** - Internal site documentation
4. **packages/web-external/README.md** - External site documentation
5. **packages/ui-common/README.md** - Shared components guide
6. **docs/deployment.md** - Dual-site deployment guide
7. **docs/development.md** - Local development guide for both sites

---

## Estimated Effort

### Development Time
- UI Common extraction: 10-12 hours
- Web External creation: 15-18 hours
- Testing: 8-10 hours
- Configuration: 4-6 hours
- Documentation: 4-5 hours
- **Total: 41-51 hours** (~1-1.5 weeks full-time)

### Calendar Time
- With staging and careful rollout: 3-4 weeks
- With user feedback and iteration: 4-6 weeks

---

## Next Steps

1. **Decision Point:** Approve separate package approach
2. **Phase 1 Start:** Create ui-common package
3. **Incremental extraction:** Move shared components
4. **Testing:** Verify web package still works
5. **Phase 2 Start:** Create web-external package
6. **Integration:** Configure deployment
7. **Preview:** Test in Firebase preview channels
8. **Launch:** Deploy external site
9. **Monitor:** Watch for issues, gather feedback
10. **Iterate:** Improve based on real usage

---

## Questions to Resolve

1. **External presets:** Which 4 presets should be available?
2. **Branding:** Different color scheme or keep similar?
3. **Tips:** What specific guidance do external users need most?
4. **Analytics:** What metrics should we track differently?
5. **Support:** How do external users get help?
6. **URL:** Confirm audiotalent.tinytech.site is the domain
7. **OAuth:** Same Google OAuth app or separate?
8. **Testing:** Who are the beta testers for external site?

---

## Conclusion

The separate package approach provides:
- **Maximum safety** - No risk of breaking external when adding internal features
- **Optimal performance** - Smaller bundles tailored to each audience
- **Clear architecture** - Explicit separation matches your monorepo pattern
- **Future flexibility** - Can evolve independently based on different user needs

While it requires more upfront work than build modes, the long-term benefits of isolation and clarity make it the right choice for a tool serving two distinct user populations.
