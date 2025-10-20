import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvironmentDetector } from '../../src/utils/environment-detector.js';

describe('EnvironmentDetector', () => {
  let originalLocation;

  beforeEach(() => {
    // Save original location
    originalLocation = window.location;

    // Mock window.location
    delete window.location;
    window.location = {
      hostname: 'localhost',
      pathname: '/',
    };
  });

  afterEach(() => {
    // Restore original location
    window.location = originalLocation;
  });

  describe('Development Environment', () => {
    it('should detect localhost as development', () => {
      window.location.hostname = 'localhost';
      window.location.pathname = '/';

      const detector = new EnvironmentDetector();

      expect(detector.getEnvironment()).toBe('development');
      expect(detector.isDevelopment()).toBe(true);
      expect(detector.isBeta()).toBe(false);
      expect(detector.isProduction()).toBe(false);
    });

    it('should detect 127.0.0.1 as development', () => {
      window.location.hostname = '127.0.0.1';
      window.location.pathname = '/';

      const detector = new EnvironmentDetector();

      expect(detector.getEnvironment()).toBe('development');
      expect(detector.isDevelopment()).toBe(true);
    });
  });

  describe('Beta Environment', () => {
    it('should detect /beta/ path as beta', () => {
      window.location.hostname = 'audio-analyzer.tinytech.site';
      window.location.pathname = '/beta/';

      const detector = new EnvironmentDetector();

      expect(detector.getEnvironment()).toBe('beta');
      expect(detector.isBeta()).toBe(true);
      expect(detector.isDevelopment()).toBe(false);
      expect(detector.isProduction()).toBe(false);
    });

    it('should detect /beta path as beta', () => {
      window.location.hostname = 'audio-analyzer.tinytech.site';
      window.location.pathname = '/beta';

      const detector = new EnvironmentDetector();

      expect(detector.getEnvironment()).toBe('beta');
      expect(detector.isBeta()).toBe(true);
    });
  });

  describe('Production Environment', () => {
    it('should detect production domain as production', () => {
      window.location.hostname = 'audio-analyzer.tinytech.site';
      window.location.pathname = '/';

      const detector = new EnvironmentDetector();

      expect(detector.getEnvironment()).toBe('production');
      expect(detector.isProduction()).toBe(true);
      expect(detector.isDevelopment()).toBe(false);
      expect(detector.isBeta()).toBe(false);
    });
  });

  describe('Environment Config', () => {
    it('should return dev config for development', () => {
      window.location.hostname = 'localhost';
      window.location.pathname = '/';

      const detector = new EnvironmentDetector();
      const config = detector.getEnvironmentConfig();

      expect(config.name).toBe('Development');
      expect(config.message).toBe('Development Environment');
      expect(config.productionUrl).toBe('https://audio-analyzer.tinytech.site');
      expect(config.showBanner).toBe(true);
    });

    it('should return beta config for beta', () => {
      window.location.hostname = 'audio-analyzer.tinytech.site';
      window.location.pathname = '/beta/';

      const detector = new EnvironmentDetector();
      const config = detector.getEnvironmentConfig();

      expect(config.name).toBe('Beta');
      expect(config.message).toBe('Beta Environment');
      expect(config.productionUrl).toBe('https://audio-analyzer.tinytech.site');
      expect(config.showBanner).toBe(true);
    });

    it('should return production config for production', () => {
      window.location.hostname = 'audio-analyzer.tinytech.site';
      window.location.pathname = '/';

      const detector = new EnvironmentDetector();
      const config = detector.getEnvironmentConfig();

      expect(config.name).toBe('Production');
      expect(config.showBanner).toBe(false);
    });
  });
});
