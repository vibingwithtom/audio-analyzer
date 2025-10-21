<script lang="ts">
  import ResultsTable from './ResultsTable.svelte';
  import { analysisMode, setAnalysisMode, type AnalysisMode } from '../stores/analysisMode';
  import { currentPresetId, currentCriteria, selectedPreset, enableIncludeFailureAnalysis, enableIncludeRecommendations } from '../stores/settings';
  import { isSimplifiedMode } from '../stores/simplifiedMode';
  import { resultsFilter, type ResultFilterType } from '../stores/resultsFilter';
  import { analyticsService } from '../services/analytics-service';
  import type { AudioResults } from '../types';
  import { exportResultsToCsv, exportResultsEnhanced, type ExportOptions } from '../utils/export-utils';
  import { formatDuration } from '../utils/format-utils';
  import { computeExperimentalStatus } from '../utils/status-utils';

  // Props
  export let results: AudioResults | AudioResults[] | null = null;
  export let isProcessing = false;
  export let error: string | null = null;
  export let resultsMode: AnalysisMode | null = null;
  export let resultsStale = false;
  export let processedFiles = 0;
  export let totalFiles = 0;
  export let onReprocess: (() => void) | null = null;
  export let onCancel: (() => void) | null = null;
  export let cancelRequested = false;
  export let folderName: string | null = null; // Name of folder being processed
  export let folderUrl: string | null = null; // URL of folder being processed
  export let showBuiltInProgress = true; // Controls whether to show the built-in progress bar

  // Determine if we're in batch mode
  $: isBatchMode = Array.isArray(results);
  $: batchResults = isBatchMode ? results as AudioResults[] : [];
  $: singleResult = !isBatchMode && results ? results as AudioResults : null;

  // Memoize experimental status calculations for performance
  $: enrichedResults = batchResults.map(result => ({
    ...result,
    computedStatus: $analysisMode === 'experimental'
      ? computeExperimentalStatus(result)
      : result.status
  }));

  // Filter results based on active filter
  $: filteredResults = !$resultsFilter
    ? enrichedResults
    : enrichedResults.filter(r => {
        // Errors are a special case: they bypass experimental status computation
        // because errors occur before quality analysis (e.g., file read failures).
        // Error status is set before any audio analysis happens.
        if ($resultsFilter === 'error') {
          return r.status === 'error';
        }
        // For quality-based filters (pass/warning/fail), only consider non-error results
        // and use computedStatus which reflects experimental mode quality metrics.
        // This ensures errors don't appear in pass/warning/fail filters, even if
        // they somehow had a computed status.
        return r.status !== 'error' && r.computedStatus === $resultsFilter;
      });


  // Calculate batch statistics using enrichedResults for consistency
  $: passCount = enrichedResults.filter(r =>
    r.status !== 'error' && r.computedStatus === 'pass'
  ).length;

  $: warningCount = enrichedResults.filter(r =>
    r.status !== 'error' && r.computedStatus === 'warning'
  ).length;

  $: failCount = enrichedResults.filter(r =>
    r.status !== 'error' && r.computedStatus === 'fail'
  ).length;

  $: errorCount = enrichedResults.filter(r => r.status === 'error').length;

  // Calculate total duration (not shown in experimental mode)
  $: totalDuration = (() => {
    if (!isBatchMode || $analysisMode === 'filename-only' || $analysisMode === 'experimental') return null;

    // Only for pass+warning files in standard modes
    const filesToInclude = batchResults.filter(r => r.status === 'pass' || r.status === 'warning');
    const total = filesToInclude.reduce((sum, r) => sum + (r.duration || 0), 0);

    return formatDuration(total);
  })();

  // Format results mode for display
  function formatResultsMode(mode: AnalysisMode | null): string {
    if (!mode) return 'Unknown';
    switch (mode) {
      case 'full': return 'Full Analysis';
      case 'audio-only': return 'Audio Only';
      case 'experimental': return 'Experimental Analysis';
      case 'filename-only': return 'Filename Only';
      default: return mode;
    }
  }

  function formatAnalysisMode(mode: AnalysisMode): string {
    switch (mode) {
      case 'full': return 'Full Analysis';
      case 'audio-only': return 'Audio Only';
      case 'experimental': return 'Experimental Analysis';
      case 'filename-only': return 'Filename Only';
      default: return mode;
    }
  }

  // Filter click handler
  function handleFilterClick(status: 'pass' | 'warning' | 'fail' | 'error') {
    // If clicking the current filter, toggle it off. Otherwise, set the new filter.
    if ($resultsFilter === status) {
      resultsFilter.set(null);
    } else {
      resultsFilter.set(status);
    }
  }

  // Export state
  let isExporting = false;
  let exportError: string | null = null;
  let exportSuccess = false;

  // Export handler
  function handleExport() {
    if (!isBatchMode || filteredResults.length === 0) {
      return;
    }

    isExporting = true;
    exportError = null;
    exportSuccess = false;

    try {
      // Map filter types to UI labels for filename
      const filterLabels: Record<Exclude<ResultFilterType, null>, string> = {
        'pass': 'Pass',
        'warning': 'Warnings',
        'fail': 'Failed',
        'error': 'Errors'
      };

      // Dynamically generate filename using UI labels
      const filterName = $resultsFilter ? `_${filterLabels[$resultsFilter]}` : '';
      const baseName = $enableIncludeFailureAnalysis || $enableIncludeRecommendations
        ? 'audio_analysis_enhanced'
        : 'audio_analysis_results';
      const dynamicFilename = `${baseName}${filterName}.csv`;

      // Track export with analytics
      analyticsService.track('batch_export', {
        filterActive: !!$resultsFilter,
        filterType: $resultsFilter || 'none',
        resultCount: filteredResults.length,
        totalResultCount: enrichedResults.length,
        enhanced: $enableIncludeFailureAnalysis || $enableIncludeRecommendations,
        analysisMode: $analysisMode
      });

      // Handle all 4 analysis modes correctly
      const exportOptions: ExportOptions = {
        mode: $analysisMode === 'filename-only' ? 'metadata-only' :
              $analysisMode === 'experimental' ? 'experimental' : 'standard'
              // 'full' and 'audio-only' both map to 'standard'
      };

      // Use enhanced export if either failure analysis or recommendations is enabled
      const useEnhancedExport = $enableIncludeFailureAnalysis || $enableIncludeRecommendations;

      if (useEnhancedExport) {
        // Add export options for failure analysis and recommendations
        const exportOpts = {
          ...exportOptions,
          includeFailureAnalysis: $enableIncludeFailureAnalysis,
          includeRecommendations: $enableIncludeRecommendations
        };

        exportResultsEnhanced(
          filteredResults,
          exportOpts,
          $currentPresetId,
          $analysisMode,
          $currentCriteria,
          dynamicFilename,
          $selectedPreset
        );
      } else {
        exportResultsToCsv(
          filteredResults,
          exportOptions,
          $currentPresetId,
          $analysisMode,
          dynamicFilename
        );
      }

      // Show success feedback
      exportSuccess = true;
      setTimeout(() => {
        exportSuccess = false;
      }, 3000);

    } catch (error) {
      exportError = error instanceof Error ? error.message : 'Export failed';
      console.error('Export failed:', error);
    } finally {
      isExporting = false;
    }
  }
