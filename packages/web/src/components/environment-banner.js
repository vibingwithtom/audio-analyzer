/**
 * Environment Banner Component
 *
 * Simple thin bar to indicate dev/beta environment with link to production
 */

import { EnvironmentDetector } from '../utils/environment-detector.js';

export class EnvironmentBanner {
  constructor() {
    this.detector = new EnvironmentDetector();
    this.config = this.detector.getEnvironmentConfig();
  }

  /**
   * Initialize and render the banner
   */
  init() {
    // Only show banner for non-production environments
    if (!this.config.showBanner) {
      return;
    }

    this.render();
  }

  /**
   * Render the thin environment bar
   */
  render() {
    const banner = document.createElement('div');
    banner.className = 'environment-banner';
    banner.setAttribute('data-environment', this.detector.getEnvironment());

    banner.innerHTML = `
      <div class="environment-banner-content">
        <span class="environment-banner-text">${this.config.message}</span>
        <a href="${this.config.productionUrl}" class="environment-banner-link">
          Switch to Production Environment
        </a>
      </div>
    `;

    // Insert at the beginning of body
    document.body.insertBefore(banner, document.body.firstChild);
  }
}
