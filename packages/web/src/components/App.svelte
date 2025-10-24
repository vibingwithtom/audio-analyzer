<script lang="ts">
  import { onMount } from 'svelte';
  import TabNavigation from './TabNavigation.svelte';
  import LocalFileTab from './LocalFileTab.svelte';
  import GoogleDriveTab from './GoogleDriveTab.svelte';
  import BoxTab from './BoxTab.svelte';
  import SettingsTab from './SettingsTab.svelte';
  import UpdateBanner from './UpdateBanner.svelte';
  import { currentTab, type TabType } from '../stores/tabs';
  import { versionCheckService } from '../services/version-check-service';
  import { initializeSimplifiedMode, isSimplifiedMode, lockedPresetId, autoAnalysisMode } from '../stores/simplifiedMode';
  import { setPreset } from '../stores/settings';
  import { setAnalysisMode } from '../stores/analysisMode';

  let updateAvailable = $state(false);
  let buildInfo = $state('Audio Analyzer');

  /**
   * Format build time as readable string
   */
  function formatBuildInfo(version: any): string {
    if (!version || !version.version) {
      return 'Audio Analyzer';
    }

    // Parse ISO string to get date
    const date = new Date(version.version);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `Audio Analyzer build-${year}.${month}.${day}-${hours}${minutes}`;
  }

  /**
   * Toggle dark mode
   */
  function toggleDarkMode(): void {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  }

  /**
   * Handle update reload
   */
  function handleReload(): void {
    versionCheckService.reload();
  }

  /**
   * Handle update banner dismissal
   */
  function handleDismiss(): void {
    updateAvailable = false;
  }

  // Apply saved theme on mount
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }

  // Listen for Box OAuth completion and restore tab
  onMount(() => {
    // Initialize simplified mode from URL parameters
    initializeSimplifiedMode();

    // If simplified mode is enabled, lock preset and analysis mode
    const unsubscribe = isSimplifiedMode.subscribe(isSimple => {
      if (isSimple) {
        // Get the locked preset and analysis mode
        let preset: string | null = null;
        let analysisMode: string = 'audio-only';

        const unsubPreset = lockedPresetId.subscribe(p => preset = p);
        const unsubMode = autoAnalysisMode.subscribe(m => analysisMode = m);

        unsubPreset();
        unsubMode();

        if (preset) {
          // Set the locked preset
          setPreset(preset);
          // Set the auto-determined analysis mode
          setAnalysisMode(analysisMode);
          // Force user to Local Files tab
          currentTab.setTab('local');
        }
      }
    });

    const handleBoxAuthComplete = (event: CustomEvent<{ returnTab: string }>) => {
      const { returnTab } = event.detail;
      if (returnTab) {
        currentTab.setTab(returnTab as TabType);
      }
    };

    window.addEventListener('box-auth-complete', handleBoxAuthComplete as EventListener);

    // Register update listener BEFORE starting periodic checks
    // This ensures the listener is ready when the first check completes
    versionCheckService.onUpdateAvailable(() => {
      updateAvailable = true;
    });

    // Initialize version checking
    versionCheckService.initialize().then(() => {
      // Update build info with current version
      const version = versionCheckService.getCurrentVersion();
      buildInfo = formatBuildInfo(version);

      // Start checking for updates every 30 minutes
      versionCheckService.startPeriodicCheck(30);

      // Expose to console for testing (beta builds only for security)
      if (import.meta.env.MODE === 'beta') {
        (window as any).__versionCheck = {
          triggerBanner: () => { updateAvailable = true; },
          checkNow: () => versionCheckService.checkForUpdates(),
          getCurrentVersion: () => versionCheckService.getCurrentVersion()
        };
        console.log('Version check helpers available: __versionCheck.triggerBanner(), __versionCheck.checkNow(), __versionCheck.getCurrentVersion()');
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('box-auth-complete', handleBoxAuthComplete as EventListener);
      versionCheckService.stopPeriodicCheck();
    };
  });
</script>

<style>
  /* Root app container */
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .header {
    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
    border-bottom: 1px solid var(--bg-tertiary, #e0e0e0);
    padding: 1rem 0;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .header-spacer {
    width: 48px; /* Same width as dark mode toggle for balance */
  }

  .logo {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    color: white;
  }

  .dark-mode-toggle {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    font-size: 1.5rem;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.3s ease;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dark-mode-toggle:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  .light-icon {
    display: inline;
  }

  .dark-icon {
    display: none;
  }

  :global([data-theme="dark"]) .light-icon {
    display: none;
  }

  :global([data-theme="dark"]) .dark-icon {
    display: inline;
  }

  /* Main content */
  .main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }


  /* Footer */
  .footer {
    background: var(--bg-secondary, #f5f5f5);
    border-top: 1px solid var(--bg-tertiary, #e0e0e0);
    padding: 1.5rem 0;
    margin-top: auto;
  }

  .footer p {
    margin: 0;
    text-align: center;
    color: var(--text-secondary, #666666);
    font-size: 0.9rem;
  }
</style>

<div class="app sv-app">
  <!-- Update Banner -->
  <UpdateBanner
    visible={updateAvailable}
    onReload={handleReload}
    onDismiss={handleDismiss}
  />

  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="header-spacer"></div>
      <h1 class="logo">🎵 Audio Analyzer</h1>
      <button
        class="dark-mode-toggle"
        onclick={toggleDarkMode}
        aria-label="Toggle dark mode"
      >
        <span class="light-icon">🌙</span>
        <span class="dark-icon">☀️</span>
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main">
    <div class="container">
      <!-- Tab Navigation -->
      <TabNavigation />

      <!-- Tab Content - Keep all components mounted to preserve state and allow cancellation -->
      <LocalFileTab hidden={$currentTab !== 'local'} />
      <GoogleDriveTab hidden={$currentTab !== 'googleDrive'} />
      <BoxTab hidden={$currentTab !== 'box'} />
      <SettingsTab hidden={$currentTab !== 'settings'} />
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <p id="buildInfo">{buildInfo}</p>
    </div>
  </footer>
</div>
