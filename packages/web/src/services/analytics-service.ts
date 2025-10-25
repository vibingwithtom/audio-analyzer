// Extend Window interface to include umami
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, properties?: Record<string, any>) => void;
    };
  }
}

/**
 * Detect environment based on URL
 * - localhost/127.0.0.1 = development environment
 * - *.audio-analyzer.pages.dev (not audio-analyzer or staging) = preview environment
 * - beta.* subdomain or staging.audio-analyzer.pages.dev = beta environment
 * - /beta/ path = beta environment (legacy)
 * - everything else = production environment
 */
function getEnvironment(): 'development' | 'preview' | 'beta' | 'production' {
  if (typeof window === 'undefined' || !window.location) {
    return 'production';
  }

  const hostname = window.location.hostname;
  const pathname = window.location.pathname || '/';

  // Development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }

  // Preview - Cloudflare Pages feature branch deployments
  if (hostname.endsWith('.audio-analyzer.pages.dev')) {
    const subdomain = hostname.replace('.audio-analyzer.pages.dev', '');
    if (subdomain && subdomain !== 'staging') {
      return 'preview';
    }
  }

  // Beta (subdomain or staging Pages URL)
  if (hostname.startsWith('beta.') || hostname === 'staging.audio-analyzer.pages.dev') {
    return 'beta';
  }

  // Beta (legacy /beta/ path for backward compatibility)
  if (pathname.startsWith('/beta/')) {
    return 'beta';
  }

  // Production
  return 'production';
}

class AnalyticsService {
  private environment: string;

  constructor() {
    this.environment = getEnvironment();
  }

  track(eventName: string, properties?: Record<string, any>) {
    if (window.umami) {
      // Always add environment to all events for filtering
      window.umami.track(eventName, {
        ...properties,
        environment: this.environment,
      });
    }
  }

  /**
   * Get current environment
   */
  getEnvironment(): string {
    return this.environment;
  }
}

export const analyticsService = new AnalyticsService();
