/**
 * Advanced Audio Level Analysis
 * Peak detection, noise floor estimation, and normalization checks
 */

/**
 * Custom error thrown when audio analysis is cancelled by user.
 * Allows calling code to distinguish cancellation from other errors.
 */
export class AnalysisCancelledError extends Error {
  constructor(message = 'Analysis was cancelled by user', stage = null) {
    super(message);
    this.name = 'AnalysisCancelledError';
    this.stage = stage; // Optional: which analysis stage was interrupted
  }
}

export class LevelAnalyzer {
  // Cancellation check frequencies (balance between responsiveness and overhead)
  static CANCELLATION_CHECK_INTERVALS = {
    SAMPLE_LOOP: 10000,    // Peak/clipping: check every 10K samples (~0.2s @ 48kHz)
    WINDOW_LOOP: 1000,     // Noise floor: check every 1K windows (~1s)
    BLOCK_LOOP: 50,        // Stereo/bleed/overlap: check every 50 blocks (~13s @ 250ms blocks)
    ONSET_LOOP: 100,       // Reverb: check every 100 onsets
    CHUNK_LOOP: 1000,      // Silence: check every 1K chunks (~1s)
    SEGMENT_LOOP: 1        // Consistency: check every segment (~15s)
  };

  // Noise floor analysis constants
  static NOISE_FLOOR_CONFIG = {
    NUM_BINS: 200,          // Histogram bins for levels from -100dB to 0dB (0.5 dB resolution)
    MIN_DB: -100.0,         // Minimum dB range
    DB_RANGE: 100.0,        // Total dB range (100 dB)
    WINDOW_SIZE_MS: 50,     // Window size in milliseconds (50ms)
    QUIETEST_PERCENTILE: 0.30  // Use quietest 30% of non-silent windows
  };

  // Silence analysis constants
  static SILENCE_CONFIG = {
    CHUNK_SIZE_MS: 50,      // Chunk size for silence detection (50ms)
    MIN_SOUND_DURATION_MS: 150,  // Minimum duration for a sound to not be considered a tick (150ms)
    SILENCE_THRESHOLD_RATIO: 0.25  // Silence threshold: 25% of way between noise floor and peak
  };

  // Reverb analysis constants
  static REVERB_CONFIG = {
    MIN_DB_ABOVE_NOISE: 10, // Minimum dB above noise floor for onset detection
    ONSET_THRESHOLD: 1.5,   // Threshold for RMS rise to detect onset
    ONSET_WINDOW_SIZE: 1024, // Window size for onset detection
    DECAY_WINDOW_SIZE_MS: 20, // Decay window size in milliseconds
    DECAY_THRESHOLD_DB: -25 // Decay threshold in dB
  };

  // Stereo/mic bleed analysis constants
  static STEREO_CONFIG = {
    BLOCK_SIZE_MS: 250,           // Block size for analysis (250ms)
    DOMINANCE_RATIO_THRESHOLD: 1.5, // How much louder one channel must be to be dominant
    SILENCE_THRESHOLD: 0.001,     // RMS threshold for silence
    SEPARATION_THRESHOLD: 15      // dB separation threshold for mic bleed concern
  };

  // Clipping analysis constants
  static CLIPPING_CONFIG = {
    HARD_CLIPPING_THRESHOLD: 0.985,  // Hard clipping threshold (~-0.13 dB from full scale)
    NEAR_CLIPPING_THRESHOLD: 0.98,   // Near clipping threshold
    MAX_GAP_SAMPLES: 3,              // Allow up to 3 samples below threshold in a clipping region
    MAX_REGIONS_PER_CHANNEL: 5000,   // Safety limit for regions per channel
    MAX_TOTAL_REGIONS: 10000,        // Total regions across all channels
    MAX_CLIPPED_SAMPLES_PER_CHANNEL: 20000000 // Emergency brake for extreme files
  };

  // Progress stage allocation for smooth 0-100% progress
  // Base analysis (always runs): 0-40%
  static PROGRESS_STAGES = {
    PEAK_START: 0,
    PEAK_END: 0.15,
    NOISE_FLOOR_START: 0.15,
    NOISE_FLOOR_END: 0.35,
    NORMALIZATION_START: 0.35,
    NORMALIZATION_END: 0.40,
    // Experimental analysis (optional): 40-100%
    REVERB_START: 0.40,
    REVERB_END: 0.65,
    SILENCE_START: 0.65,
    SILENCE_END: 0.80,
    CLIPPING_START: 0.80,
    CLIPPING_END: 1.0
  };

  constructor() {
    this.analysisInProgress = false;
  }

  /**
   * Scales progress from a stage's internal 0-1 range to its allocated percentage range
   * @param {number} stageProgress Progress within stage (0-1)
   * @param {number} stageStart Start of stage range (0-1)
   * @param {number} stageEnd End of stage range (0-1)
   * @returns {number} Scaled progress (0-1)
   */
  scaleProgress(stageProgress, stageStart, stageEnd) {
    return stageStart + (stageProgress * (stageEnd - stageStart));
  }

  async analyzeAudioBuffer(audioBuffer, progressCallback = null, includeExperimental = false) {
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    // Get all channel data
    const channelData = [];
    for (let channel = 0; channel < channels; channel++) {
      channelData.push(audioBuffer.getChannelData(channel));
    }

    this.analysisInProgress = true;

    try {
      // 1. Combined Peak Level + Clipping Analysis (OPTIMIZATION: Single pass instead of two)
      // Only combine these if experimental analysis is enabled, otherwise just do peak detection
      let globalPeak = 0;
      let peakDb;
      let clippingAnalysis = null;

      if (includeExperimental) {
        // Combined pass for peak + clipping
        if (progressCallback) progressCallback('Analyzing peak levels and clipping...', LevelAnalyzer.PROGRESS_STAGES.PEAK_START);
        const combined = await this.analyzePeakAndClipping(audioBuffer, sampleRate, progressCallback);
        globalPeak = combined.globalPeak;
        peakDb = combined.peakDb;
        clippingAnalysis = combined.clippingAnalysis;
      } else {
        // Base analysis only: just peak detection
        if (progressCallback) progressCallback('Analyzing peak levels...', LevelAnalyzer.PROGRESS_STAGES.PEAK_START);
        let peakFound = false;

        for (let channel = 0; channel < channels; channel++) {
          const data = channelData[channel];
          for (let i = 0; i < length; i++) {
            const sample = Math.abs(data[i]);
            if (sample > globalPeak) {
              globalPeak = sample;
            }

            // EMERGENCY BRAKE: If peak is already 1.0, no need to scan further.
            if (globalPeak >= 0.99999) {
              peakFound = true;
              break;
            }

            // Update progress every 10000 samples
            if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.SAMPLE_LOOP === 0) {
              if (!this.analysisInProgress) {
                throw new AnalysisCancelledError('Analysis cancelled', 'peak-levels');
              }
              const stageProgress = (channel * length + i) / (channels * length);
              const scaledProgress = this.scaleProgress(stageProgress, LevelAnalyzer.PROGRESS_STAGES.PEAK_START, LevelAnalyzer.PROGRESS_STAGES.PEAK_END);
              if (progressCallback) progressCallback('Analyzing peak levels...', scaledProgress);

              // Allow UI to update
              if (i % 100000 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            }
          }
          if (peakFound) {
            break;
          }
        }

        peakDb = globalPeak > 0 ? 20 * Math.log10(globalPeak) : -Infinity;
      }

      // 2. OPTIMIZATION (Phase 2): Calculate RMS windows once for reuse
      if (progressCallback) progressCallback('Analyzing noise floor...', LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_START);
      const rmsWindows = await this.calculateRMSWindows(channelData, channels, length, sampleRate, progressCallback);

      // 3. Noise Floor Analysis (uses pre-calculated RMS windows)
      const noiseFloorAnalysis = await this.analyzeNoiseFloorFromWindows(rmsWindows, progressCallback);

      // 3. Normalization Check
      if (progressCallback) progressCallback('Checking normalization...', LevelAnalyzer.PROGRESS_STAGES.NORMALIZATION_START);
      const normalizationStatus = this.checkNormalization(peakDb);

      // Base results (always included)
      const results = {
        peakDb: peakDb,
        noiseFloorDb: noiseFloorAnalysis.overall,
        noiseFloorPerChannel: noiseFloorAnalysis.perChannel,
        hasDigitalSilence: noiseFloorAnalysis.hasDigitalSilence,
        digitalSilencePercentage: noiseFloorAnalysis.digitalSilencePercentage,
        normalizationStatus: normalizationStatus
      };

      // Experimental analysis (only when requested)
      if (includeExperimental) {
        // Reverb Estimation
        if (progressCallback) progressCallback('Estimating reverb...', LevelAnalyzer.PROGRESS_STAGES.REVERB_START);
        const reverbAnalysisResults = await this.estimateReverb(channelData, channels, length, sampleRate, noiseFloorAnalysis.overall, progressCallback);
        const reverbInfo = this.interpretReverb(reverbAnalysisResults.overallMedianRt60);

        // Silence Analysis (use original method for accurate timing at all sample rates)
        if (progressCallback) progressCallback('Analyzing silence...', LevelAnalyzer.PROGRESS_STAGES.SILENCE_START);
        const { leadingSilence, trailingSilence, longestSilence, silenceSegments } = this.analyzeSilence(channelData, channels, length, sampleRate, noiseFloorAnalysis.overall, peakDb, progressCallback);

        // Clipping Analysis - already done in combined pass above (OPTIMIZATION)
        // No separate call needed here

        // Add experimental results
        results.reverbInfo = reverbInfo; // This is the interpreted text
        results.reverbAnalysis = reverbAnalysisResults; // This is the raw data including per-channel
        results.leadingSilence = leadingSilence;
        results.trailingSilence = trailingSilence;
        results.longestSilence = longestSilence;
        results.silenceSegments = silenceSegments;
        results.clippingAnalysis = clippingAnalysis; // From combined pass
      }

      if (progressCallback) progressCallback('Analysis complete!', 1.0);

      return results;
    } finally {
      this.analysisInProgress = false;
    }
  }

  interpretReverb(rt60) {
    if (rt60 <= 0) {
      return { time: rt60, label: 'N/A', description: 'No reverb detected.' };
    }
    if (rt60 < 0.3) {
      return { time: rt60, label: 'Excellent (Dry)', description: 'Ideal for voiceover. Matches a vocal booth or well-treated studio environment.' };
    }
    if (rt60 < 0.5) {
      return { time: rt60, label: 'Good (Controlled)', description: 'A well-controlled room with minimal reflections. Acceptable for most recording.' };
    }
    if (rt60 < 0.8) {
      return { time: rt60, label: 'Fair (Slightly Live)', description: 'Noticeable room reflections. May reduce clarity for voiceover work.' };
    }
    if (rt60 < 1.2) {
      return { time: rt60, label: 'Poor (Reverberant)', description: 'Significant reverb is present, making the recording sound distant and unprofessional.' };
    }
    return { time: rt60, label: 'Very Poor (Echoey)', description: 'Excessive echo and reverb. Unsuitable for professional voice recording.' };
  }

