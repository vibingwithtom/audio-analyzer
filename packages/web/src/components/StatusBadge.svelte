<script lang="ts">
  let { status }: { status: 'pass' | 'fail' | 'warning' | 'error' } = $props();

  const badgeConfig = {
    pass: { icon: '✓', class: 'badge-success', text: 'Pass' },
    fail: { icon: '✗', class: 'badge-danger', text: 'Fail' },
    warning: { icon: '⚠', class: 'badge-warning', text: 'Warning' },
    error: { icon: '✗', class: 'badge-danger', text: 'Error' }
  };

  let config = $derived(badgeConfig[status] || badgeConfig.error);
</script>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25em 0.6em;
    font-size: 0.875em;
    font-weight: 600;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    vertical-align: baseline;
    border-radius: 0.375rem;
    color: #fff;
  }

  .badge-success {
    background-color: var(--success, #4CAF50);
  }

  .badge-danger {
    background-color: var(--danger, #f44336);
  }

  .badge-warning {
    background-color: var(--warning, #ff9800);
    color: #000;
  }
</style>

<span class="badge {config.class}">
  {config.icon} {config.text}
</span>
