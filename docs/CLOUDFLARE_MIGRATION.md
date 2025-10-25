# Cloudflare Pages Migration Guide

This document guides the setup of Cloudflare Pages as the primary deployment platform, replacing GitHub Pages.

**Status**: ✅ COMPLETED - Cloudflare Pages is live and working

**Preview URL**: https://307f383b.audio-analyzer.pages.dev (feature branch)
**Production URL**: https://audio-analyzer.tinytech.site (when main branch deployed)
**Beta URL**: https://beta.audio-analyzer.tinytech.site (pending DNS setup)

---

## Overview

**Current Setup**:
- GitHub Pages (production + beta)
- Automatic deploys on push to main/staging
- Custom domain: audio-analyzer.tinytech.site

**New Setup**:
- Cloudflare Pages (production + beta)
- Git-based automatic deployments
- PR preview deployments
- Global CDN + Analytics
- Fallback to GitHub Pages if needed

---

## Phase 1: Cloudflare Pages Configuration

### Prerequisites
- GitHub account with access to audio-analyzer repository
- Cloudflare account (free tier is sufficient)
- Domain registered and accessible via Cloudflare DNS

### Step 1.1: Create Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain (tinytech.site)
3. Navigate to **Pages**
4. Click **Create a project**
5. Select **Connect to Git**
6. Authorize GitHub and select `vibingwithtom/audio-analyzer`
7. Configure build settings:
   - **Project name**: `audio-analyzer`
   - **Production branch**: `main`
   - **Framework preset**: None (manual config)
   - **Build command**: `npm run build --workspace=@audio-analyzer/web`
   - **Build output directory**: `packages/web/dist`
   - **Root directory**: `/`

8. Click **Save and Deploy**

**Expected Result**: Cloudflare will trigger first build from main branch

### Step 1.2: Configure Preview Deployments

1. In Cloudflare Pages project settings
2. Go to **Build & deployments** → **Deployments**
3. Enable **Preview deployments**:
   - Preview deployments for all branches
   - Preview deployment branches: All branches

**Expected Result**: Each PR will get unique preview URL like `pr-123.audio-analyzer.pages.dev`

### Step 1.3: Configure Staging Branch Deployment

1. In project settings → **Build & deployments** → **Branches**
2. Add branch build configuration:
   - **Branch**: `staging`
   - **Build command**: `npm run build --workspace=@audio-analyzer/web`
   - **Build output directory**: `packages/web/dist`

**Expected Result**: Push to staging branch → automatic deploy to `staging.audio-analyzer.pages.dev`

---

## Phase 2: Domain & DNS Configuration

### Step 2.1: Set Custom Domain for Production

1. In Cloudflare Pages project
2. Go to **Custom domains**
3. Click **Add custom domain**
4. Enter: `audio-analyzer.tinytech.site`
5. Choose routing:
   - ✅ Route to this project
6. Click **Continue**

**Expected Result**: Cloudflare provides CNAME/A record instructions

### Step 2.2: Set Custom Domain for Staging

Unfortunately, Cloudflare Pages only supports ONE custom domain per project. For staging/beta:

**Option A (Recommended)**: Use branch subdomain
- Create separate Cloudflare Pages project OR
- Use automatic subdomain: `staging.audio-analyzer.pages.dev`
- Then create CNAME: `beta.audio-analyzer.tinytech.site` → `staging.audio-analyzer.pages.dev`

**Option B**: Use Cloudflare Workers
- Create Worker that routes based on hostname
- More complex but more flexible

**Recommended**: Option A with CNAME approach

### Step 2.3: Update DNS Records

1. Go to Cloudflare DNS settings for tinytech.site
2. Add/update these records:

```
Type    Name                        Content                              Proxy
CNAME   audio-analyzer              audio-analyzer.pages.dev            Proxied
CNAME   beta.audio-analyzer         staging.audio-analyzer.pages.dev    Proxied
```

3. Wait for DNS propagation (typically 5-30 minutes)

**Verify DNS**:
```bash
# Should resolve to Cloudflare IP
nslookup audio-analyzer.tinytech.site
nslookup beta.audio-analyzer.tinytech.site
```

---

## Phase 3: Testing & Verification

### Test 3.1: Production Deployment

1. Make a small commit to main branch
2. Verify in Cloudflare Pages **Deployments** tab that build started
3. Test at:
   - ✅ `audio-analyzer.pages.dev` (default)
   - ✅ `audio-analyzer.tinytech.site` (custom domain)
