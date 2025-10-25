/**
 * Environment Detection Utility
 *
 * Detects whether the app is running in:
 * - Development (localhost)
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

    // Beta - subdomain (beta.audio-analyzer.tinytech.site)
    if (this.hostname.startsWith('beta.')) {
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
