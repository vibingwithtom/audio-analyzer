// Extend Window interface to include umami
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, properties?: Record<string, any>) => void;
    };
  }
}

/**
 * Detect environment based on URL path
 * - /beta/ path = beta environment
 * - / path = production environment
 * - localhost/127.0.0.1 = development environment
 */
function getEnvironment(): 'development' | 'beta' | 'production' {
  if (typeof window === 'undefined' || !window.location) {
    return 'production';
  }

  const hostname = window.location.hostname;
  const pathname = window.location.pathname || '/';

  // Development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }

  // Beta (deployed to /beta/ path)
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
