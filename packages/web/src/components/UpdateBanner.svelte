<script lang="ts">
  import { onMount } from 'svelte';

  let { visible = false, onReload = () => {}, onDismiss = () => {} } = $props();

  let dismissed = $state(false);

  onMount(() => {
    // Check if user already dismissed this session
    dismissed = sessionStorage.getItem('updateBannerDismissed') === 'true';
  });

  function handleReload() {
    onReload();
  }

  function handleDismiss() {
    dismissed = true;
    sessionStorage.setItem('updateBannerDismissed', 'true');
    onDismiss();
  }

  let shouldShow = $derived(visible && !dismissed);
</script>

{#if shouldShow}
  <div class="update-banner" role="alert">
    <div class="update-banner-content">
      <div class="update-banner-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM9 7V10.4142L11.2929 12.7071L12.7071 11.2929L11 9.58579V7H9Z" fill="currentColor"/>
        </svg>
      </div>
      <div class="update-banner-message">
        <strong>New version available</strong>
        <span>A new version of Audio Analyzer is available. Reload to get the latest features and fixes.</span>
      </div>
      <div class="update-banner-actions">
        <button class="btn-reload" onclick={handleReload}>
          Reload Now
        </button>
        <button class="btn-dismiss" onclick={handleDismiss}>
          Later
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .update-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .update-banner-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .update-banner-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
  }

  .update-banner-message {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .update-banner-message strong {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .update-banner-message span {
    font-size: 0.85rem;
    opacity: 0.95;
  }

  .update-banner-actions {
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .update-banner-actions button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-reload {
    background: white;
    color: #667eea;
  }

  .btn-reload:hover {
    background: #f8f9fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-dismiss {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .btn-dismiss:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .update-banner {
      padding: 0.75rem;
    }

    .update-banner-content {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .update-banner-message {
      flex-basis: 100%;
    }

    .update-banner-actions {
      flex-basis: 100%;
      justify-content: flex-end;
    }

    .update-banner-actions button {
      flex: 1;
      max-width: 120px;
    }
  }
</style>
