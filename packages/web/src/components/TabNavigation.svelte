<script lang="ts">
  import { currentTab, type TabType } from '../stores/tabs';
  import { AppBridge } from '../bridge/app-bridge';
  import { isSimplifiedMode } from '../stores/simplifiedMode';
  import { analyticsService } from '../services/analytics-service';

  const bridge = AppBridge.getInstance();

  /**
   * Handle tab click - update store and dispatch event through bridge
   */
  function handleTabClick(tab: TabType): void {
    currentTab.setTab(tab);
    bridge.dispatch({ type: 'tab:changed', tab });
    analyticsService.track('tab_switched', { tab });
  }
</script>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--bg-tertiary, #e0e0e0);
  }

  .tab-button {
    padding: 0.75rem 1.5rem;
    border: none;
    background: transparent;
    color: var(--text-secondary, #666666);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s ease;
    position: relative;
    top: 2px;
  }

  .tab-button:hover {
    color: var(--text-primary, #333333);
    background: var(--bg-secondary, #f5f5f5);
  }

  .tab-button.active {
    color: var(--primary, #4CAF50);
    border-bottom-color: var(--primary, #4CAF50);
    font-weight: 600;
  }

  .tab-button:focus-visible {
    outline: 2px solid var(--primary, #4CAF50);
    outline-offset: 2px;
  }
</style>

<nav class="tabs sv-tab-nav" aria-label="Main navigation">
  <button
    class="tab-button"
    class:active={$currentTab === 'local'}
    onclick={() => handleTabClick('local')}
    aria-current={$currentTab === 'local' ? 'page' : undefined}
  >
    📁 Local Files
  </button>

  {#if !$isSimplifiedMode}
    <button
      class="tab-button"
      class:active={$currentTab === 'googleDrive'}
      onclick={() => handleTabClick('googleDrive')}
      aria-current={$currentTab === 'googleDrive' ? 'page' : undefined}
    >
      ☁️ Google Drive
    </button>
    <button
      class="tab-button"
      class:active={$currentTab === 'box'}
      onclick={() => handleTabClick('box')}
      aria-current={$currentTab === 'box' ? 'page' : undefined}
    >
      📦 Box
    </button>
    <button
      class="tab-button"
      class:active={$currentTab === 'settings'}
      onclick={() => handleTabClick('settings')}
      aria-current={$currentTab === 'settings' ? 'page' : undefined}
    >
      ⚙️ Settings
    </button>
  {/if}
</nav>
