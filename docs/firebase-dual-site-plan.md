# Firebase Hosting Dual-Site Architecture Plan

## Overview

**Goal:** Deploy two separate sites from one codebase:
- **audio-analyzer.tinytech.site** - Internal power user tool (current)
- **audiotalent.tinytech.site** - External simplified validation tool (new)

**Strategy:** Single monorepo, two build modes, two Firebase hosting sites

---

## Phase 1: Architecture & Code Structure

### 1.1 Build Configuration

**packages/web/vite.config.js:**
```javascript
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isExternal = mode === 'external';

  return {
    base: '/',
    build: {
      outDir: isExternal ? 'dist-external' : 'dist',
      emptyOutDir: true,
    },
    define: {
      __IS_EXTERNAL__: JSON.stringify(isExternal),
      __APP_MODE__: JSON.stringify(isExternal ? 'external' : 'internal'),
      __APP_TITLE__: JSON.stringify(isExternal ? 'AudioTalent' : 'Audio Analyzer'),
    },
    // Other existing config...
  };
});
```

**packages/web/package.json updates:**
```json
{
  "scripts": {
    "dev": "vite",
    "dev:external": "vite --mode external",
    "build": "vite build",
    "build:external": "vite build --mode external",
    "deploy": "npm run build && gh-pages -d dist",
    "deploy:beta": "npm run build && gh-pages -d dist -e beta",
    "deploy:firebase": "firebase deploy --only hosting:audio-analyzer",
    "deploy:firebase:external": "firebase deploy --only hosting:audiotalent"
  }
}
```

### 1.2 Code Structure

**Create mode detection utility:**
```javascript
// packages/web/src/utils/app-mode.js
export const APP_MODE = __APP_MODE__;
export const IS_EXTERNAL = __IS_EXTERNAL__;
export const APP_TITLE = __APP_TITLE__;

export function isExternalMode() {
  return IS_EXTERNAL;
}

export function getAppConfig() {
  return {
    mode: APP_MODE,
    title: APP_TITLE,
    showAdvancedFeatures: !IS_EXTERNAL,
    showTips: IS_EXTERNAL,
    presetOptions: IS_EXTERNAL
      ? ['auditions', 'character-recordings', 'three-hour'] // Limited presets
      : ['all presets'], // All presets
  };
}
```

**Main app entry point:**
```javascript
// packages/web/src/main.js
import { isExternalMode } from './utils/app-mode.js';

if (isExternalMode()) {
  document.title = 'AudioTalent - Audio File Validator';
  initExternalApp();
} else {
  document.title = 'Audio Analyzer';
  initInternalApp();
}

function initExternalApp() {
  // Simplified UI
  // Hide: Box integration, advanced analysis, experimental mode
  // Show: Tips, simpler language, guided workflow
}

function initInternalApp() {
  // Full featured UI (current app)
}
```

### 1.3 Feature Differentiation

**External (AudioTalent) - Simplified:**
- ✅ Local file upload only
- ✅ Google Drive integration (simple)
- ❌ Box integration (hide)
- ❌ Experimental analysis mode (hide)
- ❌ Custom presets (limit to 3-4 common ones)
- ✅ Clear tips and guidance
- ✅ Friendly error messages
- ✅ Simplified result display

**Internal (Audio Analyzer) - Full Power:**
- ✅ Everything (current functionality)
- ✅ All integrations
- ✅ All analysis modes
- ✅ All presets including custom
- ✅ Technical details
- ✅ Advanced features

---

## Phase 2: Firebase Setup

### 2.1 Create Firebase Project

**Steps:**
1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Name: `audio-analyzer` (or reuse existing if you have one)
4. Disable Google Analytics (not needed)
5. Create project

### 2.2 Configure Hosting Sites

**In Firebase Console:**
1. Go to Hosting section
2. Click "Add another site"
3. Create two sites:
   - Site 1: `audio-analyzer` → audio-analyzer.tinytech.site
   - Site 2: `audiotalent` → audiotalent.tinytech.site

### 2.3 Local Firebase Configuration