</script>

<style>
  .results-display {
    margin-top: 1rem;
  }

  .error-message {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(244, 67, 54, 0.15) 100%);
    border: 1px solid rgba(244, 67, 54, 0.3);
    color: var(--danger, #f44336);
    border-radius: 8px;
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .processing-indicator {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.1) 100%);
    border: 1px solid rgba(76, 175, 80, 0.2);
    border-radius: 8px;
    text-align: center;
    color: var(--success, #4CAF50);
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  /* Batch Progress Styles */
  .batch-progress-section {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.1) 100%);
    border: 1px solid rgba(76, 175, 80, 0.2);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .progress-bar-container {
    width: 100%;
    height: 24px;
    background: var(--bg-tertiary, #e0e0e0);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 0.75rem;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--success, #4CAF50) 0%, #66BB6A 100%);
    transition: width 0.3s ease;
    border-radius: 12px;
  }

  .progress-text {
    text-align: center;
    font-weight: 500;
    color: var(--success, #4CAF50);
    font-size: 0.95rem;
    margin-bottom: 0.75rem;
  }

  .cancel-button {
    display: block;
    margin: 0 auto;
    padding: 0.5rem 1.25rem;
    background: var(--danger, #f44336);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button:hover:not(:disabled) {
    background: #d32f2f;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
  }

  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Stale Results Indicator */
  .stale-indicator {
    margin: 1rem 0;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.15) 100%);
    border: 1px solid rgba(255, 152, 0, 0.3);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .stale-indicator-text {
    color: var(--text-primary, #333333);
    font-weight: 500;
    font-size: 0.875rem;
  }

  .reprocess-button {
    padding: 0.5rem 1rem;
    background: var(--primary, #2563eb);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .reprocess-button:hover {
    background: var(--primary-dark, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  }

  .reprocess-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .stale-results-overlay {
    position: relative;
  }

  .stale-results-overlay::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.7);
    pointer-events: none;
    border-radius: 8px;
  }

  :global([data-theme="dark"]) .stale-results-overlay::after {
    background: rgba(15, 23, 42, 0.7);
  }

  /* Batch Summary Styles */
  .batch-summary {
    margin: 1.5rem 0;
    padding: 1.5rem;
    background: var(--bg-secondary, #f5f5f5);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .batch-header {
    display: flex;
    flex-direction: column;
    margin-bottom: 1.25rem;
  }

  .batch-summary h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #333333);
  }

  .folder-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary, #666666);
  }

  .folder-name .folder-icon {
    font-size: 1rem;
  }

  .folder-link {
    color: var(--primary, #2563eb);
    text-decoration: none;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .folder-link:hover {
    text-decoration: underline;
    color: var(--primary-dark, #1d4ed8);
  }

  .summary-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .summary-stats {
    display: flex;
    gap: 0;
    flex: 1;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0;
    min-width: 80px;
  }

  /* Scoped stat styles - only affect stats in summary section */
  .summary-stats .stat {
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;
    padding: 0.5rem;
    border: 2px solid transparent;
  }

  .summary-stats .stat:hover {
    background-color: rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
  }

  .summary-stats .stat:focus {
    outline: 2px solid var(--primary, #2563eb);
    outline-offset: 2px;
  }

  .summary-stats .stat.active {
    background-color: var(--primary-light, rgba(37, 99, 235, 0.1));
    border: 2px solid var(--primary, #2563eb);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
    font-weight: 500;
  }

  .stat.pass .stat-value {
    color: var(--success, #4CAF50);
  }

  .stat.warning .stat-value {
    color: var(--warning, #ff9800);
  }

  .stat.fail .stat-value {
    color: var(--danger, #f44336);
  }

  .stat.error .stat-value {
    color: var(--danger, #f44336);
  }

  .duration-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    min-width: 200px;
  }

  .duration-label {
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .duration-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary, #2563eb);
    line-height: 1;
  }

  /* Mode Switcher Hints */
  .mode-switcher {
    margin: 1rem 0;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-secondary, #666);
  }

  .mode-switcher a {
    color: #7c3aed;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .mode-switcher a:hover {
    text-decoration: underline;
  }

  /* Export Button Styles */
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .export-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--primary, #2563eb);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .export-button:hover:not(:disabled) {
    background: var(--primary-dark, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  }

  .export-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .loading-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .export-error {
    padding: 0.5rem;
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    color: var(--danger, #f44336);
    border-radius: 4px;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .export-success {
    padding: 0.5rem;
    background: rgba(76, 175, 80, 0.1);
    border: 1px solid rgba(76, 175, 80, 0.3);
    color: var(--success, #4CAF50);
    border-radius: 4px;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  /* Empty filter state */
  .empty-filter-state {
    margin: 1rem 0;
    padding: 2rem;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    text-align: center;
  }

  .empty-filter-state p {
    margin: 0 0 1rem 0;
    color: var(--text-secondary, #666666);
    font-size: 1rem;
  }

  .clear-filter-inline {
    padding: 0.5rem 1rem;
    background: var(--primary, #2563eb);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-filter-inline:hover {
    background: var(--primary-dark, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  }

  /* Dark mode support */
  :global([data-theme="dark"]) .summary-stats .stat:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
</style>

<div class="results-display">
  <!-- Error Message -->
  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <!-- Processing Indicator (only show if showBuiltInProgress is true) -->
  {#if isProcessing && showBuiltInProgress}
    {#if isBatchMode && totalFiles > 1}
      <div class="batch-progress-section">
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: {(processedFiles / totalFiles) * 100}%"></div>
        </div>
        <div class="progress-text">
          Processing {processedFiles} of {totalFiles} files... ({Math.round((processedFiles / totalFiles) * 100)}%)
        </div>
        {#if onCancel}
          <button class="cancel-button" on:click={onCancel} disabled={cancelRequested}>
            {cancelRequested ? 'Cancelling...' : '✕ Cancel'}
          </button>
        {/if}
      </div>
    {:else}
      <div class="processing-indicator">Processing file...</div>
    {/if}
  {/if}

  <!-- Batch Mode Results -->
  {#if isBatchMode && batchResults.length > 0}
    <!-- Stale Results Indicator -->
    {#if resultsStale && onReprocess}
      <div class="stale-indicator">
        <span class="stale-indicator-text">
          ⚠️ Results are from {formatResultsMode(resultsMode)} mode
        </span>
        <button
          class="reprocess-button"
          on:click={onReprocess}
          disabled={isProcessing}
        >
          ⟳ Reprocess Batch with {formatAnalysisMode($analysisMode)}
        </button>
      </div>
    {/if}

    <!-- Batch Summary and Results -->
    <div class:stale-results-overlay={resultsStale}>
      <div class="batch-summary">
        <div class="batch-header">
          <div class="header-top">
            <h2>Batch Analysis Results</h2>
            <div class="header-actions">
              <button
                class="export-button"
                on:click={handleExport}
                disabled={isExporting || filteredResults.length === 0 || isProcessing}
                title="Export results to CSV file"
              >
                {#if isExporting}
                  <span class="loading-spinner"></span>
                  Exporting...
                {:else}
                  📊 Export CSV
                {/if}
              </button>
            </div>
          </div>
          {#if folderName}
            <div class="folder-name">
              <span class="folder-icon">📁</span>
              {#if folderUrl}
                <a href={folderUrl} target="_blank" rel="noopener noreferrer" class="folder-link">{folderName}</a>
              {:else}
                <span>{folderName}</span>
              {/if}
            </div>
          {/if}
          {#if exportError}
            <div class="export-error">
              ❌ Failed to export: {exportError}
            </div>
          {/if}
          {#if exportSuccess}
            <div class="export-success">
              ✓ CSV file downloaded successfully
            </div>
          {/if}
        </div>
        <div class="summary-content">
          <div class="summary-stats">
            <div
              class="stat pass"
              class:active={$resultsFilter === 'pass'}
              on:click={() => handleFilterClick('pass')}
              on:keydown={(e) => e.key === 'Enter' && handleFilterClick('pass')}
              role="button"
              tabindex="0"
              aria-pressed={$resultsFilter === 'pass'}
              aria-label="Filter results to show only passed files ({passCount} files)"
            >
              <div class="stat-value">{passCount}</div>
              <div class="stat-label">Pass</div>
            </div>
            <div
              class="stat warning"
              class:active={$resultsFilter === 'warning'}
              on:click={() => handleFilterClick('warning')}
              on:keydown={(e) => e.key === 'Enter' && handleFilterClick('warning')}
              role="button"
              tabindex="0"
              aria-pressed={$resultsFilter === 'warning'}
              aria-label="Filter results to show only warnings ({warningCount} files)"
            >
              <div class="stat-value">{warningCount}</div>
              <div class="stat-label">Warnings</div>
            </div>
            <div
              class="stat fail"
              class:active={$resultsFilter === 'fail'}
              on:click={() => handleFilterClick('fail')}
              on:keydown={(e) => e.key === 'Enter' && handleFilterClick('fail')}
              role="button"
              tabindex="0"
              aria-pressed={$resultsFilter === 'fail'}
              aria-label="Filter results to show only failed files ({failCount} files)"
            >
              <div class="stat-value">{failCount}</div>
              <div class="stat-label">Failed</div>
            </div>
            <div
              class="stat error"
              class:active={$resultsFilter === 'error'}
              on:click={() => handleFilterClick('error')}
              on:keydown={(e) => e.key === 'Enter' && handleFilterClick('error')}
              role="button"
              tabindex="0"
              aria-pressed={$resultsFilter === 'error'}
              aria-label="Filter results to show only errors ({errorCount} files)"
            >
              <div class="stat-value">{errorCount}</div>
              <div class="stat-label">Errors</div>
            </div>
          </div>
          {#if totalDuration}
            <div class="duration-stat">
              <div class="duration-label">Total Duration (Pass + Warning):</div>
              <div class="duration-value">{totalDuration}</div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Empty Filter State -->
      {#if $resultsFilter && filteredResults.length === 0}
        <div class="empty-filter-state">
          <p>No {$resultsFilter === 'fail' ? 'failed' : $resultsFilter} results found.</p>
          <button
            class="clear-filter-inline"
            on:click={() => resultsFilter.set(null)}
          >
            Clear Filter
          </button>
        </div>
      {/if}

      <!-- Batch Results Table -->
      <ResultsTable
        results={filteredResults}
        mode="batch"
        metadataOnly={$analysisMode === 'filename-only'}
        experimentalMode={$analysisMode === 'experimental'}
      />

      <!-- Mode Switcher Hints (only for non-auditions presets and not in simplified mode) -->
      {#if !$currentPresetId?.startsWith('auditions-') && !$isSimplifiedMode}
        {#if $analysisMode === 'experimental'}
          <div class="mode-switcher">
            💡 Want to check just filenames without analyzing audio? Switch to
            <a href="#" on:click|preventDefault={() => setAnalysisMode('filename-only')}>
              Filename-Only
            </a> mode
          </div>
        {:else if $analysisMode === 'audio-only'}
          <div class="mode-switcher">
            💡 Want to check reverb, noise floor, or silence issues? Switch to
            <a href="#" on:click|preventDefault={() => setAnalysisMode('experimental')}>
              Experimental Analysis
            </a> mode
          </div>
        {/if}
      {/if}
    </div>

  <!-- Single File Mode Results -->
  {:else if singleResult}
    <!-- Stale Results Indicator -->
    {#if resultsStale && onReprocess}
      <div class="stale-indicator">
        <span class="stale-indicator-text">
          ⚠️ Results are from {formatResultsMode(resultsMode)} mode
        </span>
        <button
          class="reprocess-button"
          on:click={onReprocess}
          disabled={isProcessing}
        >
          ⟳ Reprocess with {formatAnalysisMode($analysisMode)}
        </button>
      </div>
    {/if}

    <div class:stale-results-overlay={resultsStale}>
      <ResultsTable
        results={[singleResult]}
        mode="single"
        metadataOnly={$analysisMode === 'filename-only'}
        experimentalMode={$analysisMode === 'experimental'}
      />

      <!-- Mode Switcher Hints (only for non-auditions presets and not in simplified mode) -->
      {#if !$currentPresetId?.startsWith('auditions-') && !$isSimplifiedMode}
        {#if $analysisMode === 'experimental'}
          <div class="mode-switcher">
            💡 Want to check just filenames without analyzing audio? Switch to
            <a href="#" on:click|preventDefault={() => setAnalysisMode('filename-only')}>
              Filename-Only
            </a> mode
          </div>
        {:else if $analysisMode === 'audio-only'}
          <div class="mode-switcher">
            💡 Want to check reverb, noise floor, or silence issues? Switch to
            <a href="#" on:click|preventDefault={() => setAnalysisMode('experimental')}>
              Experimental Analysis
            </a> mode
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
