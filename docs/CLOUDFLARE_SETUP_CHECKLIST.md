# Cloudflare Pages Setup Checklist

Quick reference for setting up Cloudflare Pages. Detailed instructions in `CLOUDFLARE_MIGRATION.md`.

## Pre-Setup Requirements
- [ ] Cloudflare account created
- [ ] GitHub personal access token ready (for API if needed)
- [ ] Access to tinytech.site domain settings

---

## Phase 1: Create Cloudflare Pages Project

**Location**: Cloudflare Dashboard → Select domain → Pages

- [ ] Click "Create project"
- [ ] Select "Connect to Git"
- [ ] Authorize GitHub app
- [ ] Select repository: `vibingwithtom/audio-analyzer`
- [ ] Configure build:
  - Project name: `audio-analyzer`
  - Production branch: `main`
  - Build command: `npm run build --workspace=@audio-analyzer/web`
  - Build output: `packages/web/dist`
  - Root directory: (leave empty)
- [ ] Click "Save and Deploy"
- [ ] Wait for first build to complete

---

## Phase 2: Enable Preview Deployments

**Location**: Pages project → Settings → Build & deployments

- [ ] Go to "Deployments" tab
- [ ] Enable "Preview deployments"
- [ ] Set to: "All branches" or "All branches and pull requests"
- [ ] Save

**Result**: PR preview URLs like `pr-123.audio-analyzer.pages.dev`

---

## Phase 3: Configure Staging Branch

**Location**: Pages project → Settings → Build & deployments

- [ ] Go to "Branches" tab
- [ ] Click "Add branch"
- [ ] Branch: `staging`
- [ ] Build command: `npm run build --workspace=@audio-analyzer/web`
- [ ] Build output: `packages/web/dist`
- [ ] Save

**Result**: `staging` branch deploys to `staging.audio-analyzer.pages.dev`

---

## Phase 4: Configure Custom Domains

### Production Domain

**Location**: Pages project → Custom domains

- [ ] Click "Add custom domain"
- [ ] Enter: `audio-analyzer.tinytech.site`
- [ ] Select: "Route to this project"
- [ ] Note the CNAME target (e.g., `audio-analyzer.pages.dev`)
- [ ] Save

### Staging/Beta Domain (via DNS CNAME)

Create CNAME in your DNS provider (will do after DNS setup)

---

## Phase 5: Configure DNS Records

**Location**: Cloudflare Dashboard → DNS settings for tinytech.site

**Add/Update these CNAME records:**

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | audio-analyzer | audio-analyzer.pages.dev | Proxied |
| CNAME | beta.audio-analyzer | staging.audio-analyzer.pages.dev | Proxied |

- [ ] Verify CNAME records are created
- [ ] Check that both resolve correctly

**Verify DNS (in terminal):**
```bash
nslookup audio-analyzer.tinytech.site
nslookup beta.audio-analyzer.tinytech.site
```

---

## Phase 6: Test Deployments

### Test Production

- [ ] Create small commit to `main`
- [ ] Verify build in Cloudflare Pages → Deployments
- [ ] Test: `audio-analyzer.tinytech.site`
- [ ] Test: `audio-analyzer.pages.dev`
- [ ] All features work (upload, analysis, presets)

### Test Staging/Beta

- [ ] Push test commit to `staging`
- [ ] Verify build in Cloudflare
- [ ] Test: `beta.audio-analyzer.tinytech.site`
- [ ] All features work

### Test PR Previews

- [ ] Create test PR
- [ ] Cloudflare creates preview (check PR comments)
- [ ] Test preview deployment
- [ ] Merge PR and verify cleanup

### Test Fallback

- [ ] GitHub Pages still works (fallback)
- [ ] `vibingwithtom.github.io/audio-analyzer` loads

---

## Phase 7: Enable Analytics

**Location**: Pages project → Analytics

- [ ] Click "Enable Analytics" (if not enabled)
- [ ] View real-time data

**Optional in main domain settings:**
- [ ] Enable "Web Analytics"
- [ ] Enable "Core Web Vitals"

---

## Phase 8: Monitor (1-2 weeks)

- [ ] Check build status daily
- [ ] Monitor error rates (target: <1%)
- [ ] Check analytics data
- [ ] Test deployments several times

---

## Phase 9: Optional - Remove GitHub Pages (after 2 weeks)

**Only after confirming stability:**

- [ ] Disable `.github/workflows/deploy.yml`
- [ ] Disable `.github/workflows/deploy-beta.yml`
- [ ] Keep as reference in git history
- [ ] Remove GitHub Pages settings (if desired)

---

## Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Build failing | Check Cloudflare build logs → check npm/build command |
| 404 on custom domain | Verify DNS CNAME is set and propagated |
| Preview deployments not showing | Enable in Deployments settings, check branch |
| Slow page loads | Check cf-cache-status header (should be HIT) |
| Changes not deploying | Push to correct branch, check branch settings |

---

## Important URLs

During Setup:
- Cloudflare Dashboard: https://dash.cloudflare.com
- This project's settings: https://dash.cloudflare.com/?account=<account>/pages/<project>

After DNS Propagation:
- **Production**: https://audio-analyzer.tinytech.site
- **Beta/Staging**: https://beta.audio-analyzer.tinytech.site
- **PR Previews**: https://pr-XXX.audio-analyzer.pages.dev (auto-generated)

GitHub Fallback (during migration):
- **GitHub Pages**: https://vibingwithtom.github.io/audio-analyzer

---

## Notes

- First deployment may take 5-10 minutes
- DNS changes may take 5-30 minutes to propagate
- Cloudflare free tier supports 500 builds/month (plenty for active development)
- No cost for Pages, CDN, or analytics on free tier

---

**Status**: Ready for execution
**Last updated**: Oct 25, 2025