**Install Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
```

**Initialize Firebase in repo root:**
```bash
cd /Users/raia/XCodeProjects/audio-analyzer
firebase init hosting
```

Select:
- Existing project: audio-analyzer
- Public directory: `packages/web/dist` (we'll configure multiple later)
- Single-page app: Yes
- Set up automatic builds: No (we'll do manual GitHub Actions)

**Root firebase.json:**
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
          "source": "**/*.@(js|css)",
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
      "public": "packages/web/dist-external",
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
          "source": "**/*.@(js|css)",
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

**Root .firebaserc:**
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

## Phase 3: Deployment Configuration

### 3.1 GitHub Actions Workflow

**Transition Plan:**
- Keep GitHub Pages for audio-analyzer initially (no disruption)
- Add Firebase deployment for audiotalent first
- Later, migrate audio-analyzer to Firebase if desired

**.github/workflows/deploy-firebase.yml:**
```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy-internal:
    name: Deploy Internal Site (audio-analyzer)
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

      - name: Build internal site
        run: cd packages/web && npm run build

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          target: internal

  deploy-external:
    name: Deploy External Site (audiotalent)
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

      - name: Build external site
        run: cd packages/web && npm run build:external

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          target: external
```

### 3.2 Firebase Service Account Setup

**Steps:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download JSON file
4. Go to GitHub repo → Settings → Secrets → Actions
5. Create new secret: `FIREBASE_SERVICE_ACCOUNT`
6. Paste entire JSON contents

---

## Phase 4: DNS Configuration

### 4.1 Spaceship DNS Setup

**For audio-analyzer.tinytech.site (initially keep GitHub Pages):**
- Keep existing CNAME pointing to GitHub Pages

**For audiotalent.tinytech.site (new Firebase site):**

In Spaceship.com DNS management:
1. Add new record:
   - Type: `A`
   - Name: `audiotalent`
   - Value: `151.101.1.195` (Firebase IP)

2. Add another A record:
   - Type: `A`
   - Name: `audiotalent`
   - Value: `151.101.65.195` (Firebase IP #2)

**Alternative (if Firebase provides CNAME):**
- Type: `CNAME`
- Name: `audiotalent`
- Value: `audiotalent.web.app`

### 4.2 Firebase Custom Domain Setup

1. Go to Firebase Console → Hosting
2. Select `audiotalent` site
3. Click "Add custom domain"
4. Enter: `audiotalent.tinytech.site`
5. Follow verification steps
6. Firebase will provision SSL certificate (automatic)

---

## Phase 5: Google OAuth Configuration

### 5.1 Update OAuth Settings

**Google Cloud Console:**
1. Go to APIs & Services → Credentials
2. Edit OAuth 2.0 Client ID
3. Add to Authorized JavaScript origins:
   - `https://audiotalent.tinytech.site`
4. Add to Authorized redirect URIs:
   - `https://audiotalent.tinytech.site` (or specific callback if needed)

### 5.2 Code Updates

**packages/web/src/services/google-auth.js:**
```javascript
// Already using same client ID, so no changes needed
// Both sites will use same Google OAuth app
```

---

## Phase 6: Testing Strategy

### 6.1 Local Testing

**Test internal mode:**
```bash
cd packages/web
npm run dev
# Test at http://localhost:3000
```

**Test external mode:**
```bash
cd packages/web
npm run dev:external
# Test at http://localhost:3000
```

### 6.2 Staging Testing

**Deploy to Firebase preview channels first:**
```bash
# Internal preview
npm run build
firebase hosting:channel:deploy preview-internal --only hosting:audio-analyzer

# External preview
npm run build:external
firebase hosting:channel:deploy preview-external --only hosting:audiotalent
```

Firebase provides temporary URLs for testing.

### 6.3 Production Testing Checklist

**For audiotalent.tinytech.site:**
- [ ] Site loads correctly
- [ ] Google Drive OAuth works
- [ ] Local file upload works
- [ ] Preset selection (limited list) works
- [ ] Analysis completes successfully
- [ ] Results display correctly (simplified view)
- [ ] Tips and guidance show properly
- [ ] Box integration is hidden
- [ ] Experimental mode is hidden
- [ ] Custom presets are hidden

**For audio-analyzer.tinytech.site:**
- [ ] All current functionality works
- [ ] No changes to user experience
- [ ] All integrations work (Google Drive, Box)
- [ ] All analysis modes available
- [ ] All presets available

---

## Phase 7: Migration Plan

### 7.1 Phased Rollout

**Week 1: Setup & Testing**
- Set up Firebase project
- Configure local development
- Create external mode build
- Test locally

**Week 2: External Site Launch**
- Deploy audiotalent.tinytech.site
- Configure DNS
- Test with sample users
- Monitor for issues

**Week 3: Stabilization**
- Fix any issues discovered
- Gather feedback
- Refine simplified UI

**Optional - Week 4+: Migrate Internal Site**
- If Firebase works well, consider migrating audio-analyzer.tinytech.site
- Would eliminate need for GitHub Pages deployment
- Simplifies workflow to single deployment target