  /**
   * OPTIMIZATION: Phase 2 - Silence detection from pre-calculated windows
   * Analyzes silence using pre-calculated window peaks (no audio scanning).
   * @param {object} rmsWindows Pre-calculated window data from calculateRMSWindows()
   * @param {number} sampleRate Sample rate of the audio
   * @param {number} noiseFloorDb Noise floor in dB
   * @param {number} peakDb Peak level in dB
   * @param {function} progressCallback Optional progress callback
   * @returns {object} Silence analysis results
   */
  analyzeSilenceFromWindows(rmsWindows, sampleRate, noiseFloorDb, peakDb, progressCallback = null) {
    const { windowData, windowSize, numWindows } = rmsWindows;

    // Handle edge case: if noise floor is -Infinity (digital silence), use absolute threshold
    let silenceThresholdDb;
    let silenceThresholdLinear;

    if (noiseFloorDb === -Infinity || !isFinite(noiseFloorDb)) {
      silenceThresholdDb = -60;
      silenceThresholdLinear = Math.pow(10, -60 / 20);
    } else {
      const dynamicRange = peakDb - noiseFloorDb;
      const thresholdRatio = 0.25;
      const effectiveDynamicRange = Math.max(0, dynamicRange);
      silenceThresholdDb = noiseFloorDb + (effectiveDynamicRange * thresholdRatio);
      silenceThresholdLinear = Math.pow(10, silenceThresholdDb / 20);
    }

    const chunkSizeMs = 50; // 50ms chunks (matches window size)
    const minSoundDurationMs = 150;
    const minSoundChunks = Math.ceil(minSoundDurationMs / chunkSizeMs);

    const chunks = new Array(numWindows).fill(0); // 0 for silence, 1 for sound

    // Step 1: Classify windows as sound or silence using pre-calculated peaks (0-40%)
    for (let i = 0; i < numWindows; i++) {
      if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.CHUNK_LOOP === 0) {
        if (!this.analysisInProgress) {
          throw new AnalysisCancelledError('Analysis cancelled', 'silence');
        }
        if (progressCallback) {
          const step1Progress = (i / numWindows) * 0.4;
          const scaledProgress = this.scaleProgress(step1Progress, LevelAnalyzer.PROGRESS_STAGES.SILENCE_START, LevelAnalyzer.PROGRESS_STAGES.SILENCE_END);
          progressCallback('Analyzing silence...', scaledProgress);
        }
      }

      // Use pre-calculated window peak instead of scanning samples
      const windowPeak = windowData[i].windowPeak;
      if (windowPeak > silenceThresholdLinear) {
        chunks[i] = 1; // Sound
      }
    }

    // Step 2: Filter out small "islands" of sound (40-60%)
    let currentSoundStreak = 0;
    for (let i = 0; i < numWindows; i++) {
      if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.CHUNK_LOOP === 0) {
        if (!this.analysisInProgress) {
          throw new AnalysisCancelledError('Analysis cancelled', 'silence');
        }
        if (progressCallback) {
          const step2Progress = 0.4 + (i / numWindows) * 0.2;
          const scaledProgress = this.scaleProgress(step2Progress, LevelAnalyzer.PROGRESS_STAGES.SILENCE_START, LevelAnalyzer.PROGRESS_STAGES.SILENCE_END);
          progressCallback('Analyzing silence...', scaledProgress);
        }
      }