4. Verify all features work:
   - File upload and analysis
   - Preset selection
   - Results display
   - Custom criteria

### Test 3.2: Staging/Beta Deployment

1. Push test commit to staging branch
2. Verify deployment in Cloudflare
3. Test at:
   - ✅ `staging.audio-analyzer.pages.dev` (auto-subdomain)
   - ✅ `beta.audio-analyzer.tinytech.site` (CNAME)
4. Verify same functionality as production

### Test 3.3: PR Preview Deployments

1. Create test PR from feature branch
2. Cloudflare automatically creates preview deployment
3. Preview URL appears as comment in PR
4. Test the preview environment
5. Merge/close PR
6. Verify preview is cleaned up

### Test 3.4: Performance & Analytics

1. In Cloudflare Pages project → **Analytics**
2. Verify data is being collected:
   - Page views
   - Requests
   - Status codes (should be mostly 200s)
3. Check **Web Vitals** (if enabled)
4. Verify CDN caching is working:
   - Reload page, check network tab for `cf-cache-status: HIT`

### Test 3.5: GitHub Pages Fallback

1. Visit `vibingwithtom.github.io/audio-analyzer` (GitHub Pages URL)
2. Verify it still works (in case Cloudflare DNS fails)

---

## Phase 4: Monitoring & Optimization

### Monitor for 1-2 weeks

1. Check Cloudflare Analytics daily
2. Monitor error rates (should be <1%)
3. Check build times (typically 2-5 minutes)
4. Verify no deployment failures

### Enable Cloudflare Features

After confirming stability:

1. **Web Analytics** (free):
   - Dashboard → Analytics & Logs → Web Analytics
   - Enable for the domain

2. **Caching Rules** (optional):
   - Set cache TTL to 1 hour for static assets
   - Bypass cache for `/api/*` (if using edge functions later)

3. **Security Rules** (optional):
   - Configure rate limiting if needed
   - Bot management settings

---

## Phase 5: Optional - Edge Functions Setup

Once everything is stable, you can add Edge Functions for:
- Server-side rendering
- API routes
- Authentication
- Redirects and rewrites

Example: Redirect `/beta/` requests to staging environment

---

## Rollback Plan

If issues occur:

1. **DNS Rollback**: Point DNS back to GitHub Pages
   ```
   CNAME   audio-analyzer   vibingwithtom.github.io
   CNAME   beta             vibingwithtom.github.io
   ```

2. **Cloudflare Disable**: Keep project as-is, just stop using it

3. **GitHub Actions Resume**: Existing workflows remain functional

**Estimated Rollback Time**: <5 minutes via DNS change

---

## Troubleshooting

### Build Failing

Check Cloudflare build logs:
1. Pages → Deployments
2. Click failed deployment
3. View build logs
4. Common issues:
   - Missing `npm install` (should auto-run)
   - Wrong build command
   - Missing environment variables

### 404 Errors

1. Verify custom domain configuration
2. Check DNS propagation: `nslookup`
3. Verify build output directory is correct
4. Check that `index.html` exists in dist/

### Slow Performance

1. Check Cloudflare caching:
   - Should see `cf-cache-status: HIT` headers
2. Check if Analytics is slowing down page load
3. Monitor from Cloudflare → Performance

### Preview Deployments Not Working

1. Verify branch preview deployments are enabled
2. Check if branch is excluded from previews
3. Confirm PR is from same repository (not fork)

---

## Files Modified

- `wrangler.toml` - Cloudflare configuration (created)
- `.gitignore` - Added Cloudflare artifacts
- `.github/workflows/deploy.yml` - Remains unchanged (fallback)
- `.github/workflows/deploy-beta.yml` - Remains unchanged (fallback)

---

## Environment Variables

Currently none needed, but if adding Edge Functions:

```
# Add in Cloudflare Pages Settings → Environment variables
VITE_API_URL=https://api.example.com
VITE_ENV=production
```

---

## Next Steps

After completing this migration:

1. ✅ Remove GitHub Pages workflows (after 2-week stability period)
2. ✅ Add Edge Functions for API routes if needed (Phase 2 of Auditions)
3. ✅ Enable Web Analytics reporting
4. ✅ Configure advanced caching rules

---

**Status**: Last updated Oct 25, 2025
**Ready for**: Phase 1 setup in Cloudflare UI
