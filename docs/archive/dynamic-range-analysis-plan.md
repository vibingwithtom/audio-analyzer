# Action Plan: Dynamic Range Analysis for Compression Detection

## 1. Problem Statement

The client requires that submitted audio files have no processing, including dynamic range compression. Compression reduces the difference between the loudest and quietest parts of the audio, and detecting it is key to ensuring the audio is natural and unprocessed. The current toolset does not have a direct way to measure this.

## 2. Solution Design

We will introduce a new experimental metric called **Peak-to-Loudness Ratio (PLR)**, also known as Crest Factor. This metric is excellent for estimating the extent of dynamic range compression.

*   **Metric Definition**: PLR is the difference between the audio's peak level and its average loudness (RMS level).
    *   `PLR (dB) = PeakLevel (dB) - AverageLoudness (dB)`
*   **Interpretation**: Unprocessed spoken-word audio has a high PLR, while heavily compressed audio has a low PLR.
*   **Validation**: We will establish thresholds to classify the dynamic range:
    *   **Pass (Natural)**: PLR > 12 dB
    *   **Warning (Possibly Compressed)**: 8 dB < PLR ≤ 12 dB
    *   **Fail (Heavily Compressed)**: PLR ≤ 8 dB

This will be an experimental feature and will not affect the overall pass/fail status of a file unless specifically configured in a future preset.

## 3. Implementation Details

### Step 1: Update `LevelAnalyzer.js`

The core logic will be added to the `LevelAnalyzer` to calculate the overall loudness and PLR.

1.  **Calculate Average Loudness (RMS)**: In the `analyzeAudioBuffer` method, after the peak analysis is complete, a new pass over the audio data will be made to calculate the total RMS (Root Mean Square) loudness of the entire file.

2.  **Calculate PLR**: Using the existing `peakDb` and the new `averageLoudnessDb`, calculate the PLR.

3.  **Return Value**: The `analyzeAudioBuffer` function will return a new object `dynamicRange` containing the calculated values.

    ```javascript
    // Example structure returned from analyzeAudioBuffer
    results.dynamicRange = {
      averageLoudnessDb: -24.5,
      plr: 15.2
    };
    ```

### Step 2: Update `ResultsTable.svelte`

The UI will be updated to display this new information in the experimental analysis section.

1.  **Add New Row**: A new row titled "Dynamic Range (PLR)" will be added.
2.  **Display Metric**: It will display the PLR value (e.g., "15.2 dB").
3.  **Display Interpretation**: A descriptive label based on the validation thresholds will be shown (e.g., "Natural", "Possibly Compressed", "Heavily Compressed").

### Step 3: Update `export-utils.ts`

The enhanced CSV export will be updated to include the new metric.

1.  **Add Column**: A new column "Dynamic Range (PLR)" will be added to the experimental export.
2.  **Populate Data**: The `extractEnhancedDataRow` function will be updated to include the `plr` value and its interpretation.

## 4. Testing Plan

1.  **Unit Tests**: New tests will be created to validate the RMS loudness calculation against known audio samples.
2.  **Threshold Tests**: Unit tests will be written for the PLR validation logic to ensure that values are correctly classified as Natural, Possibly Compressed, or Heavily Compressed.
3.  **Integration Tests**: An existing test will be updated to verify that the PLR value appears correctly in the enhanced CSV export.

## 5. Success Criteria

*   The application correctly calculates and displays the PLR for all analyzed files.
*   The UI provides a clear, user-friendly interpretation of the PLR value.
*   The enhanced CSV export includes the new PLR metric and its interpretation.
