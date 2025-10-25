# Cloudflare DNS Setup for Pages

## Current Status

✅ **Production Domain**: audio-analyzer.tinytech.site
- DNS CNAME: Already configured → `audio-analyzer.pages.dev`
- Status: Active

⏳ **Beta Domain**: beta.audio-analyzer.tinytech.site
- DNS CNAME: Needs to be created
- Target: `audio-analyzer.pages.dev`

## Manual DNS Setup Required

The Cloudflare API token has Pages permissions but not DNS permissions. You need to manually create the beta DNS record:

### Steps:

1. **Go to Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com
   - Select the `tinytech.site` zone

2. **Add DNS Record**
   - Click "DNS" in the left sidebar
   - Click "Add record"

3. **Configure CNAME Record**
   ```
   Type:    CNAME
   Name:    beta.audio-analyzer
   Target:  audio-analyzer.pages.dev
   Proxy:   ON (orange cloud)
   TTL:     Auto
   ```

4. **Save**
   - Click "Save"
   - Wait 1-2 minutes for propagation

## Verification

After creating the DNS record, verify it works:

```bash
# Check DNS resolution
dig beta.audio-analyzer.tinytech.site

# Test HTTPS
curl -I https://beta.audio-analyzer.tinytech.site
```

## Branch Mapping

- **main** branch → https://audio-analyzer.tinytech.site (production)
- **staging** branch → https://beta.audio-analyzer.tinytech.site
- **feature/** branches → https://<commit-id>.audio-analyzer.pages.dev (preview URLs)

## GitHub Pages Transition

Once Cloudflare Pages is proven stable:

1. Keep GitHub Actions CI/CD for testing
2. Remove GitHub Pages deployment step
3. Let Cloudflare Pages handle all deployments automatically
