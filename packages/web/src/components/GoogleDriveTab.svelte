<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { authState, authService } from '../stores/auth';
  import { AppBridge } from '../bridge/app-bridge';
  import ResultsDisplay from './ResultsDisplay.svelte';
  import { analyzeAudioFile } from '../services/audio-analysis-service';
  import { currentPresetId, availablePresets, currentCriteria, hasValidPresetConfig } from '../stores/settings';
  import { isFileTypeAllowed, getFileRejectionReason, formatRejectedFileType } from '../utils/file-validation-utils';
  import { currentTab } from '../stores/tabs';
  import { analysisMode, setAnalysisMode, type AnalysisMode } from '../stores/analysisMode';
  import { GoogleDriveAPI, type DriveFileMetadata } from '../services/google-drive-api';
  import { threeHourSettings } from '../stores/threeHourSettings';
  import type { AudioResults, ValidationResults } from '../types';
  import { analyticsService } from '../services/analytics-service';
  import { AnalysisCancelledError } from '@audio-analyzer/core';
  import { cancelCurrentAnalysis } from '../services/audio-analysis-service';

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
  let driveAPI: GoogleDriveAPI | null = null;

  function goToSettings() {
    currentTab.setTab('settings');
  }

  function handleSignIn() {
    bridge.dispatch({ type: 'auth:google:signin:requested' });
    analyticsService.track('google_signin_requested');
  }

  function handleSignOut() {
    bridge.dispatch({ type: 'auth:google:signout:requested' });
    analyticsService.track('google_signout');
  }

  // Initialize Drive API when authenticated (picker loads lazily on button click)
  $effect(() => {
    if ($authState.google.isAuthenticated && !driveAPI) {
      const googleAuth = authService.getGoogleAuthInstance();
      driveAPI = new GoogleDriveAPI(googleAuth);
      analyticsService.track('google_signin_success', {
        email: $authState.google.userInfo?.email
      });
    }
  });

  // Track authentication errors
  $effect(() => {
    if ($authState.google.error) {
      analyticsService.track('google_auth_error', {
        error: $authState.google.error
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
  let pickerInitialized = $state(false);
  let pickerLoading = $state(false);
  let originalFileUrl = $state<string | null>(null); // Store URL for re-downloading
  let originalFileId = $state<string | null>(null);   // Store file ID for re-downloading

  // Batch processing state
  let batchProcessing = $state(false);
  let batchResults = $state<AudioResults[]>([]);
  let totalFiles = $state(0);
  let processedFiles = $state(0);
  let batchCancelled = $state(false);
  let batchDriveFiles = $state<DriveFileMetadata[]>([]); // Store for batch reprocessing
  let batchFolderName = $state(''); // Name of folder being processed
  let batchFolderUrl = $state(''); // URL of folder being processed
  let currentDisplayedFile = $state<string | null>(null); // Track which file is currently shown in progress bar

  // Three Hour configuration state
  let scriptsList = $state<string[]>([]); // Script base names from Google Drive folder
  let fetchingScripts = $state(false);
  let scriptsError = $state('');
  let lastFetchedScriptsUrl = $state(''); // Track which URL was used to fetch scripts

  // Cleanup blob URL when component is destroyed
  function cleanup() {
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
  }

  onDestroy(cleanup);

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
    if ((results || batchResults.length > 0) && resultsMode !== null) {
      if ($analysisMode === resultsMode) {
        resultsStale = false;
      } else {
        // Smart staleness detection based on what data is present vs needed
        const currentPreset = availablePresets[$currentPresetId];
        const currentResults = batchResults.length > 0 ? batchResults : results;
        const isStale = areResultsStaleForMode(currentResults, $analysisMode, currentPreset);

        resultsStale = isStale;
      }
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
      // Pass Three Hour configuration if available
      scriptsList: scriptsList.length > 0 ? scriptsList : undefined,
      speakerId: $threeHourSettings.speakerId || undefined,
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

    try {
      // Validate file type against current preset criteria BEFORE analyzing
      if (!isFileTypeAllowed(file.name, $currentCriteria)) {
        const rejectionReason = getFileRejectionReason(file.name, $currentCriteria);
        // Set error and failed result
        error = rejectionReason;

        // Determine external URL
        let externalUrl: string | undefined;
        if (originalFileUrl) {
          externalUrl = originalFileUrl;
        } else if (originalFileId) {
          externalUrl = `https://drive.google.com/file/d/${originalFileId}/view`;
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
          validation: {
            fileType: {
              status: 'fail',
              value: formatRejectedFileType(file.name),
              issue: rejectionReason
            }
          },
          externalUrl
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

      // Add external URL for Google Drive files (allows viewing in Drive)
      if (originalFileUrl) {
        analysisResults.externalUrl = originalFileUrl;
      } else if (originalFileId) {
        // Construct Google Drive view URL from file ID
        analysisResults.externalUrl = `https://drive.google.com/file/d/${originalFileId}/view`;
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

  /**
   * Process multiple files in batch with parallel processing
   * @param driveFiles - Array of Drive file metadata to process
   */
  async function processBatchFiles(driveFiles: DriveFileMetadata[]) {
    const batchStartTime = Date.now();

    batchProcessing = true;
    totalFiles = driveFiles.length;
    processedFiles = 0;
    batchResults = [];
    batchCancelled = false;
    batchDriveFiles = driveFiles; // Store for reprocessing
    error = '';
    // Don't reset resultsStale - let reactive statement handle staleness detection
    resultsMode = $analysisMode;
    currentDisplayedFile = null; // Reset the currently displayed file

    // Show progress bar immediately
    analysisProgress.visible = true;
    analysisProgress.filename = 'Preparing batch...';
    analysisProgress.message = 'Starting analysis';
    analysisProgress.progress = 0;
    analysisProgress.batchCurrent = 0;
    analysisProgress.batchTotal = driveFiles.length;

    // Track batch start
    analyticsService.track('batch_processing_started', {
      totalFiles: driveFiles.length,
      analysisMode: $analysisMode,
      presetId: $currentPresetId,
      source: 'google_drive',
    });

    const concurrency = 3; // Process 3 files at once
    let index = 0;
    const inProgress: Map<number, Promise<void>> = new Map();
    const tempResults: AudioResults[] = []; // Accumulate results here
    const UI_UPDATE_INTERVAL = 5; // Update UI every 5 results to reduce re-renders

    try {
      while (index < driveFiles.length || inProgress.size > 0) {
        // Check if cancelled
        if (batchCancelled) {
          // Wait for in-progress downloads to complete
          await Promise.allSettled(Array.from(inProgress.values()));
          break;
        }

        // Start new downloads up to concurrency limit
        while (inProgress.size < concurrency && index < driveFiles.length) {
          const driveFile = driveFiles[index];
          const taskId = index;
          index++;

          // CRITICAL: Add placeholder to Map FIRST to prevent race condition
          // where async function completes and tries to delete before being added
          const promise = Promise.resolve().then(async () => {
            try {
              // Validate file type against current preset criteria
              if (!isFileTypeAllowed(driveFile.name, $currentCriteria)) {
                const rejectionReason = getFileRejectionReason(driveFile.name, $currentCriteria);
                // Create failed result
                const failedResult: AudioResults = {
                  filename: driveFile.name,
                  fileType: formatRejectedFileType(driveFile.name),
                  fileSize: driveFile.size || 0,
                  channels: 0,
                  sampleRate: 0,
                  bitDepth: 0,
                  duration: 0,
                  status: 'fail',
                  error: rejectionReason,
                  validation: {
                    fileType: {
                      status: 'fail',
                      value: formatRejectedFileType(driveFile.name),
                      issue: rejectionReason
                    }
                  }
                };
                tempResults.push(failedResult);

                // Batch UI updates to reduce re-renders
                if (tempResults.length >= UI_UPDATE_INTERVAL) {
                  batchResults = [...batchResults, ...tempResults];
                  processedFiles = batchResults.length;
                  tempResults.length = 0; // Clear temp array
                }
                return;
              }

              // Check if filename-only mode - don't download the actual file
              let file: File;
              if ($analysisMode === 'filename-only') {
                // Filename-only mode: Create minimal File object with metadata only
                file = new File([], driveFile.name, { type: 'application/octet-stream' });
              } else {
                // Download file from Google Drive for audio analysis
                // Pass mode and filename for optimization (WAV files use partial download)
                file = await driveAPI!.downloadFile(driveFile.id, {
                  mode: $analysisMode,
                  filename: driveFile.name
                });
              }

              // Analyze file (pure function) - pass true for batch mode
              // Use dynamic count function to avoid race condition
              const progressCallback = createProgressCallback(driveFile.name, () => processedFiles + 1, driveFiles.length);
              const result = await analyzeFile(file, true, progressCallback);

              // Add external URL for Google Drive files
              result.externalUrl = `https://drive.google.com/file/d/${driveFile.id}/view`;

              // Add to temp results
              tempResults.push(result);

              // Batch UI updates to reduce re-renders
              if (tempResults.length >= UI_UPDATE_INTERVAL) {
                batchResults = [...batchResults, ...tempResults];
                processedFiles = batchResults.length;
                tempResults.length = 0; // Clear temp array
              }

              // If this was the currently displayed file, clear it so next file can be shown
              if (currentDisplayedFile === driveFile.name) {
                currentDisplayedFile = null;
              }
            } catch (err) {
              if (err instanceof AnalysisCancelledError) {
                batchCancelled = true;
                // No need to add to results, just stop this worker
                return;
              }
              // Log error for debugging with full details
              console.error(`Error processing ${driveFile.name}:`);
              console.error('Error message:', err instanceof Error ? err.message : String(err));
              console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
              console.error('Error object:', err);

              // Add error result
              const errorResult: AudioResults = {
                filename: driveFile.name,
                fileSize: driveFile.size || 0,
                fileType: 'unknown',
                channels: 0,
                sampleRate: 0,
                bitDepth: 0,
                duration: 0,
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown error'
              };
              tempResults.push(errorResult);

              // Batch UI updates to reduce re-renders
              if (tempResults.length >= UI_UPDATE_INTERVAL) {
                batchResults = [...batchResults, ...tempResults];
                processedFiles = batchResults.length;
                tempResults.length = 0; // Clear temp array
              }
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

      // Flush any remaining temp results
      if (tempResults.length > 0) {
        batchResults = [...batchResults, ...tempResults];
        processedFiles = batchResults.length;
        tempResults.length = 0;
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
        totalFiles: driveFiles.length,
        processedFiles: batchResults.length,
        passCount,
        warnCount,
        failCount,
        errorCount,
        batchProcessingTime: batchTime,
        totalAudioDuration: totalDuration,
        wasCancelled: batchCancelled,
        source: 'google_drive',
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
      source: 'google_drive',
      processedFiles,
      totalFiles,
      cancelledAt: cancelPercentage,
    });

    batchCancelled = true;
    analysisProgress.cancelling = true;
    analysisProgress.message = 'Cancelling...';
    cancelCurrentAnalysis();
  }

  /**
   * Check if Three Hour configuration is required for current analysis mode
   */
  function isThreeHourConfigRequired(): boolean {
    const isThreeHourPreset = availablePresets[$currentPresetId]?.filenameValidationType === 'script-match';
    const needsFilenameValidation = $analysisMode === 'full' || $analysisMode === 'filename-only';
    return isThreeHourPreset && needsFilenameValidation;
  }

  /**
   * Auto-fetch scripts if needed (URL changed or scripts not yet fetched)
   * Returns error message if fetch fails, null if successful
   */
  async function autoFetchScriptsIfNeeded(): Promise<string | null> {
    if (!isThreeHourConfigRequired()) {
      return null; // Not required, no fetch needed
    }

    const currentUrl = $threeHourSettings.scriptsFolderUrl.trim();

    if (!currentUrl) {
      return "Three Hour configuration required: Please provide scripts folder URL";
    }

    // Always fetch latest scripts (fast metadata-only operation)
    await handleFetchScripts();

    // Check if fetch was successful
    if (scriptsError) {
      return scriptsError;
    }

    if (scriptsList.length === 0) {
      return "Failed to fetch scripts from folder";
    }

    return null; // Scripts are ready
  }

  /**
   * Validate Three Hour configuration before processing
   * Returns error message if validation fails, null if valid
   */
  function validateThreeHourConfig(): string | null {
    if (!isThreeHourConfigRequired()) {
      return null; // Not required, no error
    }

    if (!$threeHourSettings.scriptsFolderUrl.trim()) {
      return "Three Hour configuration required: Please provide scripts folder URL";
    }

    if (!$threeHourSettings.speakerId.trim()) {
      return "Three Hour configuration required: Please provide speaker ID";
    }

    // Note: We no longer check scriptsList here because auto-fetch handles it
    return null; // All good
  }

  /**
   * Fetch scripts from Google Drive folder
   */
  async function handleFetchScripts() {
    if (!$threeHourSettings.scriptsFolderUrl.trim()) {
      scriptsError = 'Please provide a scripts folder URL';
      return;
    }

    if (!driveAPI) {
      scriptsError = 'Google Drive API not initialized. Please sign in again.';
      return;
    }

    fetchingScripts = true;
    scriptsError = '';
    scriptsList = [];

    try {
      // Parse the folder URL
      const parsed = driveAPI.parseUrl($threeHourSettings.scriptsFolderUrl);

      if (parsed.type !== 'folder') {
        scriptsError = 'Invalid folder URL. Please provide a Google Drive folder URL, not a file URL.';
        fetchingScripts = false;
        return;
      }

      // Get all files in the folder (not filtered to audio files)
      const files = await driveAPI.listFilesInFolder(parsed.id);

      if (files.length === 0) {
        scriptsError = 'No files found in the scripts folder';
        fetchingScripts = false;
        return;
      }

      // Extract base names (remove file extensions)
      scriptsList = files.map(file => {
        // Remove file extension from filename
        const name = file.name;
        const lastDotIndex = name.lastIndexOf('.');
        return lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
      });

      // Success - store the URL and clear any previous errors
      lastFetchedScriptsUrl = $threeHourSettings.scriptsFolderUrl;
      scriptsError = '';
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
      scriptsError = err instanceof Error ? err.message : 'Failed to fetch scripts from folder';
      scriptsList = [];
      lastFetchedScriptsUrl = '';
    } finally {
      fetchingScripts = false;
    }
  }

  async function handleUrlSubmit() {
    if (!fileUrl.trim()) return;
    if (!driveAPI) {
      error = 'Google Drive API not initialized. Please sign in again.';
      return;
    }

    // Validate Three Hour configuration if required
    const configError = validateThreeHourConfig();
    if (configError) {
      error = configError;
      return;
    }

    // Auto-fetch scripts if needed
    const fetchError = await autoFetchScriptsIfNeeded();
    if (fetchError) {
      error = fetchError;
      return;
    }

    processing = true;
    error = '';
    results = null;
    batchResults = []; // Clear previous batch results

    try {
      // Parse the URL to determine if it's a file or folder
      const parsed = driveAPI.parseUrl(fileUrl);

      if (parsed.type === 'folder') {
        // Folder URL - list audio files and batch process
        // First, get folder metadata to get the folder name
        const folderMetadata = await driveAPI.getFileMetadata(parsed.id);
        batchFolderName = folderMetadata.name;
        batchFolderUrl = `https://drive.google.com/drive/folders/${parsed.id}`;

        const filesToProcess = await driveAPI.getAllAudioFilesInFolder(parsed.id);

        if (filesToProcess.length === 0) {
          error = 'No audio files found in the folder';
          processing = false;
          return;
        }

        // Single file: use single-file processing
        if (filesToProcess.length === 1) {
          const fileMetadata = filesToProcess[0];
          originalFileUrl = null;
          originalFileId = fileMetadata.id;

          // Validate file type BEFORE downloading
          if (!isFileTypeAllowed(fileMetadata.name, $currentCriteria)) {
            const rejectionReason = getFileRejectionReason(fileMetadata.name, $currentCriteria);
            // Set error and failed result WITHOUT downloading
            error = rejectionReason;
            results = {
              filename: fileMetadata.name,
              fileType: formatRejectedFileType(fileMetadata.name),
              fileSize: fileMetadata.size || 0,
              channels: 0,
              sampleRate: 0,
              bitDepth: 0,
              duration: 0,
              status: 'fail',
              error: rejectionReason,
              validation: {
                fileType: {
                  status: 'fail',
                  value: formatRejectedFileType(fileMetadata.name),
                  issue: rejectionReason
                }
              },
              externalUrl: `https://drive.google.com/file/d/${fileMetadata.id}/view`
            };
            resultsMode = $analysisMode;
            processing = false;
            return; // Don't download the file
          }

          if ($analysisMode === 'filename-only') {
            const file = new File([], fileMetadata.name, { type: 'application/octet-stream' });
            await processSingleFile(file);
          } else {
            const file = await driveAPI.downloadFile(fileMetadata.id, {
              mode: $analysisMode,
              filename: fileMetadata.name
            });
            await processSingleFile(file);
          }
          processing = false;
        } else {
          // Multiple files: use batch processing
          processing = false;
          await processBatchFiles(filesToProcess);
        }
      } else {
        // File URL - single file processing
        originalFileUrl = fileUrl;
        originalFileId = null;

        // Get metadata first to check filename
        const metadata = await driveAPI.getFileMetadataFromUrl(fileUrl);

        // Validate file type BEFORE downloading
        if (!isFileTypeAllowed(metadata.name, $currentCriteria)) {
          const rejectionReason = getFileRejectionReason(metadata.name, $currentCriteria);
          // Set error and failed result WITHOUT downloading
          error = rejectionReason;
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
            validation: {
              fileType: {
                status: 'fail',
                value: formatRejectedFileType(metadata.name),
                issue: rejectionReason
              }
            },
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
          const file = await driveAPI.downloadFileFromUrl(fileUrl, {
            mode: $analysisMode,
            filename: metadata.name
          });
          await processSingleFile(file);
        }
        processing = false;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process Google Drive URL';
      results = null;
      processing = false;
    }
  }

  async function handleBrowseDrive() {
    if (!driveAPI) {
      error = 'Google Drive API not initialized. Please sign in again.';
      return;
    }

    // Validate Three Hour configuration if required
    const configError = validateThreeHourConfig();
    if (configError) {
      error = configError;
      return;
    }

    // Auto-fetch scripts if needed
    const fetchError = await autoFetchScriptsIfNeeded();
    if (fetchError) {
      error = fetchError;
      return;
    }

    // Lazy-load the picker on first use
    if (!pickerInitialized) {
      pickerLoading = true;
      try {
        await driveAPI.initPicker();
        pickerInitialized = true;
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to load Google Drive Picker';
        pickerLoading = false;
        return;
      }
      pickerLoading = false;
    }

    processing = true;
    error = '';
    results = null;
    batchResults = []; // Clear previous batch results

    try {
      // Show picker with multi-select and folder support
      const pickerResult = await driveAPI.showPicker({
        multiSelect: true,
        selectFolders: true, // Enable folder selection
        audioOnly: true
      });

      if (!pickerResult.docs || pickerResult.docs.length === 0) {
        processing = false;
        return; // User cancelled
      }

      // Check if folder was selected
      const doc = pickerResult.docs[0];
      let filesToProcess: DriveFileMetadata[] = [];

      if (doc.type === 'folder') {
        // Get all audio files from folder
        processing = true;
        try {
          // Store folder name and URL from picker result
          batchFolderName = doc.name;
          batchFolderUrl = `https://drive.google.com/drive/folders/${doc.id}`;

          filesToProcess = await driveAPI.getAllAudioFilesInFolder(doc.id);
          if (filesToProcess.length === 0) {
            error = 'No audio files found in the selected folder';
            processing = false;
            return;
          }
        } catch (err) {
          error = err instanceof Error ? err.message : 'Failed to list folder contents';
          processing = false;
          return;
        }
      } else {
        // Files selected directly - convert to DriveFileMetadata format
        filesToProcess = pickerResult.docs.map(d => ({
          id: d.id,
          name: d.name,
          mimeType: d.mimeType,
          size: d.sizeBytes
        }));
      }

      // Single file: use single-file processing
      if (filesToProcess.length === 1) {
        const fileMetadata = filesToProcess[0];

        // Store file ID for reprocessing
        originalFileUrl = null;
        originalFileId = fileMetadata.id;

        if ($analysisMode === 'filename-only') {
          // Filename-only mode: Just use metadata
          const file = new File([], fileMetadata.name, { type: 'application/octet-stream' });
          await processSingleFile(file);
        } else {
          // Download and process file
          const file = await driveAPI.downloadFile(fileMetadata.id, {
            mode: $analysisMode,
            filename: fileMetadata.name
          });
          await processSingleFile(file);
        }
        processing = false;
        return;
      }

      // Multiple files: use batch processing
      processing = false; // Turn off single-file processing flag
      await processBatchFiles(filesToProcess);

    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        // User cancelled - not an error
        error = '';
      } else {
        error = err instanceof Error ? err.message : 'Failed to browse Google Drive';
      }
      results = null;
      processing = false;
    }
  }

  async function handleReprocess() {
    if (!driveAPI) {
      error = 'Google Drive API not initialized. Please sign in again.';
      return;
    }

    // Track reprocess action
    analyticsService.track('reprocess_requested', {
      previousMode: resultsMode,
      newMode: $analysisMode,
      source: 'google_drive',
      isBatch: batchResults.length > 0,
      fileCount: batchResults.length > 0 ? batchDriveFiles.length : 1,
    });

    // Validate Three Hour configuration if required
    // This is crucial - mode might have changed from audio-only to full/filename-only
    const configError = validateThreeHourConfig();
    if (configError) {
      error = configError;
      return;
    }

    // Auto-fetch scripts if needed
    const fetchError = await autoFetchScriptsIfNeeded();
    if (fetchError) {
      error = fetchError;
      return;
    }

    // Check if this is batch reprocessing
    if (batchResults.length > 0 && batchDriveFiles.length > 0) {
      // Batch reprocessing - re-download and reprocess all files
      await processBatchFiles(batchDriveFiles);
      return;
    }

    // Single file reprocessing
    // Check if we need to re-download (switching from filename-only to audio mode)
    const needsRedownload = resultsMode === 'filename-only' && $analysisMode !== 'filename-only';

    if (needsRedownload && (originalFileUrl || originalFileId)) {
      processing = true;
      error = '';
      results = null;

      try {
        let file: File;

        if (originalFileUrl) {
          // Re-download from URL
          file = await driveAPI.downloadFileFromUrl(originalFileUrl, {
            mode: $analysisMode,
            filename: currentFile?.name || ''
          });
        } else if (originalFileId) {
          // Re-download using file ID
          file = await driveAPI.downloadFile(originalFileId, {
            mode: $analysisMode,
            filename: currentFile?.name || ''
          });
        } else {
          throw new Error('No file source available for reprocessing');
        }

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
  .google-drive-tab {
    padding: 1.5rem 0;
  }

  .auth-section {
    margin-bottom: 1.5rem;
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, rgba(219, 68, 55, 0.05) 0%, rgba(219, 68, 55, 0.1) 100%);
    border: 1px solid rgba(219, 68, 55, 0.2);
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

  .three-hour-config {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
  }

  .three-hour-config h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--primary, #2563eb);
  }

  .config-field {
    margin-bottom: 0.75rem;
  }

  .config-field:last-of-type {
    margin-bottom: 0.5rem;
  }

  .config-field label {
    display: block;
    margin-bottom: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary, #333333);
  }

  .config-field input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .config-field input:focus {
    outline: none;
    border-color: var(--primary, #2563eb);
  }

  .config-field input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .config-info {
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(59, 130, 246, 0.08);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary, #666666);
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

  .browse-drive-button {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, rgba(219, 68, 55, 0.9) 0%, rgba(219, 68, 55, 1) 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(219, 68, 55, 0.3);
    white-space: nowrap;
  }

  .browse-drive-button:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(200, 50, 40, 0.9) 0%, rgba(200, 50, 40, 1) 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(219, 68, 55, 0.4);
  }

  .browse-drive-button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(219, 68, 55, 0.3);
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

<div class="google-drive-tab">
  {#if $authState.google.isAuthenticated}
    <div class="auth-section">
      <h3>Google Drive:</h3>
      <span class="user-email">✓ {$authState.google.userInfo?.email}</span>
      <button class="secondary" on:click={handleSignOut}>Sign Out</button>
    </div>
  {:else}
    <div class="auth-section signed-out">
      <h3>Google Drive Authentication</h3>
      <p>Sign in to access your Google Drive files</p>
      <button on:click={handleSignIn}>Sign in with Google</button>
    </div>
  {/if}

  {#if $authState.google.isAuthenticated}
    <!-- Preset Display -->
    {#if !$hasValidPresetConfig}
      <div class="no-preset-warning">
        <span>Please select a Preset or configure Custom criteria to analyze files.</span>
        <a href="#" on:click|preventDefault={goToSettings}>Select Preset</a>
      </div>
    {:else if $currentPresetId}
      <div class="current-preset">
        <span class="preset-label">Current Preset:</span>
        <span class="preset-name" on:click={goToSettings}>{availablePresets[$currentPresetId]?.name || $currentPresetId}</span>
        <a href="#" on:click|preventDefault={goToSettings}>Change</a>
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
            placeholder={$hasValidPresetConfig ? "Paste Google Drive file or folder URL (e.g., https://drive.google.com/...)" : "Configure a preset in Settings to analyze files"}
            disabled={processing || !$hasValidPresetConfig}
            on:keydown={(e) => e.key === 'Enter' && !processing && fileUrl.trim() && $hasValidPresetConfig && handleUrlSubmit()}
          />
          <button on:click={handleUrlSubmit} disabled={processing || !fileUrl.trim() || !$hasValidPresetConfig}>
            Analyze URL
          </button>
          <button class="browse-drive-button" on:click={handleBrowseDrive} disabled={processing || pickerLoading || !$hasValidPresetConfig}>
            {#if pickerLoading}
              🔄 Loading Picker...
            {:else}
              📁 Browse
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Analysis Mode Selection (only for presets with filename validation) -->
    {#if $currentPresetId && availablePresets[$currentPresetId]?.supportsFilenameValidation}
      <div class="analysis-mode-section">
        <h3>Analysis Mode:</h3>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              name="analysis-mode-drive"
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
              name="analysis-mode-drive"
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
              name="analysis-mode-drive"
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
              name="analysis-mode-drive"
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

        {#if availablePresets[$currentPresetId]?.filenameValidationType === 'script-match' &&
            ($analysisMode === 'full' || $analysisMode === 'filename-only')}
          <div class="three-hour-config">
            <h4>Three Hour Configuration</h4>

            <!-- Scripts Folder URL -->
            <div class="config-field">
              <label for="scripts-folder-url">Scripts Folder URL:</label>
              <input
                id="scripts-folder-url"
                type="text"
                bind:value={$threeHourSettings.scriptsFolderUrl}
                placeholder="https://drive.google.com/drive/folders/..."
                disabled={processing}
              />
            </div>

            <!-- Speaker ID -->
            <div class="config-field">
              <label for="speaker-id">Speaker ID:</label>
              <input
                id="speaker-id"
                type="text"
                bind:value={$threeHourSettings.speakerId}
                placeholder="e.g., SP001"
                disabled={processing}
                on:blur={() => {
                  // Trim whitespace on blur
                  if ($threeHourSettings.speakerId) {
                    threeHourSettings.setSpeakerId($threeHourSettings.speakerId);
                  }
                }}
              />
            </div>

            <div class="config-info">
              ℹ️ These settings are saved automatically. Scripts will be fetched when you start analysis.
            </div>
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
