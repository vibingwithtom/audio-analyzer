# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
# 🚨 STOP! READ THIS FIRST 🚨
**Before writing ANY code, ALWAYS:**
1. ✅ Check current branch: `git branch --show-current`
2. ✅ If on `main`, STOP and create feature branch: `git checkout -b feature/descriptive-name`
3. ✅ Only then proceed with coding

**NO EXCEPTIONS. This prevents production breakage.**
---

## ⚠️ CRITICAL: Development Workflow Rules

**THESE RULES MUST BE FOLLOWED TO PREVENT PRODUCTION ISSUES:**

### Feature Branch Development (REQUIRED)
- **NEVER push directly to main** for features or significant changes
- **ALWAYS create a feature branch** for any new work
- Feature branches automatically run CI tests on every push
- CI must pass before merging to main
- Check CI status: https://github.com/vibingwithtom/audio-analyzer/actions

### Testing Requirements
- All feature branches run CI automatically (tests, TypeScript checks, linting)
- **768 tests must pass** before any code reaches production
- If tests fail on your feature branch, fix them before creating a PR

### When to Update Test Mocks
- **Critical**: When adding new methods to classes imported by tests (e.g., LevelAnalyzer)
- Check `packages/web/tests/unit/` for relevant test files
- Update mocks in `beforeEach` blocks to include new methods

### Standard Workflow (Use This Every Time)
```bash
# 1. Create feature branch
git checkout -b feature/descriptive-name

# 2. Develop and test locally
npm run dev                  # Test in browser
npm test                     # Run tests locally

# 3. Commit and push (triggers CI automatically)
git add .
git commit -m "feat: description"
git push origin feature/descriptive-name

# 4. Deploy to beta for manual testing (optional but recommended)
cd packages/web
npm run deploy:beta
# Test at: https://audio-analyzer.tinytech.site/beta/

# 5. Create Pull Request (REQUIRED for main branch)
gh pr create --base main --head feature/descriptive-name

# 6. Merge PR after CI passes
# Production auto-deploys after merge to main
```

### Why These Rules Exist
In October 2024, a feature branch was merged to main without running tests. The production deployment failed because:
1. Test mocks were incomplete (missing `analyzeConversationalAudio` method)
2. File formatting had issues (methods outside class scope)
3. No CI ran on the feature branch to catch these issues early

These rules prevent this from happening again.

---

## Project Overview

Audio Analyzer is a monorepo with:
- **Web app** (packages/web) - PWA deployed to GitHub Pages
- **Chrome extension** (packages/extension) - Google Drive integration
- **Desktop app** (packages/desktop) - Electron-based standalone app
- **Core library** (packages/core) - Shared audio analysis engine
- **Cloud functions** - Bilingual validation and Box proxy

## Common Commands

### Development
```bash
npm install              # Install dependencies (from root)
cd packages/web
npm run dev              # Runs Vite dev server on http://localhost:3000
npm run build            # Build all workspaces
npm run lint             # Lint all workspaces
```

### Web Deployment

**Production (Automatic):**
- Deploys automatically when code is pushed to `main` branch
- GitHub Actions runs tests first, blocks deployment if tests fail
- URL: https://audio-analyzer.tinytech.site

**Beta (Manual):**
```bash
cd packages/web
npm run deploy:beta      # Deploys to https://audio-analyzer.tinytech.site/beta/
```

**Note:** See `packages/web/DEPLOYMENT.md` for detailed deployment guide.

## Architecture

### Monorepo Structure
npm workspaces monorepo. All packages in `packages/` share dependencies through root `package.json`.

### Core Library (`packages/core`)
Key modules:
- **AudioAnalyzer** - Extracts file properties (sample rate, bit depth, channels, duration). Parses WAV headers directly.
- **LevelAnalyzer** - Advanced analysis: peak levels, noise floor, reverb (RT60), silence detection, stereo separation, mic bleed
- **CriteriaValidator** - Validates audio properties against criteria
- **BatchProcessor** - Batch processing with progress tracking
- **GoogleDriveHandler** - Google Drive URL parsing and file downloads

### Web Application (`packages/web`)
Vanilla JS SPA built with Vite. Key files:
- **main.js** - Main app logic, tab switching, file handling, batch processing
- **google-auth.js** - Google OAuth using Identity Services
- **box-auth.js** - Box OAuth integration
- **vite.config.js** - Sets base path: '/beta/' for beta mode, '/' for production

### Analysis Features
- **Audio Analysis Flow**: File → ArrayBuffer → Parse/Decode → Extract properties → Validate against criteria
- **Presets**: Auditions, Character Recordings, P2B2 Pairs, Three Hour, Bilingual Conversational, Custom
- **Filename Validation**:
  - Three Hour: `[scriptName]_[speakerID].wav`
  - Bilingual: `[ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]`
- **Batch Processing**: Google Drive folders, Box folders, local multi-file selection

## Git/GitHub Workflow

### Branch Strategy
- **main** - Production-ready code, always stable
- **feature/** - Feature branches (e.g., `feature/mic-bleed-detection`)
- Create feature branches from main, keep focused on single feature

### Commit Guidelines
Use conventional commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code restructuring
- `docs:` - Documentation updates
- `chore:` - Maintenance tasks

### Pull Request Best Practices
- Create PR from feature branch to main
- Include description of changes and testing performed
- Ensure beta deployment is tested before merging
- Delete feature branch after successful merge

## Important Notes

- **ALWAYS** deploy web app to beta before merging to main
- Production deployment is automatic via GitHub Actions when you push to main
- Tests must pass before production deployment (enforced by CI/CD)
- Core library changes affect all platforms (web, extension, desktop)
- Import paths use `@audio-analyzer/core` alias that resolves to `packages/core`
