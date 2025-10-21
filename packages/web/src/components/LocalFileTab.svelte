<script lang="ts">
  import { onDestroy } from 'svelte';
  import FileUpload from './FileUpload.svelte';
  import ResultsDisplay from './ResultsDisplay.svelte';
  import { analyzeAudioFile } from '../services/audio-analysis-service';
  import { currentPresetId, availablePresets, currentCriteria, hasValidPresetConfig } from '../stores/settings';
  import { isFileTypeAllowed, getFileRejectionReason, formatRejectedFileType } from '../utils/file-validation-utils';
  import { currentTab } from '../stores/tabs';
  import { analysisMode, setAnalysisMode, type AnalysisMode } from '../stores/analysisMode';
  import { isSimplifiedMode } from '../stores/simplifiedMode';
  import type { AudioResults, ValidationResults } from '../types';
  import { analyticsService } from '../services/analytics-service';
  import { AnalysisCancelledError } from '@audio-analyzer/core';
  import { FilenameValidator } from '../validation/filename-validator';

  let analysisProgress = $state({
    visible: false,
    filename: '',
    message: '',
    progress: 0,
    cancelling: false,
    batchCurrent: 0,
    batchTotal: 0
  });

  function createProgressCallback(filename: string, current: number = 1, total: number = 1) {
    return (message: string, progress: number) => {
      analysisProgress.visible = true;
      analysisProgress.filename = filename;
      analysisProgress.message = message;
      analysisProgress.progress = progress;
      analysisProgress.batchCurrent = current;
      analysisProgress.batchTotal = total;
    };
  }

  function goToSettings() {
    currentTab.setTab('settings');
  }

  let processing = $state(false);
  let error = $state('');
  let results = $state<AudioResults | null>(null);
  let validation = $state<ValidationResults | null>(null);
  let currentAudioUrl = $state<string | null>(null);
  let currentFile = $state<File | null>(null);
  let resultsStale = $state(false);
  let resultsMode = $state<AnalysisMode | null>(null); // The mode used to generate current results

  // Batch processing state
  let batchResults = $state<AudioResults[]>([]);
  let totalFiles = $state(0);
  let processedFiles = $state(0);
  let isBatchMode = $state(false);
  let cancelRequested = $state(false);
  let batchFiles = $state<File[]>([]); // Store files for reprocessing

  // Cleanup blob URLs when component is destroyed
  function cleanup() {
    // Clean up single file audio URL
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    // Clean up batch audio URLs
    batchResults.forEach(result => {
      if (result.audioUrl) {
        URL.revokeObjectURL(result.audioUrl);
      }
    });
  }

  onDestroy(cleanup);

  // Auto-set mode for auditions presets (watch for preset changes)
  $effect(() => {
    if ($currentPresetId?.startsWith('auditions-') && $analysisMode !== 'audio-only') {
      setAnalysisMode('audio-only');
    }
  });

  // Helper functions for smart staleness detection
  // For audio properties, check if they were VALIDATED, not just if raw data exists
  function hasValidatedAudioProperties(result: AudioResults): boolean {
    return result.validation?.sampleRate !== undefined || result.validation?.bitDepth !== undefined;
  }

  function hasFilenameValidation(result: AudioResults): boolean {
    return result.validation?.filename !== undefined;
  }

  function hasExperimentalMetrics(result: AudioResults): boolean {
    return result.peakDb !== undefined || result.reverbInfo !== undefined;
  }

  function areResultsStaleForMode(
    results: AudioResults | AudioResults[],
    newMode: AnalysisMode,
    currentPreset: any
  ): boolean {
    const resultArray = Array.isArray(results) ? results : [results];
    const firstResult = resultArray[0];

    if (!firstResult) return true; // No results = stale

    switch (newMode) {
      case 'audio-only':
        // Need audio properties (check for VALIDATED data, not just raw data)
        return !hasValidatedAudioProperties(firstResult);

      case 'filename-only':
        // Need filename validation (if preset supports it)
        if (currentPreset?.supportsFilenameValidation) {
          return !hasFilenameValidation(firstResult);
        }
        return false; // Preset doesn't support filename validation, so not stale

      case 'full':
        // Need both audio properties and filename validation
        const needsFilename = currentPreset?.supportsFilenameValidation;
        if (!hasValidatedAudioProperties(firstResult)) return true;
        if (needsFilename && !hasFilenameValidation(firstResult)) return true;
        return false;

      case 'experimental':
        // Need experimental metrics
        return !hasExperimentalMetrics(firstResult);

      default:
        return false;
    }
  }

  // Smart staleness detection - only mark stale if new mode needs data we don't have
  $effect(() => {
    if ((results || (isBatchMode && batchResults.length > 0)) && resultsMode !== null) {
      if ($analysisMode === resultsMode) {
        resultsStale = false;
      } else {
        // Smart staleness detection based on what data is present vs needed
        const currentPreset = availablePresets[$currentPresetId];
        const currentResults = isBatchMode ? batchResults : results;
        const isStale = areResultsStaleForMode(currentResults, $analysisMode, currentPreset);

        resultsStale = isStale;
      }
    }
  });

  async function processFile(file: File) {
    // Clean up previous blob URL if exists
    cleanup();

    processing = true;
    error = '';
    results = null;
    validation = null;
    resultsStale = false;
    resultsMode = null;
    currentFile = file;

    try {
      // Validate file type against current preset criteria BEFORE analyzing
      if (!isFileTypeAllowed(file.name, $currentCriteria)) {
        const rejectionReason = getFileRejectionReason(file.name, $currentCriteria);

        // Build validation object
        const validation: any = {
          fileType: {
            status: 'fail',
            value: formatRejectedFileType(file.name),
            issue: rejectionReason
          }
        };

        // Add filename validation if preset supports it and we're in filename-only mode
        const preset = $currentPresetId ? availablePresets[$currentPresetId] : null;
        if (preset?.filenameValidationType && $analysisMode === 'filename-only') {
          if (preset.filenameValidationType === 'bilingual-pattern') {
            const filenameValidation = FilenameValidator.validateBilingual(file.name);
            validation.filename = {
              status: filenameValidation.status,
              value: file.name,
              issue: filenameValidation.issue
            };
          }
          // Note: Three Hour validation requires scriptsList/speakerId which aren't available here
        }

        // Set error and failed result
        error = rejectionReason;
        results = {
          filename: file.name,
          fileType: formatRejectedFileType(file.name),
          fileSize: file.size || 0,
          channels: 0,
          sampleRate: 0,
          bitDepth: 0,
          duration: 0,
          status: 'fail',
          error: rejectionReason,
          validation
        };
        resultsMode = $analysisMode;
        return; // Don't analyze the file
      }

      // Use shared analysis service
      const analysisResults = await analyzeAudioFile(file, {
        analysisMode: $analysisMode,
        preset: $currentPresetId ? availablePresets[$currentPresetId] : null,
        presetId: $currentPresetId,
        criteria: $currentCriteria,
        progressCallback: createProgressCallback(file.name)
      });

      // Create blob URL for audio playback
      currentAudioUrl = URL.createObjectURL(file);
      analysisResults.audioUrl = currentAudioUrl;

      results = analysisResults;
      validation = analysisResults.validation || null;
      resultsMode = $analysisMode;

    } catch (err) {
      console.error('Error in processFile:', err);
      if (err instanceof AnalysisCancelledError) {
        // Cancellation is not an error - just reset UI
        analysisProgress.visible = false;
        analysisProgress.cancelling = false;
        return; // Don't show error message
      }
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      results = null;
    } finally {
      processing = false;
      analysisProgress.visible = false;
      analysisProgress.cancelling = false;

      // Reset file input so same file can be selected again
      const input = document.getElementById('local-file-upload') as HTMLInputElement;
      if (input) {
        input.value = '';
      }
    }
  }

  async function handleFileChange(event: CustomEvent) {
    // Get the original event from the CustomEvent detail
    const originalEvent = event.detail as Event;
    const inputElement = originalEvent.target as HTMLInputElement;
    const files = inputElement?.files;

    if (!files || files.length === 0) return;

    // Convert FileList to array
    const filesArray = Array.from(files);

    if (filesArray.length === 1) {
      // Single file mode
      isBatchMode = false;
      batchResults = [];
      await processFile(filesArray[0]);
    } else {
      // Batch mode
      isBatchMode = true;
      results = null;
      await processBatchFiles(filesArray);
    }
  }

  async function processBatchFiles(files: File[]) {
    const batchStartTime = Date.now();

    processing = true;
    error = '';
    batchResults = [];
    batchFiles = files; // Store for reprocessing
    totalFiles = files.length;
    processedFiles = 0;
    cancelRequested = false;
    resultsStale = false;
    resultsMode = $analysisMode;

    // Track batch start
    analyticsService.track('batch_processing_started', {
      totalFiles: files.length,
      analysisMode: $analysisMode,
      presetId: $currentPresetId,
      source: 'local',
    });

    try {
      // Performance profiling
      let lastFileTime = performance.now();
      const memoryAvailable = 'memory' in performance;

      for (let i = 0; i < files.length; i++) {
        // Check if cancel was requested
        if (cancelRequested) {
          error = 'Processing cancelled by user';
          break;
        }

        const file = files[i];
        processedFiles = i + 1;

        try {
          // Validate file type against current preset criteria
          if (!isFileTypeAllowed(file.name, $currentCriteria)) {
            const rejectionReason = getFileRejectionReason(file.name, $currentCriteria);

            // Build validation object
            const validation: any = {
              fileType: {
                status: 'fail',
                value: formatRejectedFileType(file.name),
                issue: rejectionReason
              }
            };

            // Add filename validation if preset supports it and we're in filename-only mode
            const preset = $currentPresetId ? availablePresets[$currentPresetId] : null;
            if (preset?.filenameValidationType && $analysisMode === 'filename-only') {
              if (preset.filenameValidationType === 'bilingual-pattern') {
                const filenameValidation = FilenameValidator.validateBilingual(file.name);
                validation.filename = {
                  status: filenameValidation.status,
                  value: file.name,
                  issue: filenameValidation.issue
                };
              }
              // Note: Three Hour validation requires scriptsList/speakerId which aren't available here
            }

            // Create failed result and add immediately
            const failedResult: AudioResults = {
              filename: file.name,
              fileType: formatRejectedFileType(file.name),
              fileSize: file.size || 0,
              channels: 0,
              sampleRate: 0,
              bitDepth: 0,
              duration: 0,
              status: 'fail',
              error: rejectionReason,
              validation
            };
            batchResults = [...batchResults, failedResult];
            continue; // Skip to next file
          }

          const fileStartTime = performance.now();

          // Reset progress to 0 for new file
          analysisProgress.progress = 0;
          const progressCallback = createProgressCallback(file.name, i + 1, files.length);
          const result = await processSingleFile(file, true, progressCallback);

          const fileEndTime = performance.now();
          const fileProcessTime = fileEndTime - fileStartTime;
          const gapSinceLastFile = fileStartTime - lastFileTime;

          // Create blob URL immediately for audio playback
          // Store URL instead of File reference to avoid keeping large files in memory
          result.audioUrl = URL.createObjectURL(file);

          // Add result immediately for smooth UI updates
          batchResults = [...batchResults, result];

          // Performance logging
          const memInfo = memoryAvailable ? (performance as any).memory : null;
          const memoryMB = memInfo ? (memInfo.usedJSHeapSize / 1024 / 1024).toFixed(0) : 'N/A';
          // Freeze detection: >2s gap (not our deliberate 1s pauses) OR >2s processing time
          const gapFreeze = gapSinceLastFile > 2000;
          const processFreeze = fileProcessTime > 2000;
          const freezeMarker = gapFreeze || processFreeze ? '🔴 FREEZE!' : '';

          console.log(
            `[Batch Profile] File ${i + 1}/${files.length} | ` +
            `Process: ${fileProcessTime.toFixed(0)}ms${processFreeze ? ' 🔴' : ''} | ` +
            `Gap: ${gapSinceLastFile.toFixed(0)}ms${gapFreeze ? ' 🔴' : ''} | ` +
            `Memory: ${memoryMB}MB | ` +
            `${file.name}`
          );

          lastFileTime = performance.now();

          // Small delay to yield to event loop for UI updates and allow minor GC
          // Note: Occasional 5s GC pauses may occur during large batches (browser limitation)
          // Trade-off: Accept rare freezes vs destroying 60% performance gain with chunking
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (err) {
          // If cancelled, don't add incomplete result - just break
          if (err instanceof AnalysisCancelledError) {
            cancelRequested = true;
            break;
          }

          // Add error result immediately
          batchResults = [...batchResults, {
            filename: file.name,
            fileSize: file.size,
            fileType: 'unknown',
            channels: 0,
            sampleRate: 0,
            bitDepth: 0,
            duration: 0,
            status: 'error' as any,
            validation: {
              fileType: {
                status: 'fail',
                value: 'Error',
                issue: err instanceof Error ? err.message : 'Unknown error'
              }
            }
          }];
        }
      }
    } finally {
      // Track batch completion
      const batchTime = Date.now() - batchStartTime;
      const passCount = batchResults.filter(r => r.status === 'pass').length;
      const warnCount = batchResults.filter(r => r.status === 'warning').length;
      const failCount = batchResults.filter(r => r.status === 'fail').length;
      const errorCount = batchResults.filter(r => r.status === 'error').length;
      const totalDuration = batchResults.reduce((sum, r) => sum + (r.duration || 0), 0);

      analyticsService.track('batch_processing_completed', {
        totalFiles: files.length,
        processedFiles: batchResults.length,
        passCount,
        warnCount,
        failCount,
        errorCount,
        batchProcessingTime: batchTime,
        totalAudioDuration: totalDuration,
        wasCancelled: cancelRequested,
        source: 'local',
      });

      processing = false;
      cancelRequested = false;
      analysisProgress.visible = false;
      analysisProgress.cancelling = false;

      // Reset file input so same files can be selected again
      const input = document.getElementById('local-file-upload') as HTMLInputElement;
      if (input) {
        input.value = '';
      }
    }
  }

  async function processSingleFile(
    file: File,
    isBatchMode: boolean = false,
    progressCallback?: (message: string, progress: number) => void
  ): Promise<AudioResults> {
    // Validate file type against current preset criteria
    if (!isFileTypeAllowed(file.name, $currentCriteria)) {
      const rejectionReason = getFileRejectionReason(file.name, $currentCriteria);

      // Build validation object
      const validation: any = {
        fileType: {
          status: 'fail',
          value: formatRejectedFileType(file.name),
          issue: rejectionReason
        }
      };

      // Add filename validation if preset supports it and we're in filename-only mode
      const preset = $currentPresetId ? availablePresets[$currentPresetId] : null;
      if (preset?.filenameValidationType && $analysisMode === 'filename-only') {
        if (preset.filenameValidationType === 'bilingual-pattern') {
          const filenameValidation = FilenameValidator.validateBilingual(file.name);
          validation.filename = {
            status: filenameValidation.status,
            value: file.name,
            issue: filenameValidation.issue
          };
        }
        // Note: Three Hour validation requires scriptsList/speakerId which aren't available here
      }

      // Return failed result without analyzing
      return {
        filename: file.name,
        fileType: formatRejectedFileType(file.name),
        fileSize: file.size || 0,
        channels: 0,
        sampleRate: 0,
        bitDepth: 0,
        duration: 0,
        status: 'fail',
        error: rejectionReason,
        validation
      };
    }

    // Use shared analysis service
    return await analyzeAudioFile(file, {
      analysisMode: $analysisMode,
      preset: $currentPresetId ? availablePresets[$currentPresetId] : null,
      presetId: $currentPresetId,
      criteria: $currentCriteria,
      skipIndividualTracking: isBatchMode, // Skip per-file events during batch to save Umami quota
      progressCallback
    });
  }

  async function handleReprocess() {
    // Track reprocess action
    analyticsService.track('reprocess_requested', {
      previousMode: resultsMode,
      newMode: $analysisMode,
      source: 'local',
      isBatch: isBatchMode,
      fileCount: isBatchMode ? batchFiles.length : 1,
    });

    if (isBatchMode && batchFiles.length > 0) {
      await processBatchFiles(batchFiles);
    } else if (currentFile) {
      await processFile(currentFile);
    }
  }

  import { cancelCurrentAnalysis } from '../services/audio-analysis-service';

  function handleCancel() {
    if (isBatchMode) {
      const cancelPercentage = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

      // Track batch cancellation
      analyticsService.track('batch_processing_cancelled', {
        source: 'local',
        processedFiles,
        totalFiles,
        cancelledAt: cancelPercentage,
      });

      cancelRequested = true; // For batch loop
    }
    
    analysisProgress.cancelling = true;
    analysisProgress.message = 'Cancelling...';
    cancelCurrentAnalysis(); // For level-analyzer
  }
</script>

<style>
  .local-file-tab {
    padding: 1.5rem 0;
  }

  .current-preset {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.1) 100%);
    border: 1px solid rgba(37, 99, 235, 0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .preset-label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preset-name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--primary, #2563eb);
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .preset-name:hover {
    text-decoration: underline;
  }

  .preset-name.locked {
    cursor: default;
    color: var(--text-primary, #333333);
  }

  .preset-name.locked:hover {
    text-decoration: none;
  }

  .current-preset a {
    margin-left: auto;
    padding: 0.5rem 1rem;
    background: var(--primary, #2563eb);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .current-preset a:hover {
    background: var(--primary-dark, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  }

  .no-preset-warning {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.15) 100%);
    border: 1px solid rgba(255, 152, 0, 0.3);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .no-preset-warning span {
    color: #000;
    font-weight: 500;
  }

  .no-preset-warning a {
    margin-left: auto;
    padding: 0.5rem 1rem;
    background: var(--warning, #ff9800);
    color: #000;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .no-preset-warning a:hover {
    background: #f57c00;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
  }

  .analysis-mode-section {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: var(--bg-secondary, #ffffff);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .analysis-mode-section h3 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #333333);
  }

  .radio-group {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border: 2px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
    min-width: 0;
  }

  .radio-label:hover {
    border-color: var(--primary, #2563eb);
    background: rgba(37, 99, 235, 0.02);
  }

  .radio-label input[type="radio"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .radio-label input[type="radio"]:checked + .radio-content {
    color: var(--primary, #2563eb);
  }

  .radio-label:has(input[type="radio"]:checked) {
    border-color: var(--primary, #2563eb);
    background: rgba(37, 99, 235, 0.05);
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  .radio-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #333333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .radio-description {
    font-size: 0.75rem;
    color: var(--text-secondary, #666666);
    line-height: 1.2;
  }

    .three-hour-note {

      margin-top: 1rem;

      padding: 0.75rem;

      background: rgba(59, 130, 246, 0.1);

      border-left: 3px solid var(--primary, #2563eb);

      border-radius: 4px;

      font-size: 0.875rem;

      color: var(--text-primary, #333333);

    }

  

  .analysis-progress {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: var(--bg-secondary, #ffffff);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .batch-counter {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--primary, #2563eb);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--bg-tertiary, #e0e0e0);
  }

  .progress-filename {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #333333);
    margin-bottom: 0.5rem;
  }

  .progress-message {
    font-size: 0.8125rem;
    color: var(--text-secondary, #666666);
    margin-bottom: 0.75rem;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary, #e0e0e0);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color, #2563eb);
    transition: width 0.3s ease;
  }

  .cancel-button {
    padding: 0.5rem 1rem;
    background: var(--error-color, #dc3545);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .cancel-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  </style>

<div class="local-file-tab">
  {#if !$hasValidPresetConfig}
    <div class="no-preset-warning">
      <span>Please select a Preset or configure Custom criteria to analyze files.</span>
      <a href="#" on:click|preventDefault={goToSettings}>Select Preset</a>
    </div>
  {:else if $currentPresetId}
    <div class="current-preset">
      <span class="preset-label">Current Preset:</span>
      {#if $isSimplifiedMode}
        <span class="preset-name locked">🔒 {availablePresets[$currentPresetId]?.name || $currentPresetId}</span>
      {:else}
        <span class="preset-name" on:click={goToSettings}>{availablePresets[$currentPresetId]?.name || $currentPresetId}</span>
        <a href="#" on:click|preventDefault={goToSettings}>Change</a>
      {/if}
    </div>
  {/if}

  <FileUpload
    id="local-file-upload"
    processing={processing}
    accept="audio/*"
    multiple={true}
    disabled={!$hasValidPresetConfig}
    on:change={handleFileChange}
  />

  <!-- Analysis Mode Selection (only show for non-auditions presets and not in simplified mode) -->
  {#if !$currentPresetId?.startsWith('auditions-') && !$isSimplifiedMode}
    <div class="analysis-mode-section">
      <h3>Analysis Mode:</h3>
      <div class="radio-group">

        {#if availablePresets[$currentPresetId]?.supportsFilenameValidation && availablePresets[$currentPresetId]?.filenameValidationType !== 'script-match'}
          <!-- Filename validation presets (non-Three Hour): Show all 4 options (Audio Only, Filename Only, Full, Experimental) -->
          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode"
              value="audio-only"
              checked={$analysisMode === 'audio-only'}
              on:change={() => setAnalysisMode('audio-only')}
              disabled={processing}
            />
            <div class="radio-content">
              <span class="radio-title">Audio Only</span>
              <span class="radio-description">Basic properties only</span>
            </div>
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode"
              value="filename-only"
              checked={$analysisMode === 'filename-only'}
              on:change={() => setAnalysisMode('filename-only')}
              disabled={processing}
            />
            <div class="radio-content">
              <span class="radio-title">Filename Only</span>
              <span class="radio-description">Fastest - metadata only</span>
            </div>
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode"
              value="full"
              checked={$analysisMode === 'full'}
              on:change={() => setAnalysisMode('full')}
              disabled={processing}
            />
            <div class="radio-content">
              <span class="radio-title">Full Analysis</span>
              <span class="radio-description">Basic properties + filename validation</span>
            </div>
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode"
              value="experimental"
              checked={$analysisMode === 'experimental'}
              on:change={() => setAnalysisMode('experimental')}
              disabled={processing}
            />
            <div class="radio-content">
              <span class="radio-title">Experimental Analysis</span>
              <span class="radio-description">Peak level, noise floor, reverb, silence, conversational audio analysis</span>
            </div>
          </label>

        {:else}
          <!-- Non-filename presets OR Three Hour preset: Show 2 options (Audio Analysis, Experimental) -->
          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode"
              value="audio-only"
              checked={$analysisMode === 'audio-only'}
              on:change={() => setAnalysisMode('audio-only')}
              disabled={processing}
            />
            <div class="radio-content">
              <span class="radio-title">Audio Analysis</span>
              <span class="radio-description">Basic properties (sample rate, bit depth, duration)</span>
            </div>
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode"
              value="experimental"
              checked={$analysisMode === 'experimental'}
              on:change={() => setAnalysisMode('experimental')}
              disabled={processing}
            />
            <div class="radio-content">
              <span class="radio-title">Experimental Analysis</span>
              <span class="radio-description">Peak level, noise floor, reverb, silence, conversational audio analysis</span>
            </div>
          </label>
        {/if}

      </div>

      {#if availablePresets[$currentPresetId]?.filenameValidationType === 'script-match'}
        <div class="three-hour-note">
          ℹ️ <strong>Note:</strong> Three Hour filename validation requires Google Drive. Use the Google Drive tab for filename validation, or select Audio Analysis/Experimental here.
        </div>
      {/if}
    </div>
  {/if}

  <!-- Unified Progress Bar -->
  {#if analysisProgress.visible}
    <div class="analysis-progress">
      {#if analysisProgress.batchTotal > 1}
        <!-- Batch mode: Show file count and current file progress -->
        <div class="batch-counter">
          Processing file {analysisProgress.batchCurrent} of {analysisProgress.batchTotal}
        </div>
        <div class="progress-filename">{analysisProgress.filename}</div>
        <div class="progress-message">{analysisProgress.message} ({Math.round(analysisProgress.progress * 100)}%)</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {analysisProgress.progress * 100}%"></div>
        </div>
      {:else}
        <!-- Single file mode: Show only file progress -->
        <div class="progress-filename">{analysisProgress.filename}</div>
        <div class="progress-message">{analysisProgress.message} ({Math.round(analysisProgress.progress * 100)}%)</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {analysisProgress.progress * 100}%"></div>
        </div>
      {/if}
      <button class="cancel-button" on:click={handleCancel} disabled={analysisProgress.cancelling}>
        {analysisProgress.cancelling ? 'Cancelling...' : 'Cancel Analysis'}
      </button>
    </div>
  {/if}

  <!-- Results Display Component -->
  <ResultsDisplay
    results={isBatchMode ? batchResults : results}
    isProcessing={processing}
    error={error}
    {resultsMode}
    {resultsStale}
    {processedFiles}
    {totalFiles}
    onReprocess={handleReprocess}
    onCancel={handleCancel}
    {cancelRequested}
    showBuiltInProgress={false}
  />
</div>