      if (chunks[i] === 1) {
        currentSoundStreak++;
      } else {
        if (currentSoundStreak > 0 && currentSoundStreak < minSoundChunks) {
          // Revert insignificant sound island to silence
          for (let j = 1; j <= currentSoundStreak; j++) {
            chunks[i - j] = 0;
          }
        }
        currentSoundStreak = 0;
      }
    }

    // Check for trailing sound island
    if (currentSoundStreak > 0 && currentSoundStreak < minSoundChunks) {
      for (let j = 1; j <= currentSoundStreak; j++) {
        chunks[numWindows - j] = 0;
      }
    }

    // Step 3: Find all silence segments
    const silenceSegments = [];
    let longestSilenceStreak = 0;
    let currentSilenceStreak = 0;
    let currentSilenceStart = -1;

    const firstSoundIndex = chunks.indexOf(1);
    const lastSoundIndex = chunks.lastIndexOf(1);

    for (let i = 0; i < numWindows; i++) {
      if (chunks[i] === 0) {
        if (currentSilenceStreak === 0) {
          currentSilenceStart = i;
        }
        currentSilenceStreak++;
      } else {
        if (currentSilenceStreak > 0) {
          if (i > firstSoundIndex && currentSilenceStart < lastSoundIndex) {
            const duration = currentSilenceStreak * (chunkSizeMs / 1000);
            const startTime = currentSilenceStart * (chunkSizeMs / 1000);
            const endTime = i * (chunkSizeMs / 1000);

            silenceSegments.push({
              startTime,
              endTime,
              duration
            });
          }

          if (currentSilenceStreak > longestSilenceStreak) {
            longestSilenceStreak = currentSilenceStreak;
          }
          currentSilenceStreak = 0;
          currentSilenceStart = -1;
        }
      }
    }

    // Check trailing silence for longest streak
    if (currentSilenceStreak > longestSilenceStreak) {
      longestSilenceStreak = currentSilenceStreak;
    }

    const longestSilence = longestSilenceStreak * (chunkSizeMs / 1000);

    // Step 4: Find leading and trailing silence
    let leadingSilence = 0;
    let trailingSilence = 0;

    // Calculate total length from window data
    const totalLength = windowData[numWindows - 1].endSample;

    if (firstSoundIndex === -1) {
      // Entire file is silent
      leadingSilence = totalLength / sampleRate;
      trailingSilence = totalLength / sampleRate;
    } else {
      leadingSilence = firstSoundIndex * (chunkSizeMs / 1000);
      trailingSilence = (numWindows - 1 - lastSoundIndex) * (chunkSizeMs / 1000);

      // Add leading silence to segments if significant
      if (leadingSilence > 0) {
        silenceSegments.push({
          startTime: 0,
          endTime: leadingSilence,
          duration: leadingSilence,
          type: 'leading'
        });
      }

      // Add trailing silence to segments if significant
      if (trailingSilence > 0) {
        const fileEndTime = (numWindows * chunkSizeMs) / 1000;
        silenceSegments.push({
          startTime: fileEndTime - trailingSilence,
          endTime: fileEndTime,
          duration: trailingSilence,
          type: 'trailing'
        });
      }
    }

    // Sort silence segments by duration (longest first)
    silenceSegments.sort((a, b) => b.duration - a.duration);

    return {
      leadingSilence: leadingSilence,
      trailingSilence: trailingSilence,
      longestSilence: longestSilence,
      silenceSegments: silenceSegments
    };
  }

  analyzeSilence(channelData, channels, length, sampleRate, noiseFloorDb, peakDb, progressCallback = null) {
    // Handle edge case: if noise floor is -Infinity (digital silence), use absolute threshold
    let silenceThresholdDb;
    let silenceThresholdLinear;

    if (noiseFloorDb === -Infinity || !isFinite(noiseFloorDb)) {
      // Fallback: Use absolute threshold at -60 dB (typical room noise level)
      // This handles files with significant digital silence in one or more channels
      silenceThresholdDb = -60;
      silenceThresholdLinear = Math.pow(10, -60 / 20);
    } else {
      // Normal case: Set threshold 25% of the way between the noise floor and the peak
      const dynamicRange = peakDb - noiseFloorDb;
      const thresholdRatio = 0.25;
      // Handle case where peak is quieter than noise floor (unlikely but possible)
      const effectiveDynamicRange = Math.max(0, dynamicRange);
      silenceThresholdDb = noiseFloorDb + (effectiveDynamicRange * thresholdRatio);
      silenceThresholdLinear = Math.pow(10, silenceThresholdDb / 20);
    }

    const chunkSizeMs = 50; // 50ms chunks
    const chunkSamples = Math.floor(sampleRate * (chunkSizeMs / 1000));
    const numChunks = Math.ceil(length / chunkSamples);

    const minSoundDurationMs = 150; // Minimum duration for a sound to not be considered a tick
    const minSoundChunks = Math.ceil(minSoundDurationMs / chunkSizeMs);

    const chunks = new Array(numChunks).fill(0); // 0 for silence, 1 for sound

    // Step 1: Classify chunks as sound or silence (0-40% of silence stage)
    for (let i = 0; i < numChunks; i++) {
      if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.CHUNK_LOOP === 0) {
        if (!this.analysisInProgress) {
          throw new AnalysisCancelledError('Analysis cancelled', 'silence');
        }
        // Report granular progress for Step 1
        if (progressCallback) {
          const step1Progress = (i / numChunks) * 0.4; // Step 1 is 0-40% of silence stage
          const scaledProgress = this.scaleProgress(step1Progress, LevelAnalyzer.PROGRESS_STAGES.SILENCE_START, LevelAnalyzer.PROGRESS_STAGES.SILENCE_END);
          progressCallback('Analyzing silence...', scaledProgress);
        }
      }
      const start = i * chunkSamples;
      const end = Math.min(start + chunkSamples, length);
      let maxSampleInChunk = 0;

      // Find the absolute max sample in this chunk across all channels
      for (let channel = 0; channel < channels; channel++) {
        const data = channelData[channel];
        for (let j = start; j < end; j++) {
          const sample = Math.abs(data[j]);
          if (sample > maxSampleInChunk) {
            maxSampleInChunk = sample;
          }
        }
      }

      if (maxSampleInChunk > silenceThresholdLinear) {
        chunks[i] = 1; // Sound
      }
    }

    // Step 2: Filter out small "islands" of sound (40-60% of silence stage)
    let currentSoundStreak = 0;
    for (let i = 0; i < numChunks; i++) {
      if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.CHUNK_LOOP === 0) {
        if (!this.analysisInProgress) {
          throw new AnalysisCancelledError('Analysis cancelled', 'silence');
        }
        // Report granular progress for Step 2
        if (progressCallback) {
          const step2Progress = 0.4 + (i / numChunks) * 0.2; // Step 2 is 40-60% of silence stage
          const scaledProgress = this.scaleProgress(step2Progress, LevelAnalyzer.PROGRESS_STAGES.SILENCE_START, LevelAnalyzer.PROGRESS_STAGES.SILENCE_END);
          progressCallback('Analyzing silence...', scaledProgress);
        }
      }
      if (chunks[i] === 1) {
        currentSoundStreak++;
      } else {
        if (currentSoundStreak > 0 && currentSoundStreak < minSoundChunks) {
          // This was an insignificant sound island, so revert it to silence
          for (let j = 1; j <= currentSoundStreak; j++) {
            chunks[i - j] = 0;
          }
        }
        currentSoundStreak = 0;
      }
    }
    // Check for trailing sound island
    if (currentSoundStreak > 0 && currentSoundStreak < minSoundChunks) {
      for (let j = 1; j <= currentSoundStreak; j++) {
        chunks[numChunks - j] = 0;
      }
    }

    // Step 3: Find all silence segments *after* filtering (not counting leading/trailing)
    const silenceSegments = [];
    let longestSilenceStreak = 0;
    let currentSilenceStreak = 0;
    let currentSilenceStart = -1;

    // Find first and last sound index for excluding leading/trailing
    const firstSoundIndex = chunks.indexOf(1);
    const lastSoundIndex = chunks.lastIndexOf(1);

    for (let i = 0; i < numChunks; i++) {
      if (chunks[i] === 0) {
        if (currentSilenceStreak === 0) {
          currentSilenceStart = i;
        }
        currentSilenceStreak++;
      } else {
        if (currentSilenceStreak > 0) {
          // Only record silence segments that are NOT leading or trailing
          if (i > firstSoundIndex && currentSilenceStart < lastSoundIndex) {
            const duration = currentSilenceStreak * (chunkSizeMs / 1000);
            const startTime = currentSilenceStart * (chunkSizeMs / 1000);
            const endTime = i * (chunkSizeMs / 1000);

            silenceSegments.push({
              startTime,
              endTime,
              duration
            });
          }

          if (currentSilenceStreak > longestSilenceStreak) {
            longestSilenceStreak = currentSilenceStreak;
          }
          currentSilenceStreak = 0;
          currentSilenceStart = -1;
        }
      }
    }

    // Check trailing silence for longest streak
    if (currentSilenceStreak > longestSilenceStreak) {
      longestSilenceStreak = currentSilenceStreak;
    }

    const longestSilence = longestSilenceStreak * (chunkSizeMs / 1000);

    // Step 4: Find leading and trailing silence from the *filtered* chunks
    let leadingSilence = 0;
    let trailingSilence = 0;

    if (firstSoundIndex === -1) {
      // Entire file is silent
      leadingSilence = length / sampleRate;
      trailingSilence = length / sampleRate;
    } else {
      leadingSilence = firstSoundIndex * (chunkSizeMs / 1000);
      trailingSilence = (numChunks - 1 - lastSoundIndex) * (chunkSizeMs / 1000);

      // Add leading silence to segments if significant
      if (leadingSilence > 0) {
        silenceSegments.push({
          startTime: 0,
          endTime: leadingSilence,
          duration: leadingSilence,
          type: 'leading'
        });
      }

      // Add trailing silence to segments if significant
      if (trailingSilence > 0) {
        const fileEndTime = (numChunks * chunkSizeMs) / 1000;
        silenceSegments.push({
          startTime: fileEndTime - trailingSilence,
          endTime: fileEndTime,
          duration: trailingSilence,
          type: 'trailing'
        });
      }
    }

    // Sort silence segments by duration (longest first) - now includes leading/trailing
    silenceSegments.sort((a, b) => b.duration - a.duration);

    return {
      leadingSilence: leadingSilence,
      trailingSilence: trailingSilence,
      longestSilence: longestSilence,
      silenceSegments: silenceSegments
    };
  }

  async estimateReverb(channelDataArray, channels, length, sampleRate, noiseFloorDb, progressCallback = null) { // Renamed channelData to channelDataArray
    // Handle edge case: if noise floor is -Infinity (digital silence), use absolute threshold
    let onsetThresholdDb;
    if (noiseFloorDb === -Infinity || !isFinite(noiseFloorDb)) {
      // Fallback: Use absolute threshold at -50 dB
      // This handles files with significant digital silence
      onsetThresholdDb = -50;
    } else {
      // Normal case: Onset threshold = noise floor + 10 dB (peaks above noise)
      onsetThresholdDb = noiseFloorDb + 10;
    }

    const onsetThreshold = 1.5;
    const onsetWindowSize = 1024;
    const decayWindowSize = Math.floor(sampleRate * 0.02); // 20ms windows for decay
    const decayThresholdDb = -25;

            let allDecayTimes = []; // Collect decay times from all channels for overall median
            let perChannelResults = []; // Collect per-channel results

            let onsetCount = 0;
            for (let channelIndex = 0; channelIndex < channels; channelIndex++) { // Loop through all channels
              if (!this.analysisInProgress) {
                throw new AnalysisCancelledError('Analysis cancelled', 'reverb');
              }
              const data = channelDataArray[channelIndex]; // Get data for current channel
              let decayTimesForChannel = []; // Collect decay times for this specific channel
              let prevRms = 0; // Reset prevRms for each channel
    for (let i = 0; i < length - onsetWindowSize; i += onsetWindowSize) {
      let sumSquares = 0;
      for (let j = i; j < i + onsetWindowSize; j++) {
        sumSquares += data[j] * data[j];
      }
      const currentRms = Math.sqrt(sumSquares / onsetWindowSize);

      if (currentRms > prevRms * onsetThreshold && currentRms > 0.01) {
        if (onsetCount++ % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.ONSET_LOOP === 0) {
          if (!this.analysisInProgress) {
            throw new AnalysisCancelledError('Analysis cancelled', 'reverb');
          }
          // Report granular progress for reverb estimation
          if (progressCallback) {
            const channelProgress = (channelIndex / channels) + ((i / length) / channels);
            const scaledProgress = this.scaleProgress(channelProgress, LevelAnalyzer.PROGRESS_STAGES.REVERB_START, LevelAnalyzer.PROGRESS_STAGES.REVERB_END);
            progressCallback('Estimating reverb...', scaledProgress);
          }
        }
        let peakAmplitude = 0;
        let peakIndex = i;
        for (let j = i; j < i + onsetWindowSize; j++) {
          if (Math.abs(data[j]) > peakAmplitude) {
            peakAmplitude = Math.abs(data[j]);
            peakIndex = j;
          }
        }

        const peakDb = 20 * Math.log10(peakAmplitude);

        if (peakDb > onsetThresholdDb) {
          let decayEndSample = -1;
          const MAX_DECAY_LOOP_ITERATIONS = 1000; // Emergency brake
          let decayLoopCount = 0; // New counter

          // New decay logic: Use RMS windows instead of raw samples
          for (let j = peakIndex; j < length - decayWindowSize; j += decayWindowSize) {
            if (decayLoopCount++ > MAX_DECAY_LOOP_ITERATIONS) {
              break; // Emergency brake
            }
            let decaySumSquares = 0;
            for (let k = j; k < j + decayWindowSize; k++) {
              decaySumSquares += data[k] * data[k];
            }
            const decayRms = Math.sqrt(decaySumSquares / decayWindowSize);
            const currentDecayDb = decayRms > 0 ? 20 * Math.log10(decayRms) : -120;

            // Allow UI to update in this deep loop
            if (j % 100000 === 0) { // Yield every 100K samples
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            if (currentDecayDb < peakDb + decayThresholdDb) {
              decayEndSample = j;
              break;
            }
          }

          if (decayEndSample !== -1) {
            const decayDurationSeconds = (decayEndSample - peakIndex) / sampleRate;
            if (decayDurationSeconds > 0) {
              const rt60 = decayDurationSeconds * (60 / Math.abs(decayThresholdDb));
              decayTimesForChannel.push(rt60); // Push to this channel's decay times
            }
          }
        }
      }
      prevRms = currentRms;

          // Allow UI to update
          if (i % 100000 === 0) { // Yield every 100K samples
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }

        // Calculate median RT60 for the current channel
        let medianRt60ForChannel = 0;
        if (decayTimesForChannel.length > 0) {
          decayTimesForChannel.sort((a, b) => a - b);
          const mid = Math.floor(decayTimesForChannel.length / 2);
          medianRt60ForChannel = decayTimesForChannel.length % 2 !== 0
            ? decayTimesForChannel[mid]
            : (decayTimesForChannel[mid - 1] + decayTimesForChannel[mid]) / 2;
        }
        perChannelResults.push({
          channelIndex,
          channelName: ['left', 'right'][channelIndex] || `channel ${channelIndex}`,
          medianRt60: medianRt60ForChannel
        });
        allDecayTimes.push(...decayTimesForChannel); // Aggregate for overall median
      } // Close the outer loop for channels

    if (allDecayTimes.length < 1) {
      return 0;
    }

    allDecayTimes.sort((a, b) => a - b);
    const mid = Math.floor(allDecayTimes.length / 2);
    const medianRt60 = allDecayTimes.length % 2 !== 0
      ? allDecayTimes[mid]
      : (allDecayTimes[mid - 1] + allDecayTimes[mid]) / 2;

    return {
      overallMedianRt60: medianRt60,
      perChannelRt60: perChannelResults
    };
  }

  /**
   * OPTIMIZATION: Phase 2 - Calculate RMS windows once for reuse
   * Calculates 50ms RMS windows and peak values in a single pass.
   * Shared by noise floor analysis and silence detection to avoid duplicate scans.
   * @param {Array<Float32Array>} channelData Array of channel data
   * @param {number} channels Number of channels
   * @param {number} length Length in samples
   * @param {number} sampleRate Sample rate (for actual 50ms calculation)
   * @param {function} progressCallback Optional progress callback
   * @returns {object} Window data with RMS and peak values
   */
  async calculateRMSWindows(channelData, channels, length, sampleRate, progressCallback = null) {
    // IMPORTANT: Use fixed 44.1kHz reference for noise floor consistency (matches original)
    // This ensures consistent histogram binning across different sample rates
    const windowSizeMs = 50;
    const windowSize = Math.floor(44100 * (windowSizeMs / 1000)); // Fixed 44.1kHz reference
    const numWindows = Math.ceil(length / windowSize);

    const windowData = [];
    const channelNames = ['left', 'right', 'center', 'LFE', 'surroundLeft', 'surroundRight'];

    // Also track per-channel RMS arrays for noise floor histogram
    const perChannelRmsValues = [];
    const overallRmsValues = [];
    for (let channel = 0; channel < channels; channel++) {
      perChannelRmsValues.push([]);
    }

    let digitalSilenceWindows = 0;
    let windowCount = 0;

    // Single pass: calculate RMS and peak for each window
    for (let i = 0; i < length; i += windowSize) {
      if (windowCount++ % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.WINDOW_LOOP === 0) {
        if (!this.analysisInProgress) {
          throw new AnalysisCancelledError('Analysis cancelled', 'rms-windows');
        }
        if (progressCallback) {
          const progress = i / length;
          const scaledProgress = this.scaleProgress(progress, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_START, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_END);
          progressCallback('Analyzing noise floor...', scaledProgress);
        }
      }

      const end = Math.min(i + windowSize, length);
      const actualWindowSize = end - i;
      let allChannelsSilent = true;
      let windowPeak = 0;
      const channelRms = [];

      // Calculate per-channel RMS and overall peak
      for (let channel = 0; channel < channels; channel++) {
        const data = channelData[channel];
        let sumSquares = 0;
        let channelPeak = 0;

        for (let j = i; j < end; j++) {
          const sample = data[j];
          const absSample = Math.abs(sample);

          // RMS calculation
          sumSquares += sample * sample;

          // Peak detection (for silence)
          if (absSample > channelPeak) {
            channelPeak = absSample;
          }
        }

        const rms = Math.sqrt(sumSquares / actualWindowSize);
        channelRms.push(rms);

        if (rms > 0) {
          allChannelsSilent = false;
          perChannelRmsValues[channel].push(rms);
          overallRmsValues.push(rms);
        }

        // Track max peak across all channels for this window
        if (channelPeak > windowPeak) {
          windowPeak = channelPeak;
        }
      }

      // Track digital silence
      if (allChannelsSilent) {
        digitalSilenceWindows++;
      }

      // Store window data for reuse
      windowData.push({
        startSample: i,
        endSample: end,
        channelRms: channelRms,
        windowPeak: windowPeak,
        isDigitalSilence: allChannelsSilent
      });
    }

    return {
      windowData,
      numWindows,
      windowSize,
      perChannelRmsValues,
      overallRmsValues,
      digitalSilenceWindows
    };
  }

  /**
   * OPTIMIZATION: Phase 2 - Noise floor from pre-calculated windows
   * Analyzes noise floor using pre-calculated RMS windows (no audio scanning).
   * @param {object} rmsWindows Pre-calculated window data from calculateRMSWindows()
   * @param {function} progressCallback Optional progress callback
   * @returns {object} Noise floor analysis results
   */
  async analyzeNoiseFloorFromWindows(rmsWindows, progressCallback = null) {
    const { NUM_BINS, MIN_DB, DB_RANGE, QUIETEST_PERCENTILE } = LevelAnalyzer.NOISE_FLOOR_CONFIG;
    const numBins = NUM_BINS;
    const minDb = MIN_DB;
    const dbRange = DB_RANGE;
    const quietestPercentile = QUIETEST_PERCENTILE;

    const { perChannelRmsValues, overallRmsValues, digitalSilenceWindows, numWindows, windowData } = rmsWindows;
    const channels = perChannelRmsValues.length;
    const channelNames = ['left', 'right', 'center', 'LFE', 'surroundLeft', 'surroundRight'];

    // Build histograms from quietest windows (reusing RMS values already calculated)
    const perChannelResults = [];

    for (let channel = 0; channel < channels; channel++) {
      // Report progress
      if (progressCallback) {
        const progress = 0.7 + (channel / channels) * 0.3; // 70-100% of noise floor stage
        const scaledProgress = this.scaleProgress(progress, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_START, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_END);
        progressCallback('Analyzing noise floor...', scaledProgress);
      }

      const channelRms = perChannelRmsValues[channel];

      if (channelRms.length === 0) {
        // All windows were silence
        perChannelResults.push({
          channelIndex: channel,
          channelName: channelNames[channel] || `channel ${channel}`,
          noiseFloorDb: -Infinity
        });
        continue;
      }

      // Use selection algorithm to find the cutoff point
      const cutoffIndex = Math.ceil(channelRms.length * quietestPercentile) - 1;
      const cutoffValue = this.quickSelect([...channelRms], cutoffIndex);
      const quietestRms = channelRms.filter(rms => rms <= cutoffValue);

      // Build histogram from quietest windows only
      const channelHistogram = new Array(numBins).fill(0);
      for (const rms of quietestRms) {
        const db = 20 * Math.log10(rms);
        if (db >= minDb) {
          const bin = Math.min(
            Math.floor(((db - minDb) / dbRange) * numBins),
            numBins - 1
          );
          channelHistogram[bin]++;
        }
      }

      // Find the modal bin (peak of histogram)
      let channelModeBin = -1;
      let channelMaxCount = 0;
      for (let i = 0; i < numBins; i++) {
        if (channelHistogram[i] > channelMaxCount) {
          channelMaxCount = channelHistogram[i];
          channelModeBin = i;
        }
      }

      const channelNoiseFloor = channelModeBin === -1
        ? -Infinity
        : channelModeBin * (dbRange / numBins) + minDb;

      perChannelResults.push({
        channelIndex: channel,
        channelName: channelNames[channel] || `channel ${channel}`,
        noiseFloorDb: channelNoiseFloor
      });
    }

    // Overall noise floor calculation
    let overallNoiseFloor = -Infinity;
    if (overallRmsValues.length > 0) {
      const cutoffIndex = Math.ceil(overallRmsValues.length * quietestPercentile) - 1;
      const cutoffValue = this.quickSelect([...overallRmsValues], cutoffIndex);
      const quietestRms = overallRmsValues.filter(rms => rms <= cutoffValue);

      const overallHistogram = new Array(numBins).fill(0);
      for (const rms of quietestRms) {
        const db = 20 * Math.log10(rms);
        if (db >= minDb) {
          const bin = Math.min(
            Math.floor(((db - minDb) / dbRange) * numBins),
            numBins - 1
          );
          overallHistogram[bin]++;
        }
      }

      let overallModeBin = -1;
      let overallMaxCount = 0;
      for (let i = 0; i < numBins; i++) {
        if (overallHistogram[i] > overallMaxCount) {
          overallMaxCount = overallHistogram[i];
          overallModeBin = i;
        }
      }

      overallNoiseFloor = overallModeBin === -1
        ? -Infinity
        : overallModeBin * (dbRange / numBins) + minDb;
    }

    // Calculate digital silence percentage
    const digitalSilencePercentage = numWindows > 0
      ? (digitalSilenceWindows / numWindows) * 100
      : 0;

    return {
      overall: overallNoiseFloor,
      perChannel: perChannelResults,
      hasDigitalSilence: digitalSilenceWindows > 0,
      digitalSilencePercentage: digitalSilencePercentage
    };
  }

  async analyzeNoiseFloor(channelData, channels, length, progressCallback = null) {
    // Hybrid approach: Uses histogram on the quietest 30% of windows to find noise floor.
    // Excludes speech/loud content while capturing actual background noise level.
    const { NUM_BINS, MIN_DB, DB_RANGE, WINDOW_SIZE_MS, QUIETEST_PERCENTILE } = LevelAnalyzer.NOISE_FLOOR_CONFIG;
    const numBins = NUM_BINS;
    const minDb = MIN_DB;
    const dbRange = DB_RANGE;
    // Use fixed reference sample rate (44.1kHz) for noise floor analysis window size
    // 50ms windows at 44.1kHz = 2205 samples
    // This ensures consistent histogram binning across different audio sample rates
    const windowSize = Math.floor(44100 * (WINDOW_SIZE_MS / 1000)); // 50ms windows
    const quietestPercentile = QUIETEST_PERCENTILE;

    // Track digital silence across all channels
    const numWindows = Math.ceil(length / windowSize);
    let digitalSilenceWindows = 0;

    // Collect RMS values for all windows (per-channel and overall)
    const overallRmsValues = [];
    const perChannelRmsValues = [];
    const channelNames = ['left', 'right', 'center', 'LFE', 'surroundLeft', 'surroundRight'];

    // Initialize per-channel arrays
    for (let channel = 0; channel < channels; channel++) {
      perChannelRmsValues.push([]);
    }

    // Pass 1: Calculate RMS for all windows and detect digital silence (70% of noise floor stage)
    let windowCount = 0;
    for (let i = 0; i < length; i += windowSize) {
      if (windowCount++ % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.WINDOW_LOOP === 0) {
        if (!this.analysisInProgress) {
          throw new AnalysisCancelledError('Analysis cancelled', 'noise-floor');
        }
        // Report granular progress for Pass 1 (0-70% of noise floor stage)
        if (progressCallback) {
          const pass1Progress = (i / length) * 0.7; // Pass 1 is 70% of the stage
          const scaledProgress = this.scaleProgress(pass1Progress, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_START, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_END);
          progressCallback('Analyzing noise floor...', scaledProgress);
        }
      }

      const end = Math.min(i + windowSize, length);
      let allChannelsSilent = true;

      for (let channel = 0; channel < channels; channel++) {
        const data = channelData[channel];
        let sumSquares = 0;
        for (let j = i; j < end; j++) {
          sumSquares += data[j] * data[j];
        }
        const rms = Math.sqrt(sumSquares / (end - i));

        if (rms > 0) {
          allChannelsSilent = false;
          perChannelRmsValues[channel].push(rms);
          overallRmsValues.push(rms);
        }
      }

      // Track windows where ALL channels are digital silence
      if (allChannelsSilent) {
        digitalSilenceWindows++;
      }
    }

    // Pass 2: Build histograms from quietest windows (70-100% of noise floor stage)
    const perChannelResults = [];

    for (let channel = 0; channel < channels; channel++) {
      // Report progress for Pass 2
      if (progressCallback) {
        const pass2Progress = 0.7 + (channel / channels) * 0.3; // Pass 2 is 70-100% of the stage
        const scaledProgress = this.scaleProgress(pass2Progress, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_START, LevelAnalyzer.PROGRESS_STAGES.NOISE_FLOOR_END);
        progressCallback('Analyzing noise floor...', scaledProgress);
      }

      const channelRms = perChannelRmsValues[channel];

      if (channelRms.length === 0) {
        // All windows were silence
        perChannelResults.push({
          channelIndex: channel,
          channelName: channelNames[channel] || `channel ${channel}`,
          noiseFloorDb: -Infinity
        });
        continue;
      }

      // Use selection algorithm to find the cutoff point instead of full sort (O(n) vs O(n log n))
      const cutoffIndex = Math.ceil(channelRms.length * quietestPercentile) - 1;
      const cutoffValue = this.quickSelect([...channelRms], cutoffIndex);
      const quietestRms = channelRms.filter(rms => rms <= cutoffValue);

      // Build histogram from quietest windows only
      const channelHistogram = new Array(numBins).fill(0);
      for (const rms of quietestRms) {
        const db = 20 * Math.log10(rms);
        if (db >= minDb) {
          const bin = Math.min(
            Math.floor(((db - minDb) / dbRange) * numBins),
            numBins - 1
          );
          channelHistogram[bin]++;
        }
      }

      // Find the modal bin (peak of histogram)
      let channelModeBin = -1;
      let channelMaxCount = 0;
      for (let i = 0; i < numBins; i++) {
        if (channelHistogram[i] > channelMaxCount) {
          channelMaxCount = channelHistogram[i];
          channelModeBin = i;
        }
      }

      const channelNoiseFloor = channelModeBin === -1
        ? -Infinity
        : channelModeBin * (dbRange / numBins) + minDb;

      perChannelResults.push({
        channelIndex: channel,
        channelName: channelNames[channel] || `channel ${channel}`,
        noiseFloorDb: channelNoiseFloor
      });
    }

    // Overall noise floor calculation
    let overallNoiseFloor = -Infinity;
    if (overallRmsValues.length > 0) {
      // Use selection algorithm to find the cutoff point instead of full sort (O(n) vs O(n log n))
      const cutoffIndex = Math.ceil(overallRmsValues.length * quietestPercentile) - 1;
      const cutoffValue = this.quickSelect([...overallRmsValues], cutoffIndex);
      const quietestRms = overallRmsValues.filter(rms => rms <= cutoffValue);

      const overallHistogram = new Array(numBins).fill(0);
      for (const rms of quietestRms) {
        const db = 20 * Math.log10(rms);
        if (db >= minDb) {
          const bin = Math.min(
            Math.floor(((db - minDb) / dbRange) * numBins),
            numBins - 1
          );
          overallHistogram[bin]++;
        }
      }

      let overallModeBin = -1;
      let overallMaxCount = 0;
      for (let i = 0; i < numBins; i++) {
        if (overallHistogram[i] > overallMaxCount) {
          overallMaxCount = overallHistogram[i];
          overallModeBin = i;
        }
      }

      overallNoiseFloor = overallModeBin === -1
        ? -Infinity
        : overallModeBin * (dbRange / numBins) + minDb;
    }

    // Calculate digital silence percentage
    const digitalSilencePercentage = numWindows > 0
      ? (digitalSilenceWindows / numWindows) * 100
      : 0;

    return {
      overall: overallNoiseFloor,
      perChannel: perChannelResults,
      hasDigitalSilence: digitalSilenceWindows > 0,
      digitalSilencePercentage: digitalSilencePercentage
    };
  }

  checkNormalization(peakDb) {
    const targetDb = -6.0;
    const tolerance = 0.1;

    let status, message;

    if (Math.abs(peakDb - targetDb) <= tolerance) {
      status = 'normalized';
      message = 'Properly normalized';
    } else if (peakDb > targetDb) {
      status = 'too_loud';
      message = 'Too loud';
    } else {
      status = 'too_quiet';
      message = 'Too quiet';
    }

    return {
      status: status,
      message: message,
      peakDb: peakDb,
      targetDb: targetDb
    };
  }

  cancelAnalysis() {
    this.analysisInProgress = false;
  }

  /**
   * Analyzes the stereo separation of an audio buffer.
   * @param {AudioBuffer} audioBuffer The audio buffer to analyze.
   * @returns {object|null} An object with stereo analysis results, or null if not stereo.
   */
  analyzeStereoSeparation(audioBuffer) {
    if (audioBuffer.numberOfChannels !== 2) {
      return null; // Not a stereo file
    }

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    const blockSize = Math.floor(sampleRate * 0.25); // 250ms blocks
    const dominanceRatioThreshold = 1.1; // How much louder one channel must be to be "dominant"
    const silenceThreshold = 0.001; // RMS threshold for silence

    let leftDominantBlocks = 0;
    let rightDominantBlocks = 0;
    let balancedBlocks = 0;
    let silentBlocks = 0;
    let totalBlocks = 0;
    for (let i = 0; i < length; i += blockSize) {
      if (totalBlocks % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.BLOCK_LOOP === 0 && !this.analysisInProgress) {
        throw new AnalysisCancelledError('Analysis cancelled', 'stereo-separation');
      }
      let sumSquaresLeft = 0;
      let sumSquaresRight = 0;
      const blockEnd = Math.min(i + blockSize, length);
      const currentBlockSize = blockEnd - i;

      for (let j = i; j < blockEnd; j++) {
        sumSquaresLeft += leftChannel[j] * leftChannel[j];
        sumSquaresRight += rightChannel[j] * rightChannel[j];
      }

      const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
      const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);

      totalBlocks++;

      if (rmsLeft < silenceThreshold && rmsRight < silenceThreshold) {
        silentBlocks++;
        continue;
      }

      const ratio = rmsLeft / rmsRight;

      if (ratio > dominanceRatioThreshold) {
        leftDominantBlocks++;
      } else if (ratio < 1 / dominanceRatioThreshold) {
        rightDominantBlocks++;
      } else {
        balancedBlocks++;
      }
    }

    const activeBlocks = totalBlocks - silentBlocks;
    let stereoType = 'Undetermined';
    let stereoConfidence = 0;
    let leftPct = 0, rightPct = 0, balancedPct = 0;

    if (activeBlocks > 0) {
      balancedPct = balancedBlocks / activeBlocks;
      leftPct = leftDominantBlocks / activeBlocks;
      rightPct = rightDominantBlocks / activeBlocks;

      if (balancedPct > 0.9) {
        stereoType = 'Mono as Stereo';
        stereoConfidence = balancedPct;
      } else if (leftPct > 0.1 && rightPct > 0.1) {
        stereoType = 'Conversational Stereo';
        // Confidence is based on how much of the audio is separated
        stereoConfidence = leftPct + rightPct;
      } else if (leftPct > 0.9) {
        stereoType = 'Mono in Left Channel';
        stereoConfidence = leftPct;
      } else if (rightPct > 0.9) {
        stereoType = 'Mono in Right Channel';
        stereoConfidence = rightPct;
      } else {
        stereoType = 'Mixed Stereo';
        stereoConfidence = 1 - balancedPct;
      }
    } else {
      stereoType = 'Silent';
      stereoConfidence = 1;
    }

    return {
      totalBlocks,
      activeBlocks,
      silentBlocks,
      leftDominantBlocks,
      rightDominantBlocks,
      balancedBlocks,
      stereoType,
      stereoConfidence: Math.min(stereoConfidence, 1.0) // Cap at 1.0
    };
  }

  /**
   * Analyzes mic bleed in a stereo audio file with conversational audio.
   * Uses hybrid approach: separation ratio + cross-correlation for suspected bleed.
   * @param {AudioBuffer} audioBuffer The audio buffer to analyze.
   * @returns {object|null} An object with mic bleed analysis results, or null if not stereo.
   */
  analyzeMicBleed(audioBuffer) {
    if (audioBuffer.numberOfChannels !== 2) {
      return null; // Not a stereo file
    }

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    const blockSize = Math.floor(sampleRate * 0.25); // 250ms blocks
    const dominanceRatioThreshold = 1.5; // How much louder one channel must be to be "dominant"
    const silenceThreshold = 0.001; // RMS threshold for silence
    const separationThreshold = 15; // dB separation threshold for concern

    // OLD METHOD: Track bleed levels for averaging
    const leftBleedLevels = [];
    const rightBleedLevels = [];

    // NEW METHOD: Track separation ratios and concerning blocks
    const separationRatios = [];
    const concerningBlocks = [];
    let blockCount = 0;

    for (let i = 0; i < length; i += blockSize) {
      if (blockCount++ % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.BLOCK_LOOP === 0 && !this.analysisInProgress) {
        throw new AnalysisCancelledError('Analysis cancelled', 'mic-bleed');
      }
      let sumSquaresLeft = 0;
      let sumSquaresRight = 0;
      const blockEnd = Math.min(i + blockSize, length);
      const currentBlockSize = blockEnd - i;

      for (let j = i; j < blockEnd; j++) {
        sumSquaresLeft += leftChannel[j] * leftChannel[j];
        sumSquaresRight += rightChannel[j] * rightChannel[j];
      }

      const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
      const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);

      if (rmsLeft < silenceThreshold && rmsRight < silenceThreshold) {
        continue; // Skip silent blocks
      }

      const ratio = rmsLeft / rmsRight;

      if (ratio > dominanceRatioThreshold) {
        // Left channel is dominant, measure bleed in the right channel
        const dominantDb = 20 * Math.log10(rmsLeft);
        const bleedDb = rmsRight > 0 ? 20 * Math.log10(rmsRight) : -Infinity;
        const separation = dominantDb - bleedDb;

        // OLD METHOD
        rightBleedLevels.push(rmsRight);

        // NEW METHOD
        separationRatios.push(separation);

        if (separation < separationThreshold) {
          concerningBlocks.push({
            startSample: i,
            endSample: blockEnd,
            dominantChannel: 'left',
            separation: separation,
            dominantRms: rmsLeft,
            bleedRms: rmsRight
          });
        }
      } else if (ratio < 1 / dominanceRatioThreshold) {
        // Right channel is dominant, measure bleed in the left channel
        const dominantDb = 20 * Math.log10(rmsRight);
        const bleedDb = rmsLeft > 0 ? 20 * Math.log10(rmsLeft) : -Infinity;
        const separation = dominantDb - bleedDb;

        // OLD METHOD
        leftBleedLevels.push(rmsLeft);

        // NEW METHOD
        separationRatios.push(separation);

        if (separation < separationThreshold) {
          concerningBlocks.push({
            startSample: i,
            endSample: blockEnd,
            dominantChannel: 'right',
            separation: separation,
            dominantRms: rmsRight,
            bleedRms: rmsLeft
          });
        }
      }
    }

    // OLD METHOD: Calculate average bleed levels
    const calculateAverageDb = (levels) => {
      if (levels.length === 0) {
        return -Infinity;
      }
      const sum = levels.reduce((acc, val) => acc + val, 0);
      const averageRms = sum / levels.length;
      return 20 * Math.log10(averageRms);
    };

    const leftChannelBleedDb = calculateAverageDb(leftBleedLevels);
    const rightChannelBleedDb = calculateAverageDb(rightBleedLevels);

    // NEW METHOD: Calculate separation statistics
    let medianSeparation = -Infinity;
    let p10Separation = -Infinity; // Worst 10%
    let percentagePoorSeparation = 0;

    if (separationRatios.length > 0) {
      const sorted = [...separationRatios].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianSeparation = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;

      const p10Index = Math.floor(sorted.length * 0.1);
      p10Separation = sorted[p10Index];

      const poorCount = separationRatios.filter(s => s < 15).length;
      percentagePoorSeparation = (poorCount / separationRatios.length) * 100;
    }

    // NEW METHOD: Cross-correlation for concerning blocks
    const confirmedBleedBlocks = [];
    const correlationThreshold = 0.3; // Lower threshold for speech correlation

    for (const block of concerningBlocks) {
      const correlation = this.calculateCrossCorrelation(
        leftChannel,
        rightChannel,
        block.startSample,
        block.endSample,
        block.dominantChannel
      );

      if (correlation > correlationThreshold) {
        confirmedBleedBlocks.push({
          ...block,
          correlation: correlation,
          timestamp: block.startSample / sampleRate
        });
      }
    }

    const percentageConfirmedBleed = separationRatios.length > 0
      ? (confirmedBleedBlocks.length / separationRatios.length) * 100
      : 0;

    // Group consecutive blocks into segments for cleaner display
    const bleedSegments = [];
    if (confirmedBleedBlocks.length > 0) {
      // Sort by timestamp
      const sortedBlocks = [...confirmedBleedBlocks].sort((a, b) => a.timestamp - b.timestamp);

      let currentSegment = {
        startTime: sortedBlocks[0].timestamp,
        endTime: sortedBlocks[0].endSample / sampleRate,
        maxCorrelation: sortedBlocks[0].correlation,
        minSeparation: sortedBlocks[0].separation,
        blockCount: 1
      };

      for (let i = 1; i < sortedBlocks.length; i++) {
        const block = sortedBlocks[i];
        const prevBlock = sortedBlocks[i - 1];

        // If blocks are consecutive (within 1 second), merge into same segment
        if (block.timestamp - prevBlock.endSample / sampleRate < 1.0) {
          currentSegment.endTime = block.endSample / sampleRate;
          currentSegment.maxCorrelation = Math.max(currentSegment.maxCorrelation, block.correlation);
          currentSegment.minSeparation = Math.min(currentSegment.minSeparation, block.separation);
          currentSegment.blockCount++;
        } else {
          // Start a new segment
          bleedSegments.push(currentSegment);
          currentSegment = {
            startTime: block.timestamp,
            endTime: block.endSample / sampleRate,
            maxCorrelation: block.correlation,
            minSeparation: block.separation,
            blockCount: 1
          };
        }
      }

      // Push the last segment
      bleedSegments.push(currentSegment);

      // Sort by worst correlation first
      bleedSegments.sort((a, b) => b.maxCorrelation - a.maxCorrelation);
    }

    // Calculate severity score (similar to Channel Consistency)
    // Normalize correlation (0.3-1.0 range) to 0-100 scale
    const avgCorrelation = confirmedBleedBlocks.length > 0
      ? confirmedBleedBlocks.reduce((sum, block) => sum + block.correlation, 0) / confirmedBleedBlocks.length
      : 0;

    // Severity = (percentage of blocks affected) * (normalized correlation score)
    // Higher correlation = worse bleed
    const normalizedCorrelation = Math.min(100, ((avgCorrelation - 0.3) / 0.7) * 100);
    const severityScore = (percentageConfirmedBleed / 100) * normalizedCorrelation;

    return {
      // OLD METHOD results
      old: {
        leftChannelBleedDb,
        rightChannelBleedDb,
        leftBleedSamples: leftBleedLevels.length,
        rightBleedSamples: rightBleedLevels.length,
      },
      // NEW METHOD results
      new: {
        medianSeparation,
        p10Separation,
        percentagePoorSeparation,
        percentageConfirmedBleed,
        totalBlocks: separationRatios.length,
        concerningBlocks: concerningBlocks.length,
        confirmedBleedBlocks: confirmedBleedBlocks.length,
        worstBlocks: confirmedBleedBlocks.slice(0, 5), // Top 5 worst instances
        // NEW: Segment-level details
        bleedSegments: bleedSegments,
        severityScore: severityScore,
        avgCorrelation: avgCorrelation,
        peakCorrelation: confirmedBleedBlocks.length > 0
          ? Math.max(...confirmedBleedBlocks.map(b => b.correlation))
          : 0
      }
    };
  }

  /**
   * Calculates cross-correlation between channels to detect actual bleed vs room noise.
   * @param {Float32Array} leftChannel Left channel audio data
   * @param {Float32Array} rightChannel Right channel audio data
   * @param {number} startSample Start sample index
   * @param {number} endSample End sample index
   * @param {string} dominantChannel Which channel is dominant ('left' or 'right')
   * @returns {number} Correlation coefficient (0-1)
   */
  calculateCrossCorrelation(leftChannel, rightChannel, startSample, endSample, dominantChannel) {
    const blockLength = endSample - startSample;

    // Calculate means
    let sumDominant = 0;
    let sumBleed = 0;
    for (let i = startSample; i < endSample; i++) {
      if (dominantChannel === 'left') {
        sumDominant += leftChannel[i];
        sumBleed += rightChannel[i];
      } else {
        sumDominant += rightChannel[i];
        sumBleed += leftChannel[i];
      }
    }
    const meanDominant = sumDominant / blockLength;
    const meanBleed = sumBleed / blockLength;

    // Calculate correlation
    let numerator = 0;
    let sumSqDominant = 0;
    let sumSqBleed = 0;

    for (let i = startSample; i < endSample; i++) {
      const dominant = dominantChannel === 'left' ? leftChannel[i] : rightChannel[i];
      const bleed = dominantChannel === 'left' ? rightChannel[i] : leftChannel[i];

      const diffDominant = dominant - meanDominant;
      const diffBleed = bleed - meanBleed;

      numerator += diffDominant * diffBleed;
      sumSqDominant += diffDominant * diffDominant;
      sumSqBleed += diffBleed * diffBleed;
    }

    const denominator = Math.sqrt(sumSqDominant * sumSqBleed);

    if (denominator === 0) {
      return 0;
    }

    // Return absolute correlation (we care about correlation regardless of phase)
    return Math.abs(numerator / denominator);
  }

  /**
   * Unified conversational audio analysis (single-pass optimization).
   * Analyzes overlapping speech and channel consistency.
   * @param {AudioBuffer} audioBuffer The audio buffer to analyze.
   * @param {object} noiseFloorData Noise floor data with overall and per-channel values.
   * @param {number} peakDb Peak level in dB.
   * @returns {object|null} Combined analysis results, or null if not stereo.
   */
  analyzeConversationalAudio(audioBuffer, noiseFloorData, peakDb) {
    // Validate inputs
    if (!audioBuffer || audioBuffer.numberOfChannels !== 2) {
      return null;
    }

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Skip very short files (< 1 second)
    if (length < sampleRate) {
      return null;
    }

    // Single pass: calculate RMS blocks once for efficiency
    const blockSize = Math.floor(sampleRate * 0.25); // 250ms blocks
    const rmsBlocks = [];

    for (let i = 0; i < length; i += blockSize) {
      if (rmsBlocks.length % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.BLOCK_LOOP === 0 && !this.analysisInProgress) {
        throw new AnalysisCancelledError('Analysis cancelled', 'conversational');
      }
      const blockEnd = Math.min(i + blockSize, length);
      const currentBlockSize = blockEnd - i;

      let sumSquaresLeft = 0;
      let sumSquaresRight = 0;

      for (let j = i; j < blockEnd; j++) {
        sumSquaresLeft += leftChannel[j] * leftChannel[j];
        sumSquaresRight += rightChannel[j] * rightChannel[j];
      }

      const rmsLeft = Math.sqrt(sumSquaresLeft / currentBlockSize);
      const rmsRight = Math.sqrt(sumSquaresRight / currentBlockSize);

      rmsBlocks.push({ rmsLeft, rmsRight, startSample: i, endSample: blockEnd });
    }

    // Run speech overlap analysis
    const overlap = this.analyzeOverlappingSpeech(noiseFloorData, rmsBlocks);

    return {
      overlap
    };
  }

  /**
   * Analyzes overlapping speech in conversational stereo audio.
   * @param {object} noiseFloorData Noise floor data with overall and per-channel values.
   * @param {Array} rmsBlocks Pre-calculated RMS blocks.
   * @returns {object} Overlap analysis results.
   */
  analyzeOverlappingSpeech(noiseFloorData, rmsBlocks) {
    // Extract per-channel noise floors (or use overall as fallback)
    const leftNoiseFloorDb = noiseFloorData?.perChannel?.[0]?.noiseFloorDb ?? noiseFloorData?.overall ?? -Infinity;
    const rightNoiseFloorDb = noiseFloorData?.perChannel?.[1]?.noiseFloorDb ?? noiseFloorData?.overall ?? -Infinity;

    // Calculate per-channel speech thresholds
    let leftThresholdDb, leftThresholdLinear;
    let rightThresholdDb, rightThresholdLinear;

    // Left channel threshold
    if (leftNoiseFloorDb === -Infinity || !isFinite(leftNoiseFloorDb)) {
      // Digital silence: use absolute threshold at -60 dB (conservative for silence detection)
      leftThresholdDb = -60;
      leftThresholdLinear = Math.pow(10, -60 / 20);
    } else {
      // Normal case: Speech threshold = noise floor + 20 dB (active speech level)
      leftThresholdDb = leftNoiseFloorDb + 20;
      leftThresholdLinear = Math.pow(10, leftThresholdDb / 20);
    }

    // Right channel threshold
    if (rightNoiseFloorDb === -Infinity || !isFinite(rightNoiseFloorDb)) {
      // Digital silence: use absolute threshold at -60 dB (conservative for silence detection)
      rightThresholdDb = -60;
      rightThresholdLinear = Math.pow(10, -60 / 20);
    } else {
      // Normal case: Speech threshold = noise floor + 20 dB (active speech level)
      rightThresholdDb = rightNoiseFloorDb + 20;
      rightThresholdLinear = Math.pow(10, rightThresholdDb / 20);
    }

    const blockDuration = 0.25; // 250ms per block
    const minOverlapDuration = 0.5; // 500ms minimum to count as significant overlap (filters brief interjections)
    const minOverlapBlocks = Math.ceil(minOverlapDuration / blockDuration); // 2 blocks

    // Calculate sample rate from first block
    const sampleRate = rmsBlocks.length > 0
      ? (rmsBlocks[0].endSample - rmsBlocks[0].startSample) / blockDuration
      : 44100; // fallback

    let totalActiveBlocks = 0;
    let overlapBlocks = 0;
    const overlapSegments = [];

    let currentOverlapSegment = null;

    for (let i = 0; i < rmsBlocks.length; i++) {
      if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.BLOCK_LOOP === 0 && !this.analysisInProgress) {
        throw new AnalysisCancelledError('Analysis cancelled', 'overlap-speech');
      }
      const block = rmsBlocks[i];
      const { rmsLeft, rmsRight, startSample, endSample } = block;

      // Check if BOTH channels have active speech using per-channel thresholds
      const leftActive = rmsLeft > leftThresholdLinear;
      const rightActive = rmsRight > rightThresholdLinear;

      if (leftActive || rightActive) {
        totalActiveBlocks++;

        if (leftActive && rightActive) {
          // Overlap detected in this block
          if (currentOverlapSegment === null) {
            // Start a new overlap segment
            currentOverlapSegment = {
              startBlock: i,
              startSample: startSample,
              blockCount: 1
            };
          } else {
            // Continue current overlap segment
            currentOverlapSegment.blockCount++;
          }
        } else {
          // No overlap in this block - end current segment if exists
          if (currentOverlapSegment !== null) {
            // Only count overlaps that meet minimum duration
            if (currentOverlapSegment.blockCount >= minOverlapBlocks) {
              const prevBlock = rmsBlocks[i - 1];
              overlapBlocks += currentOverlapSegment.blockCount;
              overlapSegments.push({
                startTime: currentOverlapSegment.startSample / sampleRate,
                endTime: prevBlock.endSample / sampleRate,
                blockCount: currentOverlapSegment.blockCount,
                duration: currentOverlapSegment.blockCount * blockDuration
              });
            }
            currentOverlapSegment = null;
          }
        }
      } else {
        // No active speech - end overlap segment if exists
        if (currentOverlapSegment !== null) {
          if (currentOverlapSegment.blockCount >= minOverlapBlocks) {
            const prevBlock = rmsBlocks[i - 1];
            overlapBlocks += currentOverlapSegment.blockCount;
            overlapSegments.push({
              startTime: currentOverlapSegment.startSample / sampleRate,
              endTime: prevBlock.endSample / sampleRate,
              blockCount: currentOverlapSegment.blockCount,
              duration: currentOverlapSegment.blockCount * blockDuration
            });
          }
          currentOverlapSegment = null;
        }
      }
    }

    // Handle final overlap segment if file ends during overlap
    if (currentOverlapSegment !== null && currentOverlapSegment.blockCount >= minOverlapBlocks) {
      const lastBlock = rmsBlocks[rmsBlocks.length - 1];
      overlapBlocks += currentOverlapSegment.blockCount;
      overlapSegments.push({
        startTime: currentOverlapSegment.startSample / sampleRate,
        endTime: lastBlock.endSample / sampleRate,
        blockCount: currentOverlapSegment.blockCount,
        duration: currentOverlapSegment.blockCount * blockDuration
      });
    }

    const overlapPercentage = totalActiveBlocks > 0
      ? (overlapBlocks / totalActiveBlocks) * 100
      : 0;

    return {
      totalActiveBlocks,
      overlapBlocks,
      overlapPercentage,
      leftSpeechThresholdDb: leftThresholdDb,
      rightSpeechThresholdDb: rightThresholdDb,
      overlapSegments,
      minOverlapDuration
    };
  }

  /**
   * Finds the k-th smallest element using quickselect algorithm (O(n) average case).
   * More efficient than sorting when only needing a specific percentile.
   * @param {Array} arr Array of numbers
   * @param {number} k Index of the element to find (0-based)
   * @returns {number} The k-th smallest element
   */
  quickSelect(arr, k) {
    if (arr.length === 0) return 0;
    if (k >= arr.length) k = arr.length - 1;
    if (k < 0) k = 0;

    const partition = (left, right, pivotIndex) => {
      const pivotValue = arr[pivotIndex];
      [arr[pivotIndex], arr[right]] = [arr[right], arr[pivotIndex]];
      let storeIndex = left;
      for (let i = left; i < right; i++) {
        if (arr[i] < pivotValue) {
          [arr[storeIndex], arr[i]] = [arr[i], arr[storeIndex]];
          storeIndex++;
        }
      }
      [arr[right], arr[storeIndex]] = [arr[storeIndex], arr[right]];
      return storeIndex;
    };

    const select = (left, right, kTarget) => {
      if (left === right) return arr[left];
      const pivotIndex = Math.floor((left + right) / 2);
      const newPivotIndex = partition(left, right, pivotIndex);
      if (kTarget === newPivotIndex) {
        return arr[kTarget];
      } else if (kTarget < newPivotIndex) {
        return select(left, newPivotIndex - 1, kTarget);
      } else {
        return select(newPivotIndex + 1, right, kTarget);
      }
    };

    return select(0, arr.length - 1, k);
  }

  median(arr) {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);

    // Use quickselect for O(n) performance instead of sorting O(n log n)
    if (arr.length % 2 !== 0) {
      // Odd length: return middle element
      return this.quickSelect([...arr], mid);
    } else {
      // Even length: return average of two middle elements
      const copy = [...arr];
      const lower = this.quickSelect([...copy], mid - 1);
      const upper = this.quickSelect([...copy], mid);
      return (lower + upper) / 2;
    }
  }

  /**
   * OPTIMIZATION: Combined Peak and Clipping Analysis (Phase 1)
   * Combines peak level detection and clipping analysis into a single pass.
   * Reduces experimental analysis time by ~10% by eliminating one full audio scan.
   * @param {AudioBuffer} audioBuffer The audio buffer to analyze.
   * @param {number} sampleRate Sample rate of the audio.
   * @param {function} progressCallback Optional progress callback.
   * @returns {object} Combined results with peak and clipping analysis.
   */
  async analyzePeakAndClipping(audioBuffer, sampleRate, progressCallback = null) {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    // Peak detection variables
    let globalPeak = 0;

    // Clipping detection variables
    const minConsecutiveSamples = Math.max(2, Math.floor(sampleRate / 20000));
    const maxGapSamples = 3;
    const hardClippingThreshold = 0.985;
    const nearClippingThreshold = 0.98;
    const MAX_REGIONS_PER_CHANNEL = 5000;
    const MAX_TOTAL_REGIONS = 10000;
    const MAX_CLIPPED_SAMPLES_PER_CHANNEL = 20000000;

    const channelNames = ['left', 'right', 'center', 'LFE', 'surroundLeft', 'surroundRight'];
    let totalClippedSamples = 0;
    let totalNearClippingSamples = 0;
    const allRegions = [];
    const perChannelStats = [];
    let regionsLimitReached = false;

    // Combined progress reporting (peak detection was 0-15%, clipping was 80-100%)
    // Now combined into peak stage (0-15%) + clipping stage (80-100%)
    const COMBINED_START = LevelAnalyzer.PROGRESS_STAGES.PEAK_START;
    const COMBINED_END = LevelAnalyzer.PROGRESS_STAGES.CLIPPING_END;

    // Process each channel
    for (let channel = 0; channel < channels; channel++) {
      const data = audioBuffer.getChannelData(channel);
      const channelName = channelNames[channel] || `channel${channel}`;

      let channelClippedSamples = 0;
      let channelNearClippingSamples = 0;
      const channelRegions = [];
      let channelHardRegionCount = 0;
      let channelNearRegionCount = 0;

      let currentHardRegion = null;
      let currentNearRegion = null;
      let gapCounter = 0;

      // SINGLE PASS: Detect both peak and clipping
      for (let i = 0; i < length; i++) {
        const absSample = Math.abs(data[i]);

        // PEAK DETECTION (originally separate pass)
        if (absSample > globalPeak) {
          globalPeak = absSample;
        }

        // HARD CLIPPING DETECTION
        if (absSample >= hardClippingThreshold) {
          if (currentHardRegion === null) {
            currentHardRegion = {
              startSample: i,
              endSample: i,
              sampleCount: 1,
              peakSample: absSample,
              type: 'hard',
              channel,
              channelName,
              gapCount: 0
            };
          } else {
            currentHardRegion.endSample = i;
            currentHardRegion.sampleCount++;
            currentHardRegion.peakSample = Math.max(currentHardRegion.peakSample, absSample);
            gapCounter = 0;
          }
          channelClippedSamples++;

          if (channelClippedSamples > MAX_CLIPPED_SAMPLES_PER_CHANNEL) {
            regionsLimitReached = true;
            break;
          }
        } else if (currentHardRegion !== null) {
          gapCounter++;
          if (gapCounter <= maxGapSamples) {
            currentHardRegion.endSample = i;
            currentHardRegion.gapCount++;
          } else {
            if (currentHardRegion.sampleCount >= minConsecutiveSamples) {
              channelHardRegionCount++;
              if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
                channelRegions.push({...currentHardRegion});
              } else {
                regionsLimitReached = true;
              }
            }
            currentHardRegion = null;
            gapCounter = 0;
          }
        }

        // NEAR-CLIPPING DETECTION
        if (absSample >= nearClippingThreshold && absSample < hardClippingThreshold) {
          if (currentNearRegion === null) {
            currentNearRegion = {
              startSample: i,
              endSample: i,
              sampleCount: 1,
              peakSample: absSample,
              type: 'near',
              channel,
              channelName,
              gapCount: 0
            };
          } else {
            currentNearRegion.endSample = i;
            currentNearRegion.sampleCount++;
            currentNearRegion.peakSample = Math.max(currentNearRegion.peakSample, absSample);
          }
          channelNearClippingSamples++;

          if (channelNearClippingSamples > MAX_CLIPPED_SAMPLES_PER_CHANNEL) {
            regionsLimitReached = true;
            break;
          }
        } else if (currentNearRegion !== null && absSample < nearClippingThreshold) {
          if (currentNearRegion.sampleCount >= minConsecutiveSamples) {
            channelNearRegionCount++;
            if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
              channelRegions.push({...currentNearRegion});
            } else {
              regionsLimitReached = true;
            }
          }
          currentNearRegion = null;
        }

        // Progress updates and cancellation checks
        if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.SAMPLE_LOOP === 0) {
          if (!this.analysisInProgress) {
            throw new AnalysisCancelledError('Analysis cancelled', 'peak-clipping-combined');
          }

          if (regionsLimitReached) {
            break;
          }

          if (progressCallback) {
            const stageProgress = (channel * length + i) / (channels * length);
            const scaledProgress = this.scaleProgress(stageProgress, COMBINED_START, COMBINED_END);
            progressCallback('Analyzing peak levels and clipping...', scaledProgress);
          }

          if (i % 100000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      }

      // Handle remaining regions at end of channel
      if (currentHardRegion !== null && currentHardRegion.sampleCount >= minConsecutiveSamples) {
        channelHardRegionCount++;
        if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
          channelRegions.push(currentHardRegion);
        } else {
          regionsLimitReached = true;
        }
      }
      if (currentNearRegion !== null && currentNearRegion.sampleCount >= minConsecutiveSamples) {
        channelNearRegionCount++;
        if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
          channelRegions.push(currentNearRegion);
        } else {
          regionsLimitReached = true;
        }
      }

      // Add timestamps to regions
      channelRegions.forEach(region => {
        region.startTime = region.startSample / sampleRate;
        region.endTime = region.endSample / sampleRate;
        region.duration = region.endTime - region.startTime;
      });

      // Accumulate totals
      totalClippedSamples += channelClippedSamples;
      totalNearClippingSamples += channelNearClippingSamples;

      if (allRegions.length < MAX_TOTAL_REGIONS) {
        const remainingSpace = MAX_TOTAL_REGIONS - allRegions.length;
        const regionsToAdd = channelRegions.slice(0, remainingSpace);
        allRegions.push(...regionsToAdd);
        if (channelRegions.length > remainingSpace) {
          regionsLimitReached = true;
        }
      } else {
        regionsLimitReached = true;
      }

      // Per-channel statistics
      perChannelStats.push({
        channel,
        name: channelName,
        clippedSamples: channelClippedSamples,
        clippedPercentage: (channelClippedSamples / length) * 100,
        nearClippingSamples: channelNearClippingSamples,
        nearClippingPercentage: (channelNearClippingSamples / length) * 100,
        regionCount: channelHardRegionCount + channelNearRegionCount,
        hardClippingRegions: channelHardRegionCount,
        nearClippingRegions: channelNearRegionCount
      });
    }

    // Calculate peak dB
    const peakDb = globalPeak > 0 ? 20 * Math.log10(globalPeak) : -Infinity;

    // Calculate clipping statistics
    const totalSamples = channels * length;
    const clippedPercentage = (totalClippedSamples / totalSamples) * 100;
    const nearClippingPercentage = (totalNearClippingSamples / totalSamples) * 100;

    const hardClippingRegions = allRegions.filter(r => r.type === 'hard');
    const nearClippingRegions = allRegions.filter(r => r.type === 'near');

    hardClippingRegions.sort((a, b) => b.duration - a.duration);
    nearClippingRegions.sort((a, b) => b.duration - a.duration);

    const clippingEventCount = perChannelStats.reduce((sum, ch) => sum + ch.hardClippingRegions, 0);
    const nearClippingEventCount = perChannelStats.reduce((sum, ch) => sum + ch.nearClippingRegions, 0);
    const maxConsecutiveClipped = hardClippingRegions.reduce((max, r) => Math.max(max, r.sampleCount), 0);
    const avgClippingDuration = hardClippingRegions.length > 0
      ? hardClippingRegions.reduce((sum, r) => sum + r.duration, 0) / hardClippingRegions.length
      : 0;

    const clippingRegions = [
      ...hardClippingRegions.slice(0, 10),
      ...nearClippingRegions.slice(0, 5)
    ].sort((a, b) => {
      if (a.type === 'hard' && b.type === 'near') return -1;
      if (a.type === 'near' && b.type === 'hard') return 1;
      return b.duration - a.duration;
    });

    return {
      // Peak analysis results
      globalPeak,
      peakDb,

      // Clipping analysis results
      clippingAnalysis: {
        clippedSamples: totalClippedSamples,
        clippedPercentage,
        nearClippingSamples: totalNearClippingSamples,
        nearClippingPercentage,
        clippingEventCount,
        nearClippingEventCount,
        maxConsecutiveClipped,
        avgClippingDuration,
        perChannel: perChannelStats,
        clippingRegions,
        hardClippingRegions,
        nearClippingRegions,
        regionsLimitReached,
        maxRegionsPerChannel: MAX_REGIONS_PER_CHANNEL,
        maxTotalRegions: MAX_TOTAL_REGIONS
      }
    };
  }

  /**
   * Analyzes clipping in an audio buffer.
   * Detects hard clipping (±1.0) and near-clipping (0.98-0.999) with gap tolerance.
   * NOTE: This method is kept for backwards compatibility but is superseded by analyzePeakAndClipping().
   * @param {AudioBuffer} audioBuffer The audio buffer to analyze.
   * @param {number} sampleRate Sample rate of the audio.
   * @param {function} progressCallback Optional progress callback.
   * @returns {object} Clipping analysis results with per-channel breakdown.
   */
  async analyzeClipping(audioBuffer, sampleRate, progressCallback = null) {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    // Calculate adaptive threshold based on sample rate
    const minConsecutiveSamples = Math.max(2, Math.floor(sampleRate / 20000));
    const maxGapSamples = 3; // Allow up to 3 samples below threshold in a region

    // Thresholds
    // Hard clipping: >= 0.985 (catches severe distortion from over-driven recordings)
    // This is approximately -0.13 dB from full scale
    // Catches clipped audio that was normalized/limited slightly below 0 dB
    const hardClippingThreshold = 0.985;
    const nearClippingThreshold = 0.98;

    // Safety limit: Cap number of regions to prevent memory issues
    const MAX_REGIONS_PER_CHANNEL = 5000; // Reasonable limit for even extreme cases
    const MAX_TOTAL_REGIONS = 10000; // Total regions across all channels
    const MAX_CLIPPED_SAMPLES_PER_CHANNEL = 20000000; // Emergency brake for extreme files

    // Channel names
    const channelNames = ['left', 'right', 'center', 'LFE', 'surroundLeft', 'surroundRight'];

    // Overall statistics
    let totalClippedSamples = 0;
    let totalNearClippingSamples = 0;
    const allRegions = [];
    const perChannelStats = [];
    let regionsLimitReached = false;

    // Process each channel
    for (let channel = 0; channel < channels; channel++) {
      const data = audioBuffer.getChannelData(channel);
      const channelName = channelNames[channel] || `channel${channel}`;

      // Channel-specific counters
      let channelClippedSamples = 0;
      let channelNearClippingSamples = 0;
      const channelRegions = [];

      // Separate counters for region counts (continue counting even after hitting storage limit)
      let channelHardRegionCount = 0;
      let channelNearRegionCount = 0;

      // Tracking variables for region detection
      let currentHardRegion = null;
      let currentNearRegion = null;
      let gapCounter = 0;

      // Iterate through all samples
      for (let i = 0; i < length; i++) {
        const absSample = Math.abs(data[i]);

        // Check for hard clipping (samples >= 0.9999)
        if (absSample >= hardClippingThreshold) {
          if (currentHardRegion === null) {
            // Start new hard clipping region
            currentHardRegion = {
              startSample: i,
              endSample: i,
              sampleCount: 1,
              peakSample: absSample,
              type: 'hard',
              channel,
              channelName,
              gapCount: 0
            };
          } else {
            // Continue current region
            currentHardRegion.endSample = i;
            currentHardRegion.sampleCount++;
            currentHardRegion.peakSample = Math.max(currentHardRegion.peakSample, absSample);
            gapCounter = 0; // Reset gap counter
          }
          channelClippedSamples++;

          // EMERGENCY BRAKE: Bail out if a channel has an excessive number of clipped samples.
          if (channelClippedSamples > MAX_CLIPPED_SAMPLES_PER_CHANNEL) {
            regionsLimitReached = true;
            break;
          }
        } else if (currentHardRegion !== null) {
          // We're in a region but this sample isn't clipped
          gapCounter++;

          if (gapCounter <= maxGapSamples) {
            // Within gap tolerance, continue region
            currentHardRegion.endSample = i;
            currentHardRegion.gapCount++;
          } else {
            // Gap too large, end region
            if (currentHardRegion.sampleCount >= minConsecutiveSamples) {
              // Region is significant enough to record
              channelHardRegionCount++; // Always increment counter

              // Only store region object if we haven't reached the limit
              if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
                channelRegions.push({...currentHardRegion});
              } else {
                regionsLimitReached = true;
              }
            }
            currentHardRegion = null;
            gapCounter = 0;
          }
        }

        // Check for near-clipping (0.98 <= |sample| < 1.0)
        if (absSample >= nearClippingThreshold && absSample < hardClippingThreshold) {
          if (currentNearRegion === null) {
            // Start new near-clipping region
            currentNearRegion = {
              startSample: i,
              endSample: i,
              sampleCount: 1,
              peakSample: absSample,
              type: 'near',
              channel,
              channelName,
              gapCount: 0
            };
          } else {
            // Continue current region
            currentNearRegion.endSample = i;
            currentNearRegion.sampleCount++;
            currentNearRegion.peakSample = Math.max(currentNearRegion.peakSample, absSample);
          }
          channelNearClippingSamples++;

          // EMERGENCY BRAKE: Bail out for excessive near-clipping as well.
          if (channelNearClippingSamples > MAX_CLIPPED_SAMPLES_PER_CHANNEL) {
            regionsLimitReached = true;
            break;
          }
        } else if (currentNearRegion !== null && absSample < nearClippingThreshold) {
          // End near-clipping region (no gap tolerance for near-clipping)
          if (currentNearRegion.sampleCount >= minConsecutiveSamples) {
            channelNearRegionCount++; // Always increment counter

            // Only store region object if we haven't reached the limit
            if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
              channelRegions.push({...currentNearRegion});
            } else {
              regionsLimitReached = true;
            }
          }
          currentNearRegion = null;
        }

        // Progress updates
        if (i % LevelAnalyzer.CANCELLATION_CHECK_INTERVALS.SAMPLE_LOOP === 0) {
          if (!this.analysisInProgress) {
            throw new AnalysisCancelledError('Analysis cancelled', 'clipping');
          }

          // OPTIMIZATION: Bail out early if the region limit is hit.
          if (regionsLimitReached) {
            break;
          }

          // Report granular progress for clipping analysis
          if (progressCallback) {
            const stageProgress = (channel * length + i) / (channels * length);
            const scaledProgress = this.scaleProgress(stageProgress, LevelAnalyzer.PROGRESS_STAGES.CLIPPING_START, LevelAnalyzer.PROGRESS_STAGES.CLIPPING_END);
            progressCallback('Detecting clipping...', scaledProgress);
          }

          // UI yield every 100K samples
          if (i % 100000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      }

      // Handle any remaining regions at end of file
      if (currentHardRegion !== null && currentHardRegion.sampleCount >= minConsecutiveSamples) {
        channelHardRegionCount++; // Always increment counter

        if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
          channelRegions.push(currentHardRegion);
        } else {
          regionsLimitReached = true;
        }
      }
      if (currentNearRegion !== null && currentNearRegion.sampleCount >= minConsecutiveSamples) {
        channelNearRegionCount++; // Always increment counter

        if (channelRegions.length < MAX_REGIONS_PER_CHANNEL) {
          channelRegions.push(currentNearRegion);
        } else {
          regionsLimitReached = true;
        }
      }

      // Add timestamps to regions
      channelRegions.forEach(region => {
        region.startTime = region.startSample / sampleRate;
        region.endTime = region.endSample / sampleRate;
        region.duration = region.endTime - region.startTime;
      });

      // Accumulate totals
      totalClippedSamples += channelClippedSamples;
      totalNearClippingSamples += channelNearClippingSamples;

      // Use concat instead of spread operator to avoid stack overflow with large arrays
      // Check total regions limit before adding
      if (allRegions.length < MAX_TOTAL_REGIONS) {
        const remainingSpace = MAX_TOTAL_REGIONS - allRegions.length;
        const regionsToAdd = channelRegions.slice(0, remainingSpace);
        allRegions.push(...regionsToAdd);

        if (channelRegions.length > remainingSpace) {
          regionsLimitReached = true;
        }
      } else {
        regionsLimitReached = true;
      }

      // Per-channel statistics (use dedicated counters, not filtered array)
      perChannelStats.push({
        channel,
        name: channelName,
        clippedSamples: channelClippedSamples,
        clippedPercentage: (channelClippedSamples / length) * 100,
        nearClippingSamples: channelNearClippingSamples,
        nearClippingPercentage: (channelNearClippingSamples / length) * 100,
        regionCount: channelHardRegionCount + channelNearRegionCount,
        hardClippingRegions: channelHardRegionCount,
        nearClippingRegions: channelNearRegionCount
      });
    }

    // Calculate overall statistics
    const totalSamples = channels * length;
    const clippedPercentage = (totalClippedSamples / totalSamples) * 100;
    const nearClippingPercentage = (totalNearClippingSamples / totalSamples) * 100;

    // Separate hard and near clipping regions
    const hardClippingRegions = allRegions.filter(r => r.type === 'hard');
    const nearClippingRegions = allRegions.filter(r => r.type === 'near');

    // Sort regions by duration (longest first)
    hardClippingRegions.sort((a, b) => b.duration - a.duration);
    nearClippingRegions.sort((a, b) => b.duration - a.duration);

    // Calculate density metrics using dedicated counters (not capped arrays)
    const clippingEventCount = perChannelStats.reduce((sum, ch) => sum + ch.hardClippingRegions, 0);
    const nearClippingEventCount = perChannelStats.reduce((sum, ch) => sum + ch.nearClippingRegions, 0);

    const maxConsecutiveClipped = hardClippingRegions.reduce((max, r) => Math.max(max, r.sampleCount), 0);

    const avgClippingDuration = hardClippingRegions.length > 0
      ? hardClippingRegions.reduce((sum, r) => sum + r.duration, 0) / hardClippingRegions.length
      : 0;

    // Combine regions for sorted list (prioritize hard clipping)
    const clippingRegions = [
      ...hardClippingRegions.slice(0, 10), // Top 10 hard clipping
      ...nearClippingRegions.slice(0, 5)   // Top 5 near clipping
    ].sort((a, b) => {
      // Hard clipping always comes first
      if (a.type === 'hard' && b.type === 'near') return -1;
      if (a.type === 'near' && b.type === 'hard') return 1;
      // Within same type, sort by duration
      return b.duration - a.duration;
    });

    return {
      // Overall statistics
      clippedSamples: totalClippedSamples,
      clippedPercentage,
      nearClippingSamples: totalNearClippingSamples,
      nearClippingPercentage,

      // Density metrics
      clippingEventCount,
      nearClippingEventCount,
      maxConsecutiveClipped,
      avgClippingDuration,

      // Per-channel breakdown
      perChannel: perChannelStats,

      // Detailed regions (top instances only)
      clippingRegions,

      // Separate lists for detailed analysis if needed
      hardClippingRegions,
      nearClippingRegions,

      // Warning flag for extreme clipping cases
      regionsLimitReached,
      maxRegionsPerChannel: MAX_REGIONS_PER_CHANNEL,
      maxTotalRegions: MAX_TOTAL_REGIONS
    };
  }

}