### 7.2 Rollback Plan

**If audiotalent has issues:**
1. Firebase allows instant rollback to previous deployment
2. Command: `firebase hosting:rollback`
3. Or via Firebase Console → Hosting → View history → Rollback

**If need to pause external site:**
1. Remove DNS records temporarily
2. Keep internal site unaffected

---

## Phase 8: Ongoing Maintenance

### 8.1 Deployment Workflow

**With staging branch strategy:**
```bash
# 1. Features merge to staging
git checkout staging
git merge feature/new-feature

# 2. Build and test both modes
npm run build && npm run build:external

# 3. Deploy to Firebase preview
firebase hosting:channel:deploy staging --only hosting

# 4. Test both sites in preview URLs

# 5. Merge to main (triggers production deploy via GitHub Actions)
gh pr create --base main --head staging
```

### 8.2 Monitoring

**Firebase provides:**
- Bandwidth usage (ensure stays under 10GB/month)
- Request counts
- Performance metrics
- Error tracking (integrate with Firebase Crashlytics if needed)

### 8.3 Cost Management

**Firebase Free Tier (Spark Plan):**
- 10 GB storage
- 360 MB/day bandwidth (~10 GB/month)
- 1 GB downloads/day

**If approaching limits:**
- Optimize asset sizes
- Enable better compression
- Consider Cloudflare CDN in front (free)

---

## Phase 9: Documentation Updates

### 9.1 Update CLAUDE.md

Add section:
```markdown
## Dual-Site Architecture

We maintain two separate sites from one codebase:

**audio-analyzer.tinytech.site** - Internal power user tool
- Full features, all integrations
- Deploy: `npm run build && firebase deploy --only hosting:audio-analyzer`

**audiotalent.tinytech.site** - External simplified tool
- Limited features for external users
- Deploy: `npm run build:external && firebase deploy --only hosting:audiotalent`

### Local Development
- Internal mode: `npm run dev`
- External mode: `npm run dev:external`

### Testing Changes
Always test BOTH modes before deploying:
1. Run `npm run dev` and test internal features
2. Run `npm run dev:external` and test external experience
3. Ensure feature flags work correctly
```

### 9.2 Create Deployment Runbook

Document in `packages/web/DEPLOYMENT.md`:
- Firebase deployment commands
- Rollback procedures
- Troubleshooting common issues
- DNS configuration details

---

## Success Metrics

**Technical:**
- [ ] Both sites deploy successfully
- [ ] Zero downtime for internal users during rollout
- [ ] Both sites stay under Firebase free tier limits
- [ ] Page load times < 2 seconds for both sites

**User Experience:**
- [ ] External users find simplified interface intuitive
- [ ] No confusion between sites (complete separation)
- [ ] Internal power users see no changes
- [ ] Support inquiries decrease for external users (better UX)

---

## Next Steps

1. **Review this plan** - Any concerns or modifications needed?
2. **Phase 1 implementation** - Start with build configuration
3. **Firebase project setup** - Create project and configure sites
4. **Simple UI design** - Define what external users see
5. **Testing** - Thorough testing of both modes
6. **Gradual rollout** - Start with preview channels

---

## Questions to Answer

1. What specific presets should external users see?
2. What tips/guidance should be shown to external users?
3. Should external users have access to experimental analysis?
4. What error messages need to be simplified?
5. Should results display be significantly different?
6. Do we want different branding/colors for AudioTalent?

---

## Risk Assessment

**Low Risk:**
- Firebase free tier sufficient for traffic
- Can rollback easily
- Internal site unaffected during rollout

**Medium Risk:**
- DNS propagation delay (24-48 hours)
- SSL certificate provisioning time
- External users discovering internal site URL

**Mitigation:**
- Test thoroughly in Firebase preview channels
- Plan DNS changes during low-traffic period
- Consider password-protecting internal site if needed
- Monitor Firebase usage closely after launch

---

## Timeline Estimate

- **Phase 1 (Build Config):** 2-3 hours
- **Phase 2 (Firebase Setup):** 1-2 hours
- **Phase 3 (GitHub Actions):** 1 hour
- **Phase 4 (DNS):** 1 hour + 24-48h propagation
- **Phase 5 (OAuth):** 30 minutes
- **Phase 6 (Testing):** 3-4 hours
- **Phase 7 (Rollout):** 1-2 weeks monitoring

**Total active development:** ~10-15 hours
**Total calendar time:** 2-3 weeks with testing and monitoring
