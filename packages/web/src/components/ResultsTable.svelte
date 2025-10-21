<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  import { formatSampleRate, formatDuration, formatBitDepth, formatChannels, formatBytes } from '../utils/format-utils';
  import type { AudioResults, ValidationResults } from '../types';
  import { selectedPreset } from '../stores/settings';
  import { CriteriaValidator } from '@audio-analyzer/core';
  import {
    computeExperimentalStatus,
    getNormalizationStatus,
    getReverbStatus,
    getNoiseFloorStatus,
    getSilenceStatus,
    getClippingStatus,
    getMicBleedStatus
  } from '../utils/status-utils';

  import { onMount, onDestroy } from 'svelte';

  const {
    results = [],
    mode = 'single',
    metadataOnly = false,
    experimentalMode = false
  }: {
    results?: AudioResults[];
    mode?: 'single' | 'batch';
    metadataOnly?: boolean;
    experimentalMode?: boolean;
  } = $props();

  const isSingleFile = $derived(mode === 'single');

  let tableWrapper: HTMLElement;
  let hasHorizontalScroll = $state(false);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);
  let isFullscreen = $state(false);

  // Lazy blob URL management - create on-demand to prevent memory buildup
  const blobUrlCache = new Map<string, string>(); // filename -> blob URL

  function getAudioUrl(result: AudioResults): string | null {
    // Use existing audioUrl if available
    if (result.audioUrl) return result.audioUrl;

    // Check if File reference exists for lazy creation
    const file = (result as any).file;
    if (!file) return null;

    // Check cache first
    if (blobUrlCache.has(result.filename)) {
      return blobUrlCache.get(result.filename)!;
    }

    // Create blob URL and cache it
    const blobUrl = URL.createObjectURL(file);
    blobUrlCache.set(result.filename, blobUrl);
    return blobUrl;
  }

  // Cleanup blob URLs on component destroy
  onDestroy(() => {
    blobUrlCache.forEach(url => URL.revokeObjectURL(url));
    blobUrlCache.clear();
  });

  // Check if table has horizontal scroll and which direction
  function checkScroll() {
    if (tableWrapper) {
      hasHorizontalScroll = tableWrapper.scrollWidth > tableWrapper.clientWidth;
      canScrollLeft = tableWrapper.scrollLeft > 0;
      canScrollRight = tableWrapper.scrollLeft < tableWrapper.scrollWidth - tableWrapper.clientWidth;
    }
  }

  // Scroll the table left or right
  function scrollTable(direction: 'left' | 'right') {
    if (!tableWrapper) return;
    const scrollAmount = 300; // Scroll 300px at a time
    const targetScroll = direction === 'left'
      ? tableWrapper.scrollLeft - scrollAmount
      : tableWrapper.scrollLeft + scrollAmount;

    tableWrapper.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }

  // Fullscreen toggle
  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
  }

  // Handle ESC key to exit fullscreen
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isFullscreen) {
      isFullscreen = false;
    }
  }

  // Check scroll on mount and when results change
  onMount(() => {
    window.addEventListener('resize', checkScroll);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('resize', checkScroll);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  // Set up scroll listener when tableWrapper is bound (using $effect for reactivity)
  $effect(() => {
    if (tableWrapper) {
      checkScroll(); // Initial check
      const handleScroll = () => checkScroll();
      tableWrapper.addEventListener('scroll', handleScroll);

      return () => {
        tableWrapper.removeEventListener('scroll', handleScroll);
      };
    }
  });

  // Recheck scroll when results change
  $effect(() => {
    if (results.length > 0) {
      setTimeout(checkScroll, 100);
    }
  });

  function getValidationStatus(result: AudioResults, field: string): 'pass' | 'warning' | 'fail' | null {
    if (!result.validation) return null;
    return result.validation[field]?.status || null;
  }

  function getValidationIssue(result: AudioResults, field: string): string | undefined {
    if (!result.validation) return undefined;
    return result.validation[field]?.issue;
  }

  function getAllValidationIssues(result: AudioResults): string[] {
    if (!result.validation) return [];
    const issues: string[] = [];

    // Collect all validation issues
    Object.entries(result.validation).forEach(([field, validation]) => {
      if (validation.issue) {
        // Split concatenated error messages
        // Pattern: Capital letter after lowercase letter or closing paren indicates new error
        const splitErrors = validation.issue.split(/(?<=[a-z\)])(?=[A-Z])/);
        issues.push(...splitErrors.map(err => err.trim()).filter(err => err.length > 0));
      }
    });

    return issues;
  }

  // Helper functions for experimental metrics color-coding
  function getNormalizationClass(status: any): string {
    return getNormalizationStatus(status);
  }

  function getReverbClass(label: string): string {
    return getReverbStatus(label);
  }

  function getMicBleedClass(micBleed: any): string {
    if (!micBleed) return '';
    if (micBleed.new?.percentageConfirmedBleed < 0.5) return 'success';
    return 'warning';
  }

  function getMicBleedOldClass(micBleed: any): string {
    if (!micBleed?.old) return '';
    // Check if detected using the same logic as the display text
    const isDetected = (micBleed.old.leftChannelBleedDb > -60 || micBleed.old.rightChannelBleedDb > -60);
    if (isDetected) return 'warning';
    return 'success';
  }

  // Unified mic bleed detection using OR logic (either method detects = possible bleed)
  function getUnifiedMicBleedClass(micBleed: any): string {
    return getMicBleedStatus(micBleed);
  }

  function getUnifiedMicBleedLabel(micBleed: any): string {
    if (!micBleed) return 'N/A';

    // Check OLD method
    const oldDetected = micBleed.old &&
      (micBleed.old.leftChannelBleedDb > -60 || micBleed.old.rightChannelBleedDb > -60);

    // Check NEW method
    const newDetected = micBleed.new &&
      (micBleed.new.percentageConfirmedBleed > 0.5);

    // OR logic
    if (oldDetected || newDetected) return 'Possible bleed';
    return 'Not detected';
  }

  function getNoiseFloorClass(noiseFloorDb: number | undefined): string {
    return getNoiseFloorStatus(noiseFloorDb);
  }

  function getSilenceClass(seconds: number | undefined, type: 'lead-trail' | 'max'): string {
    return getSilenceStatus(seconds, type);
  }

  function formatTime(seconds: number | undefined): string {
    if (seconds === undefined || seconds === null) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Helper functions for conversational audio analysis using preset-aware validation
  function getOverlapClass(result: AudioResults): string {
    if (!$selectedPreset || !result.conversationalAnalysis) return '';

    const validation = CriteriaValidator.validateSpeechOverlap(
      result.conversationalAnalysis,
      $selectedPreset
    );

    if (!validation) return ''; // No validation needed for this preset

    if (validation.status === 'pass') return 'success';
    if (validation.status === 'warning') return 'warning';
    return 'error';
  }

  // Helper to get color class for overlap percentage only
  function getOverlapPercentageClass(result: AudioResults): string {
    if (!$selectedPreset || !result.conversationalAnalysis?.overlap) return '';
    if ($selectedPreset.maxOverlapWarning === undefined || $selectedPreset.maxOverlapFail === undefined) return '';

    const overlapPct = result.conversationalAnalysis.overlap.overlapPercentage;

    if (overlapPct > $selectedPreset.maxOverlapFail) return 'error';
    if (overlapPct > $selectedPreset.maxOverlapWarning) return 'warning';
    return 'success';
  }

  // Helper to get color class for overlap segment duration only
  function getOverlapSegmentClass(result: AudioResults): string {
    if (!$selectedPreset || !result.conversationalAnalysis?.overlap) return '';
    if ($selectedPreset.maxOverlapSegmentWarning === undefined || $selectedPreset.maxOverlapSegmentFail === undefined) return '';

    const longestSegment = getLongestOverlapDuration(result);
    if (longestSegment === null || longestSegment === 0) return 'success';

    if (longestSegment > $selectedPreset.maxOverlapSegmentFail) return 'error';
    if (longestSegment > $selectedPreset.maxOverlapSegmentWarning) return 'warning';
    return 'success';
  }

  // Helper to get stereo type validation class
  function getStereoTypeClass(result: AudioResults): string {
    if (!$selectedPreset) return '';

    const validation = CriteriaValidator.validateStereoType(
      result.stereoSeparation,
      $selectedPreset
    );

    if (!validation) return ''; // No validation needed for this preset

    return validation.status === 'pass' ? 'success' : 'error';
  }

  function getClippingSeverity(clippingAnalysis: any): { level: string; label: string; eventCount: number } {
    if (!clippingAnalysis) return { level: '', label: 'N/A', eventCount: 0 };

    const { clippedPercentage, clippingEventCount, nearClippingPercentage, nearClippingEventCount } = clippingAnalysis;

    // Hard clipping detected (any amount)
    if (clippingEventCount > 0) {
      // Severity based on percentage/count
      const level = (clippedPercentage > 1 || clippingEventCount > 50) ? 'error' : 'warning';
      return { level, label: 'Clipping detected', eventCount: clippingEventCount };
    }

    // Near-clipping warning
    if (nearClippingPercentage > 1) {
      return { level: 'warning', label: 'Near clipping detected', eventCount: nearClippingEventCount };
    }

    // All clear
    return { level: 'success', label: 'Not detected', eventCount: 0 };
  }

  function getClippingClass(clippingAnalysis: any): string {
    return getClippingStatus(clippingAnalysis);
  }

  // Helper to determine worst status across all experimental metrics for row background color
  function getExperimentalRowStatus(result: AudioResults): 'pass' | 'warning' | 'fail' {
    // Use the shared status computation, then map error to fail for table row styling
    const sharedStatus = computeExperimentalStatus(result);
    if (sharedStatus === 'error') {
      return 'fail'; // Map error to fail for table row display
    }

    let worstStatus: 'pass' | 'warning' | 'fail' = sharedStatus as 'pass' | 'warning' | 'fail';

    // Helper to update worst status
    const updateWorst = (status: string) => {
      if (status === 'error' || status === 'fail') {
        worstStatus = 'fail';
      } else if (status === 'warning' && worstStatus === 'pass') {
        worstStatus = 'warning';
      }
    };

    // Check preset-aware validations (these require $selectedPreset)
    // These are not included in the shared computeExperimentalStatus

    // Check stereo type
    const stereoClass = getStereoTypeClass(result);
    updateWorst(stereoClass);

    // Check speech overlap
    const overlapClass = getOverlapClass(result);
    updateWorst(overlapClass);

    return worstStatus;
  }

  // Helper to get the longest overlap segment duration
  function getLongestOverlapDuration(result: AudioResults): number | null {
    if (!result.conversationalAnalysis?.overlap?.overlapSegments) return null;

    const segments = result.conversationalAnalysis.overlap.overlapSegments;
    if (segments.length === 0) return null;

    return Math.max(...segments.map(seg => seg.duration));
  }
</script>

<style>
  .results-container {
    margin-top: 2rem;
  }

  .results-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: var(--bg-primary, #ffffff);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .results-table th,
  .results-table td {
    padding: 0.875rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--bg-tertiary, #e0e0e0);
  }

  .results-table th {
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary, #666666);
    background: var(--bg-secondary, #f5f5f5);
    border-bottom: 2px solid var(--bg-tertiary, #e0e0e0);
  }

  .results-table tbody tr {
    transition: background-color 0.15s ease;
  }

  .results-table tbody tr:hover {
    background: var(--bg-secondary, #f5f5f5);
  }

  .results-table tbody tr:last-child td {
    border-bottom: none;
  }

  .results-table td {
    font-size: 0.9375rem;
  }

  /* Row-level tinting based on overall status */
  .results-table tbody tr.status-fail {
    background-color: rgba(244, 67, 54, 0.05);
  }

  .results-table tbody tr.status-warning {
    background-color: rgba(255, 152, 0, 0.05);
  }

  .results-table tbody tr.status-pass {
    background-color: rgba(76, 175, 80, 0.05);
  }

  /* Dark mode row tinting - use higher opacity for visibility */
  :global([data-theme="dark"]) .results-table tbody tr.status-fail {
    background-color: rgba(244, 67, 54, 0.15);
  }

  :global([data-theme="dark"]) .results-table tbody tr.status-warning {
    background-color: rgba(255, 152, 0, 0.15);
  }

  :global([data-theme="dark"]) .results-table tbody tr.status-pass {
    background-color: rgba(76, 175, 80, 0.15);
  }

  /* Cell-level validation highlighting */
  .validation-pass {
    background-color: rgba(76, 175, 80, 0.15);
    color: var(--success, #4CAF50);
    font-weight: 600;
  }

  .validation-warning {
    background-color: rgba(255, 152, 0, 0.15);
    color: var(--warning, #ff9800);
    font-weight: 600;
  }

  .validation-fail {
    background-color: rgba(244, 67, 54, 0.15);
    color: var(--danger, #f44336);
    font-weight: 600;
  }

  .validation-issue {
    cursor: help;
  }

  .error-details-cell {
    white-space: pre-line;
    line-height: 1.6;
  }

  .error-line {
    display: block;
    margin: 0.25rem 0;
  }

  .error-line:first-child {
    margin-top: 0;
  }

  .error-line:last-child {
    margin-bottom: 0;
  }

  /* Experimental mode value color-coding */
  .value-success {
    color: var(--success, #4CAF50);
    font-weight: 500;
  }

  .value-warning {
    color: var(--warning, #ff9800);
    font-weight: 500;
  }

  .value-error {
    color: var(--danger, #f44336);
    font-weight: 500;
  }

  .subtitle {
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    display: block;
    margin-top: 0.15rem;
  }

  /* Container for experimental table with gradient overlay */
  .experimental-table-container {
    /* No overflow or positioning - just container for toolbar and table */
  }

  /* Fullscreen mode */
  .experimental-table-container.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    background: var(--bg-primary, #ffffff);
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }

  .experimental-table-container.fullscreen .table-with-controls {
    flex: 1;
    overflow: hidden;
  }

  .experimental-table-container.fullscreen .experimental-table-wrapper {
    height: 100%;
    overflow: auto;
  }

  /* Wrapper for table + scroll controls - clips buttons at table boundaries */
  .table-with-controls {
    position: relative;
    overflow: hidden; /* Clips buttons and shadow at table boundaries, not container boundaries */
  }

  /* Cover scrollbar under sticky columns */
  .table-with-controls::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 370px; /* Width of sticky columns (250px + 120px) */
    height: 20px; /* Height of typical scrollbar */
    background: var(--bg-primary, #ffffff);
    pointer-events: none;
    z-index: 5;
  }

  :global([data-theme="dark"]) .table-with-controls::after {
    background: var(--bg-primary, #1e1e1e);
  }

  /* Table toolbar with expand button */
  .table-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem 0;
    margin-bottom: 0.5rem;
  }

  .expand-button {
    background: var(--bg-secondary, #f5f5f5);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    line-height: 1;
    z-index: 100;
    position: relative;
  }

  .expand-button:hover {
    background: var(--bg-tertiary, #e0e0e0);
    transform: scale(1.05);
  }

  .expand-button:active {
    transform: scale(0.95);
  }

  /* Experimental table should be scrollable horizontally if needed */
  .experimental-table-wrapper {
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Remove overflow from table inside experimental wrapper to allow sticky */
  .experimental-table-wrapper .results-table {
    overflow: visible;
    width: max-content; /* Force table to be as wide as its content */
    min-width: 100%; /* But at least fill the container */
  }

  /* Sticky header for experimental table */
  .experimental-table-wrapper thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  /* Sticky first column (Filename) for experimental table */
  .experimental-table-wrapper table th:first-child,
  .experimental-table-wrapper table td:first-child {
    position: -webkit-sticky;
    position: sticky;
    left: 0;
    z-index: 3;
    background: var(--bg-primary, #ffffff);
    box-shadow: 2px 0 5px -2px rgba(0, 0, 0, 0.1);
    width: 250px;
    max-width: 250px;
  }

  .experimental-table-wrapper table thead th:first-child {
    z-index: 11; /* Higher than body cells, same level as sticky header */
  }

  /* Sticky second column (Status) for experimental table */
  .experimental-table-wrapper table th:nth-child(2),
  .experimental-table-wrapper table td:nth-child(2) {
    position: -webkit-sticky;
    position: sticky;
    left: 250px; /* Position after Filename column (250px fixed width) */
    z-index: 2;
    background: var(--bg-primary, #ffffff);
    box-shadow: 2px 0 5px -2px rgba(0, 0, 0, 0.1);
    width: 120px;
    max-width: 120px;
  }

  .experimental-table-wrapper table thead th:nth-child(2) {
    z-index: 11;
  }

  /* Dark mode support */
  :global([data-theme="dark"]) .experimental-table-wrapper table th:first-child,
  :global([data-theme="dark"]) .experimental-table-wrapper table td:first-child,
  :global([data-theme="dark"]) .experimental-table-wrapper table th:nth-child(2),
  :global([data-theme="dark"]) .experimental-table-wrapper table td:nth-child(2) {
    background: var(--bg-primary, #1e1e1e);
  }

  /* Shadow gradient overlay - stays fixed at right edge */
  .scroll-shadow {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 30px;
    background: linear-gradient(to left, rgba(0, 0, 0, 0.1), transparent);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    border-radius: 0 8px 8px 0;
  }

  .scroll-shadow.visible {
    opacity: 1;
  }

  /* Scroll buttons */
  .scroll-button {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50px;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.7));
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
    z-index: 20;
    font-size: 1.5rem;
    color: var(--text-primary, #333);
  }

  :global([data-theme="dark"]) .scroll-button {
    background: linear-gradient(to right, rgba(30, 30, 30, 0.95), rgba(30, 30, 30, 0.7));
  }

  .scroll-button.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .scroll-button:hover {
    background: linear-gradient(to right, rgba(245, 245, 245, 0.98), rgba(245, 245, 245, 0.8));
  }

  :global([data-theme="dark"]) .scroll-button:hover {
    background: linear-gradient(to right, rgba(50, 50, 50, 0.98), rgba(50, 50, 50, 0.8));
  }

  .scroll-button.left {
    left: 370px; /* Position after sticky Filename (250px) + Status (120px) columns */
    border-radius: 0; /* No rounded corners since it's mid-table */
  }

  .scroll-button.right {
    right: 0;
    border-radius: 0 8px 8px 0;
    background: linear-gradient(to left, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.7));
  }

  :global([data-theme="dark"]) .scroll-button.right {
    background: linear-gradient(to left, rgba(30, 30, 30, 0.95), rgba(30, 30, 30, 0.7));
  }

  .scroll-button.right:hover {
    background: linear-gradient(to left, rgba(245, 245, 245, 0.98), rgba(245, 245, 245, 0.8));
  }

  :global([data-theme="dark"]) .scroll-button.right:hover {
    background: linear-gradient(to left, rgba(50, 50, 50, 0.98), rgba(50, 50, 50, 0.8));
  }

  .external-link-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--primary, #2563eb);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-size: 1.25rem;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .external-link-btn:hover {
    background: var(--primary-dark, #1d4ed8);
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
  }

  .external-link-btn:active {
    transform: scale(0.95);
  }

  .mic-bleed-cell {
    cursor: help;
  }

  .conversational-cell {
    cursor: help;
  }
</style>

<div class="results-container">
  {#if experimentalMode}
    <!-- EXPERIMENTAL MODE TABLE -->
    <div class="experimental-table-container" class:fullscreen={isFullscreen}>
      <!-- Table header with expand button -->
      <div class="table-toolbar">
        <button
          class="expand-button"
          onclick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          title="Expand table to fullscreen (ESC to exit)"
        >
          {isFullscreen ? '⊗' : '⛶'}
        </button>
      </div>
      <!-- Wrapper for table + scroll controls (clips buttons at table boundaries) -->
      <div class="table-with-controls">
        <div class="experimental-table-wrapper" bind:this={tableWrapper}>
          <table class="results-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Status</th>
            <th>File Type</th>
            <th>Sample Rate</th>
            <th>Bit Depth</th>
            <th>Channels</th>
            <th>Duration</th>
            <th>Peak Level</th>
            <th>Normalization</th>
            <th>Clipping</th>
            <th>Noise Floor</th>
            <th>Reverb (RT60)</th>
            <th>Silence</th>
            <th>Stereo Separation</th>
            <th>Speech Overlap</th>
            <th>Mic Bleed</th>
          </tr>
        </thead>
        <tbody>
          {#each results as result, index (`${result.filename}-${index}`)}
            {@const rowStatus = getExperimentalRowStatus(result)}
            <tr class:status-pass={rowStatus === 'pass'} class:status-warning={rowStatus === 'warning'} class:status-fail={rowStatus === 'fail'}>
              <td>
                {result.filename}
              </td>
              <!-- Status column -->
              <td>
                <StatusBadge status={rowStatus} />
              </td>
              <!-- File Type column -->
              <td>
                {#if result.fileType}
                  <span style="color: {result.validation?.fileType?.status === 'fail' ? '#ef4444' : result.validation?.fileType?.status === 'warning' ? '#ff9800' : '#4caf50'};">
                    {result.fileType.toUpperCase()}
                  </span>
                {:else}
                  <span style="color: #ef4444;">Unknown</span>
                {/if}
              </td>
              <!-- Sample Rate column -->
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.sampleRate !== undefined}
                  <span style="color: {result.validation?.sampleRate?.status === 'fail' ? '#ef4444' : result.validation?.sampleRate?.status === 'warning' ? '#ff9800' : '#4caf50'};">
                    {formatSampleRate(result.sampleRate)}
                  </span>
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Bit Depth column -->
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.bitDepth !== undefined}
                  <span style="color: {result.validation?.bitDepth?.status === 'fail' ? '#ef4444' : result.validation?.bitDepth?.status === 'warning' ? '#ff9800' : '#4caf50'};">
                    {formatBitDepth(result.bitDepth)}
                  </span>
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Channels column -->
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.channels !== undefined}
                  <span style="color: {result.validation?.channels?.status === 'fail' ? '#ef4444' : result.validation?.channels?.status === 'warning' ? '#ff9800' : '#4caf50'};">
                    {formatChannels(result.channels)}
                  </span>
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Duration column -->
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.duration !== undefined}
                  <span style="color: {result.validation?.duration?.status === 'fail' ? '#ef4444' : result.validation?.duration?.status === 'warning' ? '#ff9800' : '#4caf50'};">
                    {formatDuration(result.duration)}
                  </span>
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Peak Level -->
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.peakDb !== undefined}
                  {result.peakDb.toFixed(1)} dB
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Normalization -->
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.normalizationStatus}
                  <span class="value-{getNormalizationClass(result.normalizationStatus)}">
                    {result.normalizationStatus.message || 'N/A'}
                  </span>
                  {#if result.normalizationStatus.peakDb !== undefined && result.normalizationStatus.targetDb !== undefined}
                    {@const distance = Math.abs(result.normalizationStatus.peakDb - result.normalizationStatus.targetDb)}
                    {#if result.normalizationStatus.status === 'normalized'}
                      <span class="subtitle">At target (-6.0 dB)</span>
                    {:else if result.normalizationStatus.status === 'too_loud'}
                      <span class="subtitle">{distance.toFixed(1)} dB over target</span>
                    {:else if result.normalizationStatus.status === 'too_quiet'}
                      <span class="subtitle">{distance.toFixed(1)} dB under target</span>
                    {/if}
                  {/if}
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Clipping -->
              <td
                class="conversational-cell"
                title={result.clippingAnalysis ? (() => {
                  let tooltip = 'Clipping Detection\n━━━━━━━━━━━━━━━━━\nDetects audio samples at maximum values (±1.0) which indicate\ndistortion from overdriven recording levels.';

                  const { clippedPercentage, clippingEventCount, nearClippingPercentage, nearClippingEventCount,
                          perChannel, hardClippingRegions } = result.clippingAnalysis;

                  tooltip += `\n\nHard Clipping: ${clippedPercentage.toFixed(2)}% (${clippingEventCount} regions)`;
                  if (nearClippingPercentage > 0) {
                    tooltip += `\nNear Clipping: ${nearClippingPercentage.toFixed(2)}% (${nearClippingEventCount} regions)`;
                  }

                  // Show worst clipping regions (hard clipping)
                  if (hardClippingRegions?.length > 0) {
                    tooltip += '\n\nWorst Clipping Regions (Hard):';
                    const regionsToShow = hardClippingRegions.slice(0, 3);
                    regionsToShow.forEach(region => {
                      const startMin = Math.floor(region.startTime / 60);
                      const startSec = (region.startTime % 60).toFixed(3); // Show decimal seconds

                      // For very short regions (< 0.1s), show as point in time instead of range
                      if (region.duration < 0.1) {
                        tooltip += `\n• ${region.channelName}: ${startMin}:${startSec} (${region.sampleCount} samples)`;
                      } else {
                        const endMin = Math.floor(region.endTime / 60);
                        const endSec = (region.endTime % 60).toFixed(3);
                        tooltip += `\n• ${region.channelName}: ${startMin}:${startSec}-${endMin}:${endSec} (${region.sampleCount} samples)`;
                      }
                    });
                  }

                  // Per-channel breakdown
                  if (perChannel?.length > 0) {
                    tooltip += '\n\nPer-Channel Breakdown:';
                    perChannel.forEach(ch => {
                      tooltip += `\n• ${ch.name}: ${ch.clippedPercentage.toFixed(2)}% clipped, ${ch.nearClippingPercentage.toFixed(2)}% near`;
                    });
                  }

                  return tooltip;
                })() : 'No clipping detected. Peak levels are below the threshold where clipping could occur.'}
              >
                {#if result.clippingAnalysis}
                  {@const severity = getClippingSeverity(result.clippingAnalysis)}
                  <span class="value-{severity.level}">
                    {severity.label}
                  </span>
                  {#if severity.eventCount > 0}
                    <span class="subtitle">{severity.eventCount} event{severity.eventCount > 1 ? 's' : ''}</span>
                  {/if}
                {:else if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.peakDb !== undefined}
                  <span class="value-success">Not detected</span>
                {:else}
                  N/A
                {/if}
              </td>
              <td
                class="conversational-cell"
                title={result.noiseFloorPerChannel ? (() => {
                  let tooltip = 'Noise Floor Analysis\n━━━━━━━━━━━━━━━━━\nMeasures the background noise level using histogram analysis of the quietest 30% of windows.';

                  tooltip += `\n\nOverall: ${result.noiseFloorDb === -Infinity ? '-∞' : result.noiseFloorDb.toFixed(1)} dB`;

                  if (result.noiseFloorPerChannel?.length > 0) {
                    tooltip += '\n\nPer-Channel Breakdown:';
                    result.noiseFloorPerChannel.forEach(ch => {
                      tooltip += `\n• ${ch.channelName}: ${ch.noiseFloorDb === -Infinity ? '-∞' : ch.noiseFloorDb.toFixed(1)} dB`;
                    });
                  }

                  if (result.hasDigitalSilence) {
                    tooltip += `\n\nDigital Silence Detected: ${result.digitalSilencePercentage.toFixed(1)}% of windows`;
                    tooltip += '\n(True silence where all samples = 0.0)';
                  }

                  tooltip += '\n\nTip: Lower values indicate cleaner recordings with less background noise.';

                  return tooltip;
                })() : 'Noise floor analysis data not available'}
              >
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.noiseFloorDb !== undefined}
                  <span class="value-{getNoiseFloorClass(result.noiseFloorDb)}">
                    {result.noiseFloorDb === -Infinity ? '-∞' : result.noiseFloorDb.toFixed(1)} dB
                  </span>
                  {#if result.hasDigitalSilence}
                    <span class="subtitle">Contains digital silence ({result.digitalSilencePercentage.toFixed(1)}%)</span>
                  {:else if result.noiseFloorPerChannel?.length === 2}
                    <!-- Stereo: Show left/right values on separate lines -->
                    <span class="subtitle">
                      L: {result.noiseFloorPerChannel[0].noiseFloorDb === -Infinity ? '-∞' : result.noiseFloorPerChannel[0].noiseFloorDb.toFixed(1)}
                    </span>
                    <span class="subtitle">
                      R: {result.noiseFloorPerChannel[1].noiseFloorDb === -Infinity ? '-∞' : result.noiseFloorPerChannel[1].noiseFloorDb.toFixed(1)}
                    </span>
                  {:else if result.noiseFloorPerChannel?.length > 2}
                    <!-- Multi-channel: Show consistency indicator -->
                    <span class="subtitle">
                      {#if result.noiseFloorPerChannel.every(ch => Math.abs(ch.noiseFloorDb - result.noiseFloorDb) < 2)}
                        Consistent across channels
                      {:else}
                        Varies by channel
                      {/if}
                    </span>
                  {/if}
                {:else}
                  N/A
                {/if}
              </td>
              <td
                class="conversational-cell"
                title={result.reverbAnalysis ? (() => {
                  let tooltip = 'Reverb (RT60) Estimation\n━━━━━━━━━━━━━━━━━\nEstimates the reverberation time (RT60) of the audio, indicating how long sound persists in a space.';

                  tooltip += `\n\nOverall Median RT60: ~${result.reverbInfo.time.toFixed(2)} s`;

                  if (result.reverbAnalysis.perChannelRt60?.length > 0) {
                    tooltip += '\n\nPer-Channel RT60:';
                    result.reverbAnalysis.perChannelRt60.forEach(ch => {
                      tooltip += `\n• ${ch.channelName}: ~${ch.medianRt60.toFixed(2)} s`;
                    });
                  }

                  tooltip += '\n\nTip: Shorter RT60 values indicate a drier, less reverberant space (e.g., vocal booth).';

                  return tooltip;
                })() : 'Reverb analysis data not available'}
              >
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.reverbInfo}
                  <span class="value-{getReverbClass(result.reverbInfo.label)}">
                    ~{result.reverbInfo.time.toFixed(2)} s
                  </span>
                  <span class="subtitle">{result.reverbInfo.label}</span>
                {:else}
                  N/A
                {/if}
              </td>
              <td
                class="conversational-cell"
                title={(() => {
                  let tooltip = 'Silence detection based on dynamic threshold (25% between noise floor and peak).\n\nFilters out audio ticks < 150ms.';

                  // Show worst silence segments if available
                  if (result.silenceSegments?.length > 0) {
                    tooltip += `\n\n⚠️ Worst silence gaps:`;
                    const segmentsToShow = result.silenceSegments.slice(0, 5);
                    segmentsToShow.forEach(seg => {
                      const startMin = Math.floor(seg.startTime / 60);
                      const startSec = Math.floor(seg.startTime % 60);
                      const endMin = Math.floor(seg.endTime / 60);
                      const endSec = Math.floor(seg.endTime % 60);
                      tooltip += `\n${startMin}:${startSec.toString().padStart(2, '0')}-${endMin}:${endSec.toString().padStart(2, '0')} (${seg.duration.toFixed(1)}s)`;
                    });
                  } else {
                    tooltip += '\n\nNo significant silence gaps detected.';
                  }

                  return tooltip;
                })()}
              >
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.leadingSilence !== undefined}
                  <div>
                    <span class="subtitle">Lead: <span class="value-{getSilenceClass(result.leadingSilence, 'lead-trail')}">{formatTime(result.leadingSilence)}</span></span>
                    <span class="subtitle">Trail: <span class="value-{getSilenceClass(result.trailingSilence, 'lead-trail')}">{formatTime(result.trailingSilence)}</span></span>
                    <span class="subtitle">Max: <span class="value-{getSilenceClass(result.longestSilence, 'max')}">{formatTime(result.longestSilence)}</span></span>
                  </div>
                {:else}
                  N/A
                {/if}
              </td>
              <td>
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.stereoSeparation}
                  <span class="value-{getStereoTypeClass(result)}">
                    {result.stereoSeparation.stereoType}
                  </span>
                  <span class="subtitle">{Math.round(result.stereoSeparation.stereoConfidence * 100)}% conf</span>
                {:else if result.channels !== undefined}
                  <span class="value-{getStereoTypeClass(result)}">
                    Mono file
                  </span>
                {:else}
                  N/A
                {/if}
              </td>
              <!-- Speech Overlap -->
              <td
                class="conversational-cell"
                title={result.conversationalAnalysis?.overlap ? (() => {
                  let tooltip = 'Detects when both channels have active speech simultaneously.\n\nBased on noise floor + 20 dB threshold.';
                  tooltip += `\n\nResult: ${result.conversationalAnalysis.overlap.overlapPercentage.toFixed(1)}% overlap`;

                  if (result.conversationalAnalysis.overlap.overlapSegments?.length > 0) {
                    tooltip += ` (${result.conversationalAnalysis.overlap.overlapSegments.length} instance${result.conversationalAnalysis.overlap.overlapSegments.length > 1 ? 's' : ''})`;
                    tooltip += `\n\nFilters interjections < ${result.conversationalAnalysis.overlap.minOverlapDuration}s`;

                    // Show top 5 worst (longest) overlap instances
                    tooltip += '\n\n⚠️ Worst overlap times:';
                    const sortedSegments = [...result.conversationalAnalysis.overlap.overlapSegments].sort((a, b) => b.duration - a.duration);
                    const segmentsToShow = sortedSegments.slice(0, 5);
                    segmentsToShow.forEach(seg => {
                      const startMin = Math.floor(seg.startTime / 60);
                      const startSec = Math.floor(seg.startTime % 60);
                      const endMin = Math.floor(seg.endTime / 60);
                      const endSec = Math.floor(seg.endTime % 60);

                      // Show duration
                      tooltip += `\n${startMin}:${startSec.toString().padStart(2, '0')}-${endMin}:${endSec.toString().padStart(2, '0')} (${seg.duration.toFixed(1)}s)`;
                    });
                  }

                  return tooltip;
                })() : 'Speech overlap analysis only runs for Conversational Stereo files'}
              >
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.conversationalAnalysis?.overlap}
                  {@const longestDuration = getLongestOverlapDuration(result)}
                  <div>
                    <span class="subtitle">%: <span class="value-{getOverlapPercentageClass(result)}">{result.conversationalAnalysis.overlap.overlapPercentage.toFixed(1)}%</span></span>
                    {#if longestDuration !== null && $selectedPreset?.maxOverlapSegmentWarning !== undefined}
                      <span class="subtitle">Max: <span class="value-{getOverlapSegmentClass(result)}">{longestDuration.toFixed(1)}s</span></span>
                    {/if}
                  </div>
                {:else}
                  N/A
                {/if}
              </td>
              <td
                class="mic-bleed-cell"
                title={result.micBleed ? (() => {
                  // Check if bleed is detected
                  const oldDetected = result.micBleed.old &&
                    (result.micBleed.old.leftChannelBleedDb > -60 || result.micBleed.old.rightChannelBleedDb > -60);
                  const newDetected = result.micBleed.new &&
                    (result.micBleed.new.percentageConfirmedBleed > 0.5);

                  if (oldDetected || newDetected) {
                    // Bleed detected - show detailed info
                    let tooltip = 'Detects audio leakage between channels.\n\nResult: Mic bleed detected';
                    if (result.micBleed.new?.bleedSegments?.length > 0) {
                      tooltip += ` in ${result.micBleed.new.bleedSegments.length} segment${result.micBleed.new.bleedSegments.length > 1 ? 's' : ''}.`;
                    } else {
                      tooltip += '.';
                    }

                    // Show NEW method details if available
                    if (newDetected && result.micBleed.new?.severityScore > 0) {
                      tooltip += `\n\nSeverity: ${result.micBleed.new.severityScore.toFixed(1)}/100`;
                    }
                    if (newDetected && result.micBleed.new?.peakCorrelation > 0) {
                      tooltip += `\nPeak Correlation: ${result.micBleed.new.peakCorrelation.toFixed(2)}`;
                    }

                    // Show worst affected segments (top 10) - only if NEW method has data
                    if (result.micBleed.new?.bleedSegments?.length > 0) {
                      tooltip += '\n\n⚠️ Worst affected times:';
                      const segmentsToShow = result.micBleed.new.bleedSegments.slice(0, 10);
                      segmentsToShow.forEach(seg => {
                        const startMin = Math.floor(seg.startTime / 60);
                        const startSec = Math.floor(seg.startTime % 60);
                        const endMin = Math.floor(seg.endTime / 60);
                        const endSec = Math.floor(seg.endTime % 60);

                        // If segment duration < 1 second, show just start time
                        const duration = seg.endTime - seg.startTime;
                        if (duration < 1.0) {
                          tooltip += `\n${startMin}:${startSec.toString().padStart(2, '0')} (${seg.maxCorrelation.toFixed(2)} corr)`;
                        } else {
                          tooltip += `\n${startMin}:${startSec.toString().padStart(2, '0')}-${endMin}:${endSec.toString().padStart(2, '0')} (${seg.maxCorrelation.toFixed(2)} corr)`;
                        }
                      });
                    } else if (oldDetected && result.micBleed.old) {
                      // If NEW method didn't find segments, show OLD method channel levels
                      tooltip += '\n\nAverage Bleed Levels:';
                      if (result.micBleed.old.leftChannelBleedDb > -60) {
                        tooltip += `\n• Left channel: ${result.micBleed.old.leftChannelBleedDb.toFixed(1)} dB`;
                      }
                      if (result.micBleed.old.rightChannelBleedDb > -60) {
                        tooltip += `\n• Right channel: ${result.micBleed.old.rightChannelBleedDb.toFixed(1)} dB`;
                      }
                      tooltip += '\n\n(Simple average method - specific timestamps not available)';
                    }

                    return tooltip;
                  } else {
                    // No bleed detected
                    return 'Detects audio leakage between channels.\n\nResult: No mic bleed detected.';
                  }
                })() : 'Mic bleed analysis only runs for Conversational Stereo files'}
              >
                {#if result.validation?.fileType?.status === 'fail'}
                  <span style="color: #ef4444;">--</span>
                {:else if result.micBleed}
                  <span class="value-{getUnifiedMicBleedClass(result.micBleed)}">
                    {getUnifiedMicBleedLabel(result.micBleed)}
                  </span>
                {:else}
                  N/A
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <!-- Shadow gradient overlay - positioned relative to table-with-controls wrapper -->
    <div class="scroll-shadow" class:visible={hasHorizontalScroll}></div>
    <!-- Scroll buttons - positioned relative to table-with-controls wrapper so they don't scroll with content -->
    <button
      class="scroll-button left"
      class:visible={canScrollLeft}
      onclick={() => scrollTable('left')}
      aria-label="Scroll left"
    >
      ◀
    </button>
    <button
      class="scroll-button right"
      class:visible={canScrollRight}
      onclick={() => scrollTable('right')}
      aria-label="Scroll right"
    >
      ▶
    </button>
  </div>
  </div>
  {:else}
    <!-- STANDARD MODE TABLE -->
    <table class="results-table">
    <thead>
      <tr>
        <th>Filename</th>
        <th>Status</th>
        {#if metadataOnly}
          <th>Error Details</th>
        {:else}
          <th>File Type</th>
          <th>Sample Rate</th>
          <th>Bit Depth</th>
          <th>Channels</th>
          <th>Duration</th>
          <th>File Size</th>
          <th>Play</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each results as result, index (`${result.filename}-${index}`)}
        <tr class:status-pass={result.status === 'pass'} class:status-warning={result.status === 'warning'} class:status-fail={result.status === 'fail'}>
          <td
            class:validation-pass={getValidationStatus(result, 'filename') === 'pass'}
            class:validation-warning={getValidationStatus(result, 'filename') === 'warning'}
            class:validation-fail={getValidationStatus(result, 'filename') === 'fail'}
            class:validation-issue={getValidationIssue(result, 'filename')}
            title={getValidationIssue(result, 'filename')}
          >
            {result.filename}
          </td>
          <td><StatusBadge status={result.status} /></td>
          {#if metadataOnly}
            <!-- Filename-only mode: Show error details inline -->
            <td class="error-details-cell">
              {getValidationIssue(result, 'filename') || '—'}
            </td>
          {:else}
            <!-- Full analysis mode: Show all columns -->
            <td
              class:validation-pass={getValidationStatus(result, 'fileType') === 'pass'}
              class:validation-warning={getValidationStatus(result, 'fileType') === 'warning'}
              class:validation-fail={getValidationStatus(result, 'fileType') === 'fail'}
              class:validation-issue={getValidationIssue(result, 'fileType')}
              title={getValidationIssue(result, 'fileType')}
            >
              {result.fileType?.toUpperCase() || 'Unknown'}
            </td>
            <td
              class:validation-pass={getValidationStatus(result, 'sampleRate') === 'pass'}
              class:validation-warning={getValidationStatus(result, 'sampleRate') === 'warning'}
              class:validation-fail={getValidationStatus(result, 'sampleRate') === 'fail'}
              class:validation-issue={getValidationIssue(result, 'sampleRate')}
              title={getValidationIssue(result, 'sampleRate')}
            >
              {formatSampleRate(result.sampleRate)}
            </td>
            <td
              class:validation-pass={getValidationStatus(result, 'bitDepth') === 'pass'}
              class:validation-warning={getValidationStatus(result, 'bitDepth') === 'warning'}
              class:validation-fail={getValidationStatus(result, 'bitDepth') === 'fail'}
              class:validation-issue={getValidationIssue(result, 'bitDepth')}
              title={getValidationIssue(result, 'bitDepth')}
            >
              {formatBitDepth(result.bitDepth)}
            </td>
            <td
              class:validation-pass={getValidationStatus(result, 'channels') === 'pass'}
              class:validation-warning={getValidationStatus(result, 'channels') === 'warning'}
              class:validation-fail={getValidationStatus(result, 'channels') === 'fail'}
              class:validation-issue={getValidationIssue(result, 'channels')}
              title={getValidationIssue(result, 'channels')}
            >
              {formatChannels(result.channels)}
            </td>
            <td
              class:validation-pass={getValidationStatus(result, 'duration') === 'pass'}
              class:validation-warning={getValidationStatus(result, 'duration') === 'warning'}
              class:validation-fail={getValidationStatus(result, 'duration') === 'fail'}
              class:validation-issue={getValidationIssue(result, 'duration')}
              title={getValidationIssue(result, 'duration')}
            >
              {formatDuration(result.duration)}
            </td>
            <td>
              {formatBytes(result.fileSize)}
            </td>
            <td>
              {#if getAudioUrl(result)}
                <audio controls src={getAudioUrl(result)}></audio>
              {:else if result.externalUrl}
                <a href={result.externalUrl} target="_blank" rel="noopener noreferrer" class="external-link-btn" title="View in Box/Google Drive">
                  ▶
                </a>
              {/if}
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {/if}
</div>
