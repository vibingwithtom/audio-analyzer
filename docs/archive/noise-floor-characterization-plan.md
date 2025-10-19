# Action Plan: Noise Floor Characterization for Denoising Detection

## 1. Problem Statement

Modern denoisers are effective at reducing background noise, but they often leave behind subtle digital artifacts that are not captured by a simple noise floor level measurement. To fulfill the client requirement of ensuring no denoisers were used, we need a more sophisticated method to detect these artifacts.

## 2. Solution Design

We will enhance the existing noise floor analysis to not only measure the *level* of the noise but also its *character*. This involves looking for two common artifacts of denoising: unnatural spectral content and overly consistent noise levels.

This will be an advanced experimental feature.

1.  **Metric 1: Spectral Flatness**: Natural room tone or tape hiss has a predictable (non-flat) frequency curve. Aggressive denoising can create an unnaturally flat or "gappy" noise profile. We will measure the spectral flatness of the quietest sections of the audio.

2.  **Metric 2: Noise Level Variance**: Natural noise fluctuates in level. Some denoisers clamp the noise to a fixed level, resulting in an unnaturally low variance. We will measure the standard deviation of the RMS levels of the quietest audio chunks.

*   **Validation**: A new validation function will use a combination of these metrics. For example, if the noise floor is low, AND the spectral flatness is high, AND the noise variance is low, we can flag the file as potentially denoised.

## 3. Implementation Details

### Step 1: Enhance `LevelAnalyzer.js`

The `analyzeNoiseFloor` method will be significantly upgraded.

1.  **Identify Quiet Windows**: The existing logic for finding the quietest 30% of audio windows will be used as the starting point.
2.  **Perform FFT**: For each of these quiet windows, a Fast Fourier Transform (FFT) will be performed to get its frequency spectrum.
3.  **Calculate Spectral Flatness**: From the FFT data, the spectral flatness will be calculated for each window, and then averaged.
4.  **Calculate Noise Variance**: From the RMS values of these same quiet windows, the standard deviation will be calculated.
5.  **Return Values**: The `analyzeNoiseFloor` function will be updated to return an object containing the new metrics alongside the existing ones.

    ```javascript
    // Example structure returned from analyzeNoiseFloor
    return {
      overall: -75.2, // Existing noise floor dB
      // ... other existing properties
      noiseProfile: {
        spectralFlatness: 0.6,
        levelVariance: 0.05
      }
    };
    ```

### Step 2: Add New Validation Logic

A new internal function will be created to interpret the noise profile.

*   **File**: `LevelAnalyzer.js` or `CriteriaValidator.js`
*   **Function**: `interpretNoiseProfile(noiseProfile, noiseFloorDb)`
*   **Logic**: This function will contain the heuristic rules. For example:

    ```javascript
    if (noiseFloorDb < -70 && noiseProfile.spectralFlatness > 0.5 && noiseProfile.levelVariance < 0.1) {
      return "Denoising artifacts suspected";
    }
    return "Natural noise profile";
    ```

### Step 3: Update UI and Export

Since these metrics are highly technical, they will not be displayed directly. Instead, the result of the `interpretNoiseProfile` function will be used.

1.  **`ResultsTable.svelte`**: The existing "Noise Floor" row will be enhanced. If denoising is suspected, a small warning icon will appear next to the dB value. A tooltip on the icon will provide a user-friendly explanation: "The character of the background noise appears unnatural, which may indicate a denoiser was used."

2.  **`export-utils.ts`**: The enhanced CSV export will get a new column, "Denoising Suspected". The value will be a simple "Yes" or "No" based on the analysis.

## 4. Testing Plan

Testing this feature is more complex as it relies on analyzing audio characteristics.

1.  **Synthetic Audio Tests**: Unit tests will be created using synthetically generated audio. One test will use an audio buffer with natural-style pink noise, and another will use a buffer where the noise is artificially flattened and clamped. The tests will assert that the `interpretNoiseProfile` function correctly identifies the unnatural sample.
2.  **Real-World Sample Testing**: Manual testing will be required using a small set of known clean audio files and files that have been intentionally processed with common denoising plugins to fine-tune the detection thresholds.

## 5. Success Criteria

*   The application can successfully analyze and identify audio files with unnatural noise characteristics consistent with denoising.
*   The UI provides a clear, non-technical warning to the user without cluttering the interface with technical data.
*   The enhanced CSV export provides a simple "Yes/No" column for flagging potentially denoised files.
