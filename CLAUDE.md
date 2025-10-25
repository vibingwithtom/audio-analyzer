# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
# 🚨 STOP! READ THIS FIRST 🚨
**Before writing ANY code, ALWAYS:**
1. ✅ Check current branch: `git branch --show-current`
2. ✅ If on `main` or `staging`, STOP and create feature branch: `git checkout -b feature/descriptive-name`
3. ✅ Only then proceed with coding

**NO EXCEPTIONS. Features go to staging first, then main as a batch.**
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
- **1126+ tests must pass in CI** before any code reaches production
- If tests fail on your feature branch, fix them before creating a PR

### Component Tests (Local Development Only)
**135 component tests are excluded from CI but available for local testing:**

```bash
# Run all component tests locally (pass 100% locally, fail in CI)
npm test tests/components/LocalFileTab.test.ts
npm test tests/components/ResultsDisplay.test.ts
npm test tests/components/ResultsTable.test.ts
npm test tests/components/SettingsTab.test.ts
```

**Why excluded from CI:**
- Tests fail in CI due to incompatibility between Svelte 5's `componentApi: 4` compatibility mode and DOM emulation libraries (jsdom/happy-dom)
- `createElement` returns plain Objects instead of DOM elements in CI environment
- Tests work perfectly locally - use them during development!

**See:** `packages/web/CI_TESTING_ISSUE.md` for full technical investigation

**Will re-enable when:**
- `componentApi: 4` is no longer needed (full Svelte 5 migration)
- Vitest 4.x stable is released (for `vitest-browser-svelte`)
- Time allows for comprehensive solution

### When to Update Test Mocks
- **Critical**: When adding new methods to classes imported by tests (e.g., LevelAnalyzer)
- Check `packages/web/tests/unit/` for relevant test files
- Update mocks in `beforeEach` blocks to include new methods

### Standard Workflow - Staging Branch (Use This Every Time)

**We use a staging branch to batch changes together before production deployment.**

```bash
# 1. Create feature branch
git checkout main && git pull origin main
git checkout -b feature/descriptive-name

# 2. Develop and test locally
npm run dev                  # Test in browser (Google Drive now works on localhost!)
npm test                     # Run tests locally

# 3. Commit and push feature branch
git add .
git commit -m "feat: description"
git push origin feature/descriptive-name

# 4. Merge to staging (NOT main) for integration testing
git checkout staging
git pull origin staging      # Get latest staging
git merge feature/descriptive-name
git push origin staging

# 5. Deploy staging to beta for testing ALL changes together
cd packages/web
npm run deploy:beta
# Test at: https://audio-analyzer.tinytech.site/beta/
# Verify your feature works WITH other staged features

# 6. Once all features are ready, create ONE PR from staging to main
gh pr create --base main --head staging --title "Release: [describe batch of features]"

# 7. WAIT for Claude Code Review and CI to complete
# ⚠️ CRITICAL: Always wait for the Claude bot review to finish
# - Check PR status: gh pr view <PR_NUMBER>
# - Look for "Claude Code Review" check to show SUCCESS
# - CI must pass (all 768+ tests)

# 8. Merge staging → main (triggers ONE production deployment)
# Production auto-deploys after merge to main

# 9. After successful deployment, recreate staging from main
git checkout main && git pull origin main
git branch -D staging        # Delete old staging
git checkout -b staging      # Fresh staging for next batch
git push origin staging --force
```

#### Why Staging?
- **Batch deployments**: Multiple features go to production together
- **Integration testing**: Catch conflicts between features in beta BEFORE production
- **Single deploy event**: Less disruption for users
- **Easy rollback**: One PR to revert if issues arise

#### Working with Long-Running Features
If you need to pause work on a large feature:
- Keep it on its feature branch (don't merge to staging)
- Work on urgent fixes separately
- Only merge to staging when ready to deploy

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

### Cloudflare Pages Debugging

**Environment variables required:**
```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```
These are already in `.zshrc` but may need to be added to other shells.

**Monitor Cloudflare Pages builds:**
```bash
# List recent deployments with status
python3 .claude/mcp/cloudflare_fetch_logs.py audio-analyzer

# Get detailed logs for a specific deployment
python3 .claude/mcp/cloudflare_fetch_logs.py audio-analyzer <deployment-id> detailed

# Get concise summary (errors and last logs)
python3 .claude/mcp/cloudflare_fetch_logs.py audio-analyzer <deployment-id> concise
```

**Use this to debug build failures** - the tool fetches logs directly from Cloudflare API for the audio-analyzer Pages project.

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

## Cloudflare API Tools

**Note:** Cloudflare offers official MCP servers (Workers, Observability, Radar, etc.) but does not provide one for Pages deployments, so we have a custom solution.

### Pages Deployment Tools

The following tools are available in `.claude/mcp/`:
- `cloudflare_mcp.py` - Full MCP server (requires MCP SDK, pending setup)
- `cloudflare_fetch_logs.py` - CLI tool for debugging Pages builds (recommended, no dependencies)

Both tools support:
- Listing recent deployments
- Fetching deployment logs and status
- Retrieving project information
- Retrying failed builds

**Use the CLI tool** (see "Cloudflare Pages Debugging" section below) as it requires no additional setup.

---

## Svelte MCP Integration

**The Svelte MCP server is available to help with Svelte development.**

### When Working with `.svelte` Files

Follow this workflow for optimal results:

1. **Discover documentation** - Use `mcp__svelte__list-sections` to find relevant docs
2. **Fetch targeted docs** - Use `mcp__svelte__get-documentation` for specific sections (more token-efficient than loading full docs)
3. **Write/modify Svelte code** - Implement the feature or fix
4. **Validate with autofixer** - Use `mcp__svelte__svelte-autofixer` on generated code
5. **Iterate** - Repeat autofixer until no issues remain

### MCP Tools Available

- **mcp__svelte__list-sections** - Discover all available documentation sections
- **mcp__svelte__get-documentation** - Retrieve specific documentation (saves tokens!)
- **mcp__svelte__svelte-autofixer** - Static analysis with fixes and best practice suggestions
- **mcp__svelte__playground-link** - Generate Svelte Playground URLs (only after user confirmation, never for project files)


### Best Practices

- Start with `list-sections` to understand what documentation is available
- Fetch only the documentation sections you need
- Always run `svelte-autofixer` on new/modified Svelte components
- Don't proceed until autofixer reports no issues
- Use playground links sparingly and only for demonstration purposes

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
- Always create a shortened URL when creating a Svelte playground.