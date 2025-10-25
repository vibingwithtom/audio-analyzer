/**
 * Environment Detection Utility
 *
 * Detects whether the app is running in:
 * - Development (localhost)
 * - Preview (Cloudflare Pages feature branch deployments)
 * - Beta (beta subdomain: beta.audio-analyzer.tinytech.site)
 * - Production (main site: audio-analyzer.tinytech.site)
 */

export class EnvironmentDetector {
  constructor() {
    this.hostname = window.location.hostname;
    this.pathname = window.location.pathname || '/';
    this.environment = this.detectEnvironment();
  }

  detectEnvironment() {
    // Development - localhost
    if (this.hostname === 'localhost' || this.hostname === '127.0.0.1') {
      return 'development';
    }

    // Preview - Cloudflare Pages feature branch deployments
    // Pattern: <commit-id>.audio-analyzer.pages.dev (but not audio-analyzer.pages.dev or staging.audio-analyzer.pages.dev)
    if (this.hostname.endsWith('.audio-analyzer.pages.dev')) {
      const subdomain = this.hostname.replace('.audio-analyzer.pages.dev', '');
      // If subdomain is not empty and not 'staging', it's a preview
      if (subdomain && subdomain !== 'staging') {
        return 'preview';
      }
    }

    // Beta - subdomain (beta.audio-analyzer.tinytech.site or staging.audio-analyzer.pages.dev)
    if (this.hostname.startsWith('beta.') || this.hostname === 'staging.audio-analyzer.pages.dev') {
      return 'beta';
    }

    // Legacy beta - /beta/ path (for backward compatibility)
    if (this.pathname && (this.pathname.startsWith('/beta/') || this.pathname === '/beta')) {
      return 'beta';
    }

    // Production - everything else
    return 'production';
  }

  getEnvironment() {
    return this.environment;
  }

  isDevelopment() {
    return this.environment === 'development';
  }

  isPreview() {
    return this.environment === 'preview';
  }

  isBeta() {
    return this.environment === 'beta';
  }

  isProduction() {
    return this.environment === 'production';
  }

  getEnvironmentConfig() {
    const configs = {
      development: {
        name: 'Development',
        message: 'Development Environment',
        productionUrl: 'https://audio-analyzer.tinytech.site',
        showBanner: true
      },
      preview: {
        name: 'Preview',
        message: 'Preview Environment - Feature Branch',
        productionUrl: 'https://audio-analyzer.tinytech.site',
        showBanner: true
      },
      beta: {
        name: 'Beta',
        message: 'Beta Environment',
        productionUrl: 'https://audio-analyzer.tinytech.site',
        showBanner: true
      },
      production: {
        name: 'Production',
        showBanner: false
      }
    };

    return configs[this.environment];
  }
}
