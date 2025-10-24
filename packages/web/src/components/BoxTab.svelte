<script lang="ts">
  import { authState, authService } from '../stores/auth';
  import { AppBridge } from '../bridge/app-bridge';
  import ResultsDisplay from './ResultsDisplay.svelte';
  import { analyzeAudioFile } from '../services/audio-analysis-service';
  import { currentCriteria, currentPresetId, availablePresets, hasValidPresetConfig } from '../stores/settings';
  import { isFileTypeAllowed, getFileRejectionReason, formatRejectedFileType } from '../utils/file-validation-utils';
  import { currentTab } from '../stores/tabs';
  import { analysisMode, setAnalysisMode, type AnalysisMode } from '../stores/analysisMode';
  import { BoxAPI } from '../services/box-api';
  import type { AudioResults, ValidationResults } from '../types';
  import { analyticsService } from '../services/analytics-service';
  import { AnalysisCancelledError } from '@audio-analyzer/core';
  import { cancelCurrentAnalysis } from '../services/audio-analysis-service';
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

  function createProgressCallback(filename: string, getCurrentCount: () => number, total: number = 1) {
    return (message: string, progress: number) => {
      // For batch processing, only update UI if this is the currently displayed file
      // or if no file is currently displayed (first file to report)
      if (total > 1) {
        if (currentDisplayedFile === null) {
          currentDisplayedFile = filename;
        } else if (currentDisplayedFile !== filename) {
          return; // Ignore progress from other files
        }
      }

      analysisProgress.visible = true;
      analysisProgress.filename = filename;
      analysisProgress.message = message;
      analysisProgress.progress = progress;
      analysisProgress.batchCurrent = getCurrentCount();
      analysisProgress.batchTotal = total;
    };
  }

  const bridge = AppBridge.getInstance();
  let boxAPI: BoxAPI | null = null;

  // Detect if we're in the middle of OAuth callback processing
  // Only show processing state if: (1) OAuth params exist AND (2) not yet authenticated
  let isProcessingCallback = $derived.by(() => {
    if (typeof window === 'undefined') return false;
    if ($authState.box.isAuthenticated) return false; // Already authenticated, don't show processing

    const params = new URLSearchParams(window.location.search);
    return params.has('code') && params.has('state');
  });

  function goToSettings() {
    currentTab.setTab('settings');
  }

  function handleSignIn() {
    bridge.dispatch({ type: 'auth:box:signin:requested' });
    analyticsService.track('box_signin_requested');
  }

  function handleSignOut() {
    bridge.dispatch({ type: 'auth:box:signout:requested' });
    analyticsService.track('box_signout');
  }

  // Initialize Box API when authenticated
  $effect(() => {
    if ($authState.box.isAuthenticated && !boxAPI) {
      const boxAuth = authService.getBoxAuthInstance();
      boxAPI = new BoxAPI(boxAuth);
      analyticsService.track('box_signin_success', {
        user: $authState.box.userInfo?.login || $authState.box.userInfo?.name
      });
    }
  });

  // Track authentication errors
  $effect(() => {
    if ($authState.box.error) {
      analyticsService.track('box_auth_error', {
        error: $authState.box.error
      });
    }
  });

  let processing = $state(false);
  let error = $state('');
  let results = $state<AudioResults | null>(null);
  let validation = $state<ValidationResults | null>(null);
  let currentAudioUrl = $state<string | null>(null);
  let currentFile = $state<File | null>(null);
  let resultsStale = $state(false);
  let resultsMode = $state<AnalysisMode | null>(null);
  let fileUrl = $state('');
  let originalFileUrl = $state<string | null>(null); // Store URL for re-downloading

  // Batch processing state
  let batchProcessing = $state(false);
  let batchResults = $state<AudioResults[]>([]);
  let totalFiles = $state(0);
  let processedFiles = $state(0);
  let batchCancelled = $state(false);
  let batchBoxFiles = $state<any[]>([]); // Store for batch reprocessing
  let batchFolderName = $state(''); // Name of folder being processed
  let batchFolderUrl = $state(''); // URL of folder being processed
  let currentDisplayedFile = $state<string | null>(null); // Track which file is currently shown in progress bar

  // Track previous state for auto-cancel logic
  let previousAnalysisMode = $state<AnalysisMode | null>(null);

  // Cleanup blob URL when component is destroyed
  function cleanup() {
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
  }

  // Cleanup on component destroy
  $effect(() => {
    return cleanup;
  });

  // Staleness detection - require reprocessing on ANY mode change
  $effect(() => {
    if ((results || batchResults.length > 0) && resultsMode !== null) {
      // Always mark as stale if mode changed - require full reprocessing for proper status updates
      resultsStale = $analysisMode !== resultsMode;
    }
  });

  // Auto-cancel analysis when analysis mode changes during processing
  $effect(() => {
    const currentMode = $analysisMode;
    if ((processing || batchProcessing) && previousAnalysisMode !== null && previousAnalysisMode !== currentMode) {
      // Mode changed while processing - auto-cancel
      analysisProgress.cancelling = true;
      analysisProgress.message = 'Cancelled - analysis mode changed';
      cancelCurrentAnalysis();
      batchCancelled = true; // For batch loop
    }
    previousAnalysisMode = currentMode;
  });

  // Auto-cancel analysis when switching away from this tab
  $effect(() => {
    // Explicitly depend on tab changes and processing state
    $currentTab; // Add dependency tracking
    processing;
    batchProcessing;

    if ((processing || batchProcessing) && $currentTab !== 'box') {
      // Switched away from Box tab while processing - auto-cancel
      // CRITICAL: Set cancellation flags immediately, before any async operations
      batchCancelled = true; // For batch loop - stops file queueing immediately
      analysisProgress.cancelling = true;
      analysisProgress.message = 'Cancelled - switched tabs';
      cancelCurrentAnalysis(); // Stop current audio analysis
    }
  });

  /**
   * Analyze a file using the shared analysis service
   */
  async function analyzeFile(
    file: File,
    isBatchMode: boolean = false,
    progressCallback?: (message: string, progress: number) => void
  ): Promise<AudioResults> {
    return await analyzeAudioFile(file, {
      analysisMode: $analysisMode,
      preset: $currentPresetId ? availablePresets[$currentPresetId] : null,
      presetId: $currentPresetId,
      criteria: $currentCriteria,
      skipIndividualTracking: isBatchMode, // Skip per-file events during batch to save Umami quota
      progressCallback
    });
  }

  /**
   * Process a single file (with UI side effects)
   * @param file - The file to process
   */
  async function processSingleFile(file: File) {
    cleanup();

    processing = true;
    error = '';
    results = null;
    validation = null;
    batchResults = []; // Clear batch results when processing single file
    resultsStale = false;
    resultsMode = null;
    currentFile = file;
    analysisProgress.visible = false;
    analysisProgress.cancelling = false;

    // Initialize tracking for auto-cancel logic
    previousAnalysisMode = $analysisMode;

    try {
      // Validate file type against current preset criteria BEFORE analyzing
      if (!isFileTypeAllowed(file.name, $currentCriteria)) {
        const rejectionReason = getFileRejectionReason(file.name, $currentCriteria);
        // Set error and failed result
        error = rejectionReason;

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
          validation,
          externalUrl: originalFileUrl || undefined
        };
        resultsMode = $analysisMode;
        return; // Don't analyze the file
      }

      // Analyze file (pure function)
      const progressCallback = createProgressCallback(file.name, () => 1, 1);
      const analysisResults = await analyzeFile(file, false, progressCallback);

      // Create blob URL for audio playback (skip for empty files)
      // Only create blob for full files, not partial downloads
      if (file.size > 0 && !(file as any).actualSize) {
        currentAudioUrl = URL.createObjectURL(file);
        analysisResults.audioUrl = currentAudioUrl;
      }

      // Add external URL for Box files (allows viewing in Box)
      if (originalFileUrl) {
        analysisResults.externalUrl = originalFileUrl;
      }

      results = analysisResults;
      validation = analysisResults.validation || null;
      resultsMode = $analysisMode;

    } catch (err) {
      if (err instanceof AnalysisCancelledError) {
        analysisProgress.visible = false;
        analysisProgress.cancelling = false;
        return;
      }
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      results = null;
    } finally {
      processing = false;
      analysisProgress.visible = false;
      analysisProgress.cancelling = false;
    }
  }

  async function handleUrlSubmit() {
    if (!fileUrl.trim()) return;
    if (!boxAPI) {
      error = 'Box API not initialized. Please sign in again.';
      return;
    }

    processing = true;
    error = '';
    results = null;
    batchResults = []; // Clear previous batch results

    try {
      // Parse the URL to determine if it's a file or folder
      const parsed = boxAPI.parseUrl(fileUrl);

      if (parsed.type === 'folder') {
        // Folder URL - list audio files and batch process
        // First, fetch folder metadata to get the folder name
        const folderMetadata = await boxAPI.getFolderMetadata(parsed.id, parsed.sharedLink);
        batchFolderName = folderMetadata.name;
        batchFolderUrl = `https://app.box.com/folder/${parsed.id}`;

        const filesToProcess = await boxAPI.listAudioFilesInFolder(parsed.id, parsed.sharedLink);

        if (filesToProcess.length === 0) {
          error = 'No audio files found in the folder';
          processing = false;
          return;
        }

        // Multiple files: use batch processing
        processing = false;
        await processBatchFiles(filesToProcess);
      } else {
        // File URL - single file processing
        originalFileUrl = fileUrl;

        // Get metadata first to check filename
        const metadata = await boxAPI.getFileMetadataFromUrl(fileUrl);

        // Validate file type BEFORE downloading
        if (!isFileTypeAllowed(metadata.name, $currentCriteria)) {
          const rejectionReason = getFileRejectionReason(metadata.name, $currentCriteria);
          // Set error and failed result WITHOUT downloading
          error = rejectionReason;

          // Build validation object
          const validation: any = {
            fileType: {
              status: 'fail',
              value: formatRejectedFileType(metadata.name),
              issue: rejectionReason
            }
          };

          // Add filename validation if preset supports it and we're in filename-only mode
          const preset = $currentPresetId ? availablePresets[$currentPresetId] : null;
          if (preset?.filenameValidationType && $analysisMode === 'filename-only') {
            if (preset.filenameValidationType === 'bilingual-pattern') {
              const filenameValidation = FilenameValidator.validateBilingual(metadata.name);
              validation.filename = {
                status: filenameValidation.status,
                value: metadata.name,
                issue: filenameValidation.issue
              };
            }
            // Note: Three Hour validation requires scriptsList/speakerId which aren't available here
          }

          results = {
            filename: metadata.name,
            fileType: formatRejectedFileType(metadata.name),
            fileSize: metadata.size || 0,
            channels: 0,
            sampleRate: 0,
            bitDepth: 0,
            duration: 0,
            status: 'fail',
            error: rejectionReason,
            validation,
            externalUrl: originalFileUrl
          };
          resultsMode = $analysisMode;
          processing = false;
          return; // Don't download the file
        }

        if ($analysisMode === 'filename-only') {
          // Filename-only mode: Just fetch metadata, don't download file
          // Create a minimal File object for filename validation
          const file = new File([], metadata.name, { type: 'application/octet-stream' });
          await processSingleFile(file);
        } else {
          // Full or audio-only mode: Download the actual file
          const file = await boxAPI.downloadFileFromUrl(fileUrl, {
            mode: $analysisMode,
            filename: metadata.name
          });
          await processSingleFile(file);
        }
        processing = false;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process Box URL';
      results = null;
      processing = false;
    }
  }

  /**
   * Process multiple files in batch with parallel processing
   * @param boxFiles - Array of Box file metadata to process
   */
  async function processBatchFiles(boxFiles: any[]) {
    const batchStartTime = Date.now();

    batchProcessing = true;
    totalFiles = boxFiles.length;
    processedFiles = 0;
    batchResults = [];
    batchCancelled = false;
    batchBoxFiles = boxFiles; // Store for reprocessing
    error = '';
    resultsMode = $analysisMode;
    currentDisplayedFile = null; // Reset the currently displayed file

    // Initialize tracking for auto-cancel logic
    previousAnalysisMode = $analysisMode;

    // Show progress bar immediately
    analysisProgress.visible = true;
    analysisProgress.filename = 'Preparing batch...';
    analysisProgress.message = 'Starting analysis';
    analysisProgress.progress = 0;
    analysisProgress.batchCurrent = 0;
    analysisProgress.batchTotal = boxFiles.length;

    // Track batch start
    analyticsService.track('batch_processing_started', {
      totalFiles: boxFiles.length,
      analysisMode: $analysisMode,
      presetId: $currentPresetId,
      source: 'box',
    });

    const concurrency = 3; // Process 3 files at once
    let index = 0;
    const inProgress: Map<number, Promise<void>> = new Map();

    try {
      while (index < boxFiles.length || inProgress.size > 0) {

        // Check if cancelled
        if (batchCancelled) {
          // Wait for in-progress downloads to complete
          await Promise.allSettled(Array.from(inProgress.values()));
          break;
        }

        // Start new downloads up to concurrency limit
        while (inProgress.size < concurrency && index < boxFiles.length) {
          // Check if cancelled before queueing new downloads
          if (batchCancelled) {
            break;
          }

          const boxFile = boxFiles[index];
          const taskId = index;
          index++;

          // CRITICAL: Add placeholder to Map FIRST to prevent race condition
          // where async function completes and tries to delete before being added
          const promise = Promise.resolve().then(async () => {
            try {
              // Validate file type against current preset criteria
              if (!isFileTypeAllowed(boxFile.name, $currentCriteria)) {
                const rejectionReason = getFileRejectionReason(boxFile.name, $currentCriteria);

                // Build validation object
                const validation: any = {
                  fileType: {
                    status: 'fail',
                    value: formatRejectedFileType(boxFile.name),
                    issue: rejectionReason
                  }
                };

                // Add filename validation if preset supports it and we're in filename-only mode
                const preset = $currentPresetId ? availablePresets[$currentPresetId] : null;
                if (preset?.filenameValidationType && $analysisMode === 'filename-only') {
                  if (preset.filenameValidationType === 'bilingual-pattern') {
                    const filenameValidation = FilenameValidator.validateBilingual(boxFile.name);
                    validation.filename = {
                      status: filenameValidation.status,
                      value: boxFile.name,
                      issue: filenameValidation.issue
                    };
                  }
                  // Note: Three Hour validation requires scriptsList/speakerId which aren't available here
                }

                // Create failed result
                const failedResult: AudioResults = {
                  filename: boxFile.name,
                  fileType: formatRejectedFileType(boxFile.name),
                  fileSize: boxFile.size || 0,
                  channels: 0,
                  sampleRate: 0,
                  bitDepth: 0,
                  duration: 0,
                  status: 'fail',
                  error: rejectionReason,
                  validation
                };
                batchResults = [...batchResults, failedResult];
                processedFiles = batchResults.length;
                return;
              }

              // Check if cancelled before downloading
              if (batchCancelled) {
                return;
              }

              // Check if filename-only mode - don't download the actual file
              let file: File;
              if ($analysisMode === 'filename-only') {
                // Filename-only mode: Create minimal File object with metadata only
                file = new File([], boxFile.name, { type: 'application/octet-stream' });
              } else {
                // Download file from Box for audio analysis
                // Pass mode and filename for optimization (WAV files use partial download)
                file = await boxAPI!.downloadFile(boxFile.id, undefined, {
                  mode: $analysisMode,
                  filename: boxFile.name
                });
              }

              // Analyze file (pure function) - pass true for batch mode
              // Use dynamic count function to avoid race condition
              const progressCallback = createProgressCallback(boxFile.name, () => processedFiles + 1, boxFiles.length);
              const result = await analyzeFile(file, true, progressCallback);

              // Add external URL for Box files
              result.externalUrl = `https://app.box.com/file/${boxFile.id}`;

              // Add to results immediately for smooth UI updates
              batchResults = [...batchResults, result];
              processedFiles = batchResults.length;

              // If this was the currently displayed file, clear it so next file can be shown
              if (currentDisplayedFile === boxFile.name) {
                currentDisplayedFile = null;
              }
            } catch (err) {
              if (err instanceof AnalysisCancelledError) {
                batchCancelled = true;
                // No need to add to results, just stop this worker
                return;
              }
              // Log error for debugging
              console.error(`Error processing ${boxFile.name}:`, err);

              // Add error result
              const errorResult: AudioResults = {
                filename: boxFile.name,
                fileSize: boxFile.size || 0,
                fileType: 'unknown',
                channels: 0,
                sampleRate: 0,
                bitDepth: 0,
                duration: 0,
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown error'
              };
              batchResults = [...batchResults, errorResult];
              processedFiles = batchResults.length;
            } finally {
              // Remove this task from inProgress when complete
              inProgress.delete(taskId);
            }
          });

          inProgress.set(taskId, promise);
        }

        // Wait for at least one to complete
        if (inProgress.size > 0) {
          await Promise.race(Array.from(inProgress.values()));
        }
      }

    } catch (err) {
      if (!batchCancelled) {
        error = err instanceof Error ? err.message : 'Batch processing failed';
      }
    } finally {
      const batchTime = Date.now() - batchStartTime;
      const passCount = batchResults.filter(r => r.status === 'pass').length;
      const warnCount = batchResults.filter(r => r.status === 'warning').length;
      const failCount = batchResults.filter(r => r.status === 'fail').length;
      const errorCount = batchResults.filter(r => r.status === 'error').length;
      const totalDuration = batchResults.reduce((sum, r) => sum + (r.duration || 0), 0);

      // Track batch completion
      analyticsService.track('batch_processing_completed', {
        totalFiles: boxFiles.length,
        processedFiles: batchResults.length,
        passCount,
        warnCount,
        failCount,
        errorCount,
        batchProcessingTime: batchTime,
        totalAudioDuration: totalDuration,
        wasCancelled: batchCancelled,
        source: 'box',
      });

      batchProcessing = false;
      analysisProgress.visible = false;
      analysisProgress.cancelling = false;
    }
  }

  /**
   * Cancel batch processing
   */
  function handleCancel() {
    const cancelPercentage = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

    // Track batch cancellation
    analyticsService.track('batch_processing_cancelled', {
      source: 'box',
      processedFiles,
      totalFiles,
      cancelledAt: cancelPercentage,
    });

    batchCancelled = true;
    analysisProgress.cancelling = true;
    analysisProgress.message = 'Cancelling...';
    cancelCurrentAnalysis();
  }

  async function handleReprocess() {
    if (!boxAPI) {
      error = 'Box API not initialized. Please sign in again.';
      return;
    }

    // Track reprocess action
    analyticsService.track('reprocess_requested', {
      previousMode: resultsMode,
      newMode: $analysisMode,
      source: 'box',
      isBatch: batchResults.length > 0,
      fileCount: batchResults.length > 0 ? batchBoxFiles.length : 1,
    });

    // Check if this is batch reprocessing
    if (batchResults.length > 0 && batchBoxFiles.length > 0) {
      // Batch reprocessing - re-download and reprocess all files
      await processBatchFiles(batchBoxFiles);
      return;
    }

    // Single file reprocessing
    // Check if we need to re-download (switching from filename-only to audio mode)
    const needsRedownload = resultsMode === 'filename-only' && $analysisMode !== 'filename-only';

    if (needsRedownload && originalFileUrl) {
      processing = true;
      error = '';
      results = null;

      try {
        // Re-download from URL
        const file = await boxAPI.downloadFileFromUrl(originalFileUrl, {
          mode: $analysisMode,
          filename: currentFile?.name || ''
        });
        await processSingleFile(file);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to reprocess file';
        results = null;
      } finally {
        processing = false;
      }
    } else if (currentFile) {
      // Normal reprocessing (just re-validate with different mode)
      await processSingleFile(currentFile);
    }
  }
</script>

<style>
  .box-tab {
    padding: 1.5rem 0;
  }

  .auth-section {
    margin-bottom: 1.5rem;
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, rgba(0, 114, 237, 0.05) 0%, rgba(0, 114, 237, 0.1) 100%);
    border: 1px solid rgba(0, 114, 237, 0.2);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .auth-section.signed-out {
    flex-direction: column;
    align-items: flex-start;
    padding: 1.25rem;
  }

  .auth-section h3 {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .auth-section.signed-out h3 {
    font-size: 1rem;
    text-transform: none;
    letter-spacing: normal;
    margin-bottom: 0.5rem;
    color: var(--text-primary, #333333);
  }

  .auth-section.signed-out p {
    margin: 0 0 0.75rem 0;
    color: var(--text-secondary, #666666);
    font-size: 0.875rem;
  }

  .user-email {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary, #333333);
    flex: 1;
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

  .file-input-section {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: var(--bg-secondary, #ffffff);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .file-input-section h3 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #333333);
  }

  .file-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .url-input-group {
    display: flex;
    gap: 0.75rem;
  }

  .url-input-group input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    border: 2px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .url-input-group input:focus {
    outline: none;
    border-color: var(--primary, #2563eb);
  }

  .analysis-mode-section {
    margin: 1.5rem 0;
    padding: 1.25rem;
    background: var(--bg-secondary, #ffffff);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .analysis-mode-section legend {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #333333);
    padding: 0 0.25rem;
    margin-bottom: 1rem;
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

  button {
    padding: 0.5rem 1rem;
    background: var(--primary, #2563eb);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  button:hover {
    background: var(--primary-dark, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  button.secondary {
    background: var(--bg-tertiary, #e0e0e0);
    color: var(--text-primary, #333333);
  }

  button.secondary:hover {
    background: #d0d0d0;
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

<div class="box-tab">
  {#if $authState.box.isAuthenticated}
    <div class="auth-section">
      <h3>Box:</h3>
      <span class="user-email">✓ {$authState.box.userInfo?.login || $authState.box.userInfo?.name || 'Authenticated'}</span>
      <button class="secondary" on:click={handleSignOut} aria-label="Sign out from Box">Sign Out</button>
    </div>
  {:else if isProcessingCallback}
    <div class="auth-section signed-out">
      <h3>Box Authentication</h3>
      <p>Completing sign-in...</p>
      <div class="processing-indicator">
        <span>🔄 Please wait</span>
      </div>
    </div>
  {:else}
    <div class="auth-section signed-out">
      <h3>Box Authentication</h3>
      <p>Sign in to access your Box files</p>
      <button on:click={handleSignIn} aria-label="Sign in with your Box account">Sign in with Box</button>
    </div>
  {/if}

  {#if $authState.box.isAuthenticated}
    <!-- Preset Display -->
    {#if !$hasValidPresetConfig}
      <div class="no-preset-warning">
        <span>Please select a Preset or configure Custom criteria to analyze files.</span>
        <a href="#" role="button" aria-label="Open settings to select a preset" on:click|preventDefault={goToSettings}>Select Preset</a>
      </div>
    {:else if $currentPresetId}
      <div class="current-preset">
        <span class="preset-label">Current Preset:</span>
        <span class="preset-name" on:click={goToSettings}>{availablePresets[$currentPresetId]?.name || $currentPresetId}</span>
        <a href="#" role="button" aria-label="Open settings to change preset" on:click|preventDefault={goToSettings}>Change</a>
      </div>
    {/if}

    <!-- File Input Section -->
    <div class="file-input-section">
      <h3>Select File:</h3>
      <div class="file-input-wrapper">
        <div class="url-input-group">
          <input
            type="text"
            bind:value={fileUrl}
            placeholder={$hasValidPresetConfig ? "Paste Box shared link URL (e.g., https://app.box.com/s/...)" : "Configure a preset in Settings to analyze files"}
            disabled={processing || !$hasValidPresetConfig}
            on:keydown={(e) => e.key === 'Enter' && !processing && fileUrl.trim() && $hasValidPresetConfig && handleUrlSubmit()}
          />
          <button on:click={handleUrlSubmit} disabled={processing || !fileUrl.trim() || !$hasValidPresetConfig} aria-label="Analyze the pasted Box shared link URL">
            Analyze URL
          </button>
        </div>
      </div>
    </div>

    <!-- Analysis Mode Selection -->
    {#if $currentPresetId && availablePresets[$currentPresetId]?.supportsFilenameValidation && availablePresets[$currentPresetId]?.filenameValidationType !== 'script-match'}
      <!-- Filename validation presets (non-Three Hour): Show all 4 options -->
      <fieldset class="analysis-mode-section">
        <legend>Analysis Mode:</legend>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode-box"
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
              name="analysis-mode-box"
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
              name="analysis-mode-box"
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
              name="analysis-mode-box"
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
        </div>
      </fieldset>
    {:else if availablePresets[$currentPresetId]?.filenameValidationType === 'script-match'}
      <!-- Three Hour preset: Show only Audio Analysis and Experimental -->
      <fieldset class="analysis-mode-section">
        <legend>Analysis Mode:</legend>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode-box"
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
              name="analysis-mode-box"
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
        </div>
        <div class="three-hour-note">
          ℹ️ <strong>Note:</strong> Three Hour filename validation requires Google Drive. Use the Google Drive tab for filename validation, or select Audio Analysis/Experimental here.
        </div>
      </fieldset>
    {/if}

    <!-- Unified Progress Bar -->
    {#if analysisProgress.visible}
      <div class="analysis-progress" role="status" aria-live="polite" aria-label="File analysis progress">
        {#if analysisProgress.batchTotal > 1}
          <!-- Batch mode: Show file count and current file progress -->
          <div class="batch-counter" aria-live="assertive">
            Processing file {analysisProgress.batchCurrent} of {analysisProgress.batchTotal}
          </div>
          <div class="progress-filename" aria-live="polite">{analysisProgress.filename}</div>
          <div class="progress-message">{analysisProgress.message} ({Math.round(analysisProgress.progress * 100)}%)</div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(analysisProgress.progress * 100)}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`${analysisProgress.filename} analysis progress: ${Math.round(analysisProgress.progress * 100)}%`}
          >
            <div class="progress-fill" style="width: {analysisProgress.progress * 100}%"></div>
          </div>
        {:else}
          <!-- Single file mode: Show only file progress -->
          <div class="progress-filename" aria-live="polite">{analysisProgress.filename}</div>
          <div class="progress-message">{analysisProgress.message} ({Math.round(analysisProgress.progress * 100)}%)</div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(analysisProgress.progress * 100)}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`${analysisProgress.filename} analysis progress: ${Math.round(analysisProgress.progress * 100)}%`}
          >
            <div class="progress-fill" style="width: {analysisProgress.progress * 100}%"></div>
          </div>
        {/if}
        <button class="cancel-button" on:click={handleCancel} disabled={analysisProgress.cancelling} aria-label="Cancel file analysis">
          {analysisProgress.cancelling ? 'Cancelling...' : 'Cancel Analysis'}
        </button>
      </div>
    {/if}

    <ResultsDisplay
      results={batchResults.length > 0 ? batchResults : results}
      isProcessing={processing || batchProcessing}
      {error}
      {resultsMode}
      {resultsStale}
      {processedFiles}
      {totalFiles}
      onReprocess={handleReprocess}
      onCancel={handleCancel}
      cancelRequested={batchCancelled}
      folderName={batchResults.length > 0 ? batchFolderName : null}
      folderUrl={batchResults.length > 0 ? batchFolderUrl : null}
      showBuiltInProgress={false}
    />
  {/if}
</div>
