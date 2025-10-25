/**
 * Service for checking if a new version of the app is available
 */

interface VersionInfo {
  buildTime: number;
  version: string;
}

export class VersionCheckService {
  private currentVersion: VersionInfo | null = null;
  private checkInterval: number | null = null;
  private listeners: Array<() => void> = [];

  /**
   * Get the base path for the current deployment (handles beta vs production)
   */
  private getBasePath(): string {
    // Legacy: Check if we're in old /beta/ path deployment
    const path = window.location.pathname;
    if (path.startsWith('/beta/')) {
      return '/beta';
    }
    // Current: Subdomain-based deployments (beta.* vs production) all use root path
    return '';
  }

  /**
   * Initialize the version checker with the current build version
   */
  async initialize(): Promise<void> {
    // Skip version checking in development mode
    if (import.meta.env.DEV) {
      return;
    }

    try {
      const basePath = this.getBasePath();
      // Fetch the current version.json to establish baseline
      const response = await fetch(`${basePath}/version.json`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        this.currentVersion = await response.json();
        console.log('Current version:', this.currentVersion);
      }
    } catch (error) {
      console.error('Failed to load current version:', error);
    }
  }

  /**
   * Check if a new version is available
   * @returns true if new version detected, false otherwise
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.currentVersion) {
      console.warn('Current version not initialized');
      return false;
    }

    try {
      const basePath = this.getBasePath();
      // Fetch the latest version.json with cache-busting
      const response = await fetch(`${basePath}/version.json?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        return false;
      }

      const latestVersion: VersionInfo = await response.json();

      // Compare build times - if different, new version available
      if (latestVersion.buildTime !== this.currentVersion.buildTime) {
        console.log('New version detected:', latestVersion);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  /**
   * Start periodic version checking
   * @param intervalMinutes How often to check (default: 30 minutes)
   */
  startPeriodicCheck(intervalMinutes: number = 30): void {
    // Clear any existing interval
    this.stopPeriodicCheck();

    // Check immediately
    this.checkAndNotify();

    // Set up periodic checks
    this.checkInterval = window.setInterval(() => {
      this.checkAndNotify();
    }, intervalMinutes * 60 * 1000);

    // Also check when tab becomes visible (for users who leave tabs open)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkAndNotify();
      }
    });
  }

  /**
   * Stop periodic checking
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a listener to be called when update is detected
   */
  onUpdateAvailable(callback: () => void): void {
    this.listeners.push(callback);
  }

  /**
   * Get the current version info
   */
  getCurrentVersion(): VersionInfo | null {
    return this.currentVersion;
  }

  /**
   * Reload the page to get the new version
   * Forces a hard reload to bypass cache
   */
  reload(): void {
    // Multiple strategies to ensure cache is bypassed:

    // 1. Clear sessionStorage flag so banner doesn't immediately reappear
    sessionStorage.removeItem('updateBannerDismissed');

    // 2. Add cache-busting parameter
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());

    // 3. Use location.replace to avoid back button issues
    window.location.replace(url.toString());

    // Note: The browser will fetch fresh HTML due to cache-busting param,
    // and the HTML references new JS/CSS bundles with content hashes in filenames,
    // so cache invalidation happens automatically via Vite's build process
  }

  /**
   * Check for updates and notify listeners if found
   * Validates the update by checking twice with a delay to ensure deployment is complete
   */
  private async checkAndNotify(): Promise<void> {
    console.log('Checking for updates...');
    const hasUpdate = await this.checkForUpdates();
    console.log('Update available:', hasUpdate);

    if (hasUpdate) {
      console.log('Update detected, validating in 2 minutes...');

      // Wait 2 minutes to ensure deployment is complete
      await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));

      // Check again to confirm the version is stable
      const stillHasUpdate = await this.checkForUpdates();
      console.log('Update still available after validation:', stillHasUpdate);

      if (stillHasUpdate) {
        console.log('Notifying listeners:', this.listeners.length);
        this.listeners.forEach(callback => callback());
      } else {
        console.log('Update was transient (deployment in progress), ignoring');
      }
    }
  }
}

// Export singleton instance
export const versionCheckService = new VersionCheckService();
