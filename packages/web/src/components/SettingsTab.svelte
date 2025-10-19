<script lang="ts">
  import { availablePresets, currentPresetId, setPreset, selectedPreset, currentCriteria, updateCustomCriteria, hasValidPresetConfig, enableIncludeFailureAnalysis, setIncludeFailureAnalysis, enableIncludeRecommendations, setIncludeRecommendations, peakDetectionMode, setPeakDetectionMode } from '../stores/settings';
  import type { AudioCriteria } from '../settings/types';

  // Custom criteria form state
  let customFileTypes: string[] = [];
  let customSampleRates: string[] = [];
  let customBitDepths: string[] = [];
  let customChannels: string[] = [];
  let customMinDuration: string = '';

  // Load custom criteria when switching to custom preset
  $: if ($currentPresetId === 'custom' && $currentCriteria) {
    customFileTypes = $currentCriteria.fileType || [];
    customSampleRates = $currentCriteria.sampleRate || [];
    customBitDepths = $currentCriteria.bitDepth || [];
    customChannels = $currentCriteria.channels || [];
    customMinDuration = $currentCriteria.minDuration || '';
  }

  function handlePresetChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    setPreset(select.value);
  }

  // Available options for multi-select
  const fileTypeOptions = ['wav', 'mp3', 'flac', 'm4a', 'ogg'];
  const sampleRateOptions = ['44100', '48000', '96000', '192000'];
  const bitDepthOptions = ['16', '24', '32'];
  const channelOptions = ['1', '2', '6', '8'];

  function handleMultiSelect(event: Event, field: 'fileType' | 'sampleRate' | 'bitDepth' | 'channels') {
    const select = event.target as HTMLSelectElement;
    const selectedOptions = Array.from(select.selectedOptions).map(opt => opt.value);

    if (field === 'fileType') customFileTypes = selectedOptions;
    else if (field === 'sampleRate') customSampleRates = selectedOptions;
    else if (field === 'bitDepth') customBitDepths = selectedOptions;
    else if (field === 'channels') customChannels = selectedOptions;

    saveCustomCriteria();
  }

  function handleDurationChange(event: Event) {
    const input = event.target as HTMLInputElement;
    customMinDuration = input.value;
    saveCustomCriteria();
  }

  function saveCustomCriteria() {
    const criteria: AudioCriteria = {
      fileType: customFileTypes,
      sampleRate: customSampleRates,
      bitDepth: customBitDepths,
      channels: customChannels,
      minDuration: customMinDuration
    };
    updateCustomCriteria(criteria);
  }

  // Get preset entries sorted
  $: presetEntries = Object.entries(availablePresets).sort((a, b) => {
    // Put "Custom" at the end
    if (a[0] === 'custom') return 1;
    if (b[0] === 'custom') return -1;
    return a[1].name.localeCompare(b[1].name);
  });
</script>

<style>
  .settings-tab {
    padding: 1.5rem 0;
  }

  .settings-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
  }

  .settings-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #333333);
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #333333);
  }

  .form-group select {
    width: auto;
    min-width: 300px;
    max-width: 500px;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border-color, #b0b0b0);
    border-radius: 8px;
    background: var(--bg-secondary, #ffffff);
    color: var(--text-primary, #333333);
    font-size: 1.05rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
    padding-right: 2.5rem;
  }

  .next-steps {
    margin-top: 1.5rem;
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(76, 175, 80, 0.12) 100%);
    border: 1px solid rgba(76, 175, 80, 0.3);
    border-radius: 8px;
    font-size: 0.95rem;
    color: var(--text-primary, #333333);
  }

  .next-steps strong {
    color: #2e7d32;
  }

  .form-group select:hover {
    border-color: var(--accent-primary, #2563eb);
    background: var(--bg-hover, #eff6ff);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--accent-primary, #2563eb);
    border-width: 2px;
    background: var(--bg-secondary, #ffffff);
    box-shadow: 0 0 0 4px var(--accent-light, rgba(37, 99, 235, 0.15)), 0 4px 8px rgba(37, 99, 235, 0.2);
    transform: translateY(-1px);
  }

  .form-group select option {
    background: var(--bg-secondary, #ffffff);
    color: var(--text-primary, #333333);
    padding: 0.5rem;
  }

  /* Dark mode specific fixes for dropdown */
  :global([data-theme="dark"]) .form-group select {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  :global([data-theme="dark"]) .form-group select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  :global([data-theme="dark"]) .form-group select:hover {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
  }

  :global([data-theme="dark"]) .form-group select:focus {
    background: var(--bg-secondary);
    border-color: var(--accent-primary);
  }

  .preset-info {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-primary, #ffffff);
    border-radius: 4px;
    border-left: 4px solid var(--primary, #2563eb);
  }

  .preset-info h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .preset-info dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem 1rem;
  }

  .preset-info dt {
    font-weight: 500;
    color: var(--text-secondary, #666666);
  }

  .preset-info dd {
    margin: 0;
    color: var(--text-primary, #333333);
  }

  .filename-validation-info {
    margin-top: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.1) 100%);
    border: 1px solid rgba(37, 99, 235, 0.2);
    border-radius: 6px;
  }

  .filename-validation-info h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--primary, #2563eb);
  }

  .filename-validation-info p {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-primary, #333333);
  }

  .filename-validation-info code {
    display: block;
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--bg-tertiary, #e0e0e0);
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--text-primary, #333333);
    overflow-x: auto;
  }

  .filename-validation-info ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .filename-validation-info li {
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .custom-config {
    padding: 1rem;
    background: var(--bg-primary, #ffffff);
    border-radius: 4px;
  }

  .custom-config h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #333333);
  }

  .custom-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .custom-field {
    display: flex;
    flex-direction: column;
  }

  .custom-field label {
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #333333);
    font-size: 0.9rem;
  }

  .custom-field select[multiple],
  .custom-field input {
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    background: var(--bg-primary, #ffffff);
    color: var(--text-primary, #333333);
    font-size: 0.9rem;
    font-family: inherit;
  }

  .custom-field select[multiple] {
    min-height: 120px;
  }

  .custom-field select[multiple]:focus,
  .custom-field input:focus {
    outline: none;
    border-color: var(--accent-primary, #2563eb);
    box-shadow: 0 0 0 3px var(--accent-light, rgba(37, 99, 235, 0.1));
  }

  .field-hint {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-secondary, #666666);
  }

  .duration-field {
    grid-column: 1 / -1;
  }

  .duration-field input {
    max-width: 200px;
  }

  .config-warning {
    margin-bottom: 1rem;
    padding: 0.875rem;
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.15) 100%);
    border: 1px solid rgba(255, 152, 0, 0.3);
    border-radius: 6px;
    font-size: 0.9rem;
    color: var(--text-primary, #333333);
  }

  .config-warning strong {
    color: var(--warning, #ff9800);
  }

  /* Toggle Switch Styles */
  .toggle-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .toggle-item:hover {
    background: var(--bg-hover, #f5f5f5);
    border-color: var(--accent-primary, #2563eb);
  }

  .toggle-label-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toggle-label {
    font-weight: 600;
    color: var(--text-primary, #333333);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toggle-description {
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
  }

  .toggle-switch {
    position: relative;
    display: inline-flex;
    width: 48px;
    height: 28px;
    background: var(--border-color, #e0e0e0);
    border-radius: 14px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    border: none;
    padding: 0;
    flex-shrink: 0;
  }

  .toggle-switch.active {
    background: var(--success, #4CAF50);
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 50%;
    transition: left 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .toggle-switch.active::after {
    left: 22px;
  }

  .export-settings-info {
    margin-top: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.1) 100%);
    border: 1px solid rgba(37, 99, 235, 0.2);
    border-radius: 6px;
    font-size: 0.9rem;
    color: var(--text-primary, #333333);
  }

  .export-settings-info h5 {
    margin: 0 0 0.5rem 0;
    color: var(--primary, #2563eb);
    font-weight: 600;
  }

  .export-settings-info ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .export-settings-info li {
    margin: 0.25rem 0;
  }
</style>

<div class="settings-tab">
  <div class="settings-section">
    <h3>Criteria Presets</h3>

    <div class="form-group">
      <label for="preset-select">Select Preset:</label>
      <select
        id="preset-select"
        value={$currentPresetId}
        on:change={handlePresetChange}
      >
        <!-- Auditions Group -->
        <option value="auditions-bilingual-partner">{availablePresets['auditions-bilingual-partner'].name}</option>
        <option value="auditions-character-recordings">{availablePresets['auditions-character-recordings'].name}</option>
        <option value="auditions-emotional-voice">{availablePresets['auditions-emotional-voice'].name}</option>
        <option value="auditions-studio-ai">{availablePresets['auditions-studio-ai'].name}</option>
        <option disabled>─────────────────────</option>

        <!-- Other Presets -->
        <option value="bilingual-conversational">{availablePresets['bilingual-conversational'].name}</option>
        <option value="character-recordings">{availablePresets['character-recordings'].name}</option>
        <option value="p2b2-pairs-mixed">{availablePresets['p2b2-pairs-mixed'].name}</option>
        <option value="p2b2-pairs-mono">{availablePresets['p2b2-pairs-mono'].name}</option>
        <option value="p2b2-pairs-stereo">{availablePresets['p2b2-pairs-stereo'].name}</option>
        <option value="three-hour">{availablePresets['three-hour'].name}</option>
        <option disabled>─────────────────────</option>

        <!-- Custom -->
        <option value="custom">{availablePresets['custom'].name}</option>
      </select>
    </div>

    {#if $hasValidPresetConfig}
      <div class="next-steps">
        ✓ <strong>Preset configured!</strong> Return to the Local Files, Google Drive, or Box tab to analyze files.
      </div>
    {/if}

    {#if $selectedPreset && $currentPresetId !== 'custom'}
      <div class="preset-info">
        <h4>Preset Requirements</h4>
        <dl>
          {#if $selectedPreset.fileType && $selectedPreset.fileType.length > 0}
            <dt>File Type:</dt>
            <dd>{$selectedPreset.fileType.join(', ').toUpperCase()}</dd>
          {/if}
          {#if $selectedPreset.sampleRate && $selectedPreset.sampleRate.length > 0}
            <dt>Sample Rate:</dt>
            <dd>{$selectedPreset.sampleRate.map(sr => `${parseInt(sr) / 1000} kHz`).join(', ')}</dd>
          {/if}
          {#if $selectedPreset.bitDepth && $selectedPreset.bitDepth.length > 0}
            <dt>Bit Depth:</dt>
            <dd>{$selectedPreset.bitDepth.map(bd => `${bd}-bit`).join(', ')}</dd>
          {/if}
          {#if $selectedPreset.channels && $selectedPreset.channels.length > 0}
            <dt>Channels:</dt>
            <dd>{$selectedPreset.channels.map(ch => ch === '1' ? 'Mono' : ch === '2' ? 'Stereo' : ch).join(', ')}</dd>
          {/if}
          {#if $selectedPreset.minDuration}
            <dt>Min Duration:</dt>
            <dd>{Math.floor(parseInt($selectedPreset.minDuration) / 60)}m {parseInt($selectedPreset.minDuration) % 60}s</dd>
          {/if}
          {#if $selectedPreset.stereoType && $selectedPreset.stereoType.length > 0}
            <dt>Stereo Type:</dt>
            <dd>{$selectedPreset.stereoType.join(', ')}</dd>
          {/if}
          {#if $selectedPreset.maxOverlapWarning !== undefined}
            <dt>Speech Overlap:</dt>
            <dd>
              <strong>Percentage:</strong>
              <br/>
              ✓ Pass: ≤{$selectedPreset.maxOverlapWarning}%
              <br/>
              ⚠️ Warning: >{$selectedPreset.maxOverlapWarning}% - ≤{$selectedPreset.maxOverlapFail}%
              <br/>
              ❌ Fail: >{$selectedPreset.maxOverlapFail}%

              {#if $selectedPreset.maxOverlapSegmentWarning !== undefined}
                <br/><br/>
                <strong>Max Segment Duration:</strong>
                <br/>
                ✓ Pass: ≤{$selectedPreset.maxOverlapSegmentWarning}s
                <br/>
                ⚠️ Warning: >{$selectedPreset.maxOverlapSegmentWarning}s - ≤{$selectedPreset.maxOverlapSegmentFail}s
                <br/>
                ❌ Fail: >{$selectedPreset.maxOverlapSegmentFail}s
              {/if}
            </dd>
          {/if}
          {#if $selectedPreset.supportsFilenameValidation}
            <dt>Filename Validation:</dt>
            <dd>✓ Enabled</dd>
          {/if}
        </dl>

        {#if $selectedPreset.supportsFilenameValidation}
          <div class="filename-validation-info">
            <h5>📋 Filename Format Requirements</h5>

            {#if $selectedPreset.filenameValidationType === 'bilingual-pattern'}
              <p><strong>Bilingual Conversational Format:</strong></p>
              <p>Two accepted patterns:</p>

              <p><strong>1. Scripted recordings:</strong></p>
              <code>[ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav</code>
              <p style="margin-top: 0.5rem; font-size: 0.85rem;">Example: <code style="display: inline; padding: 0.15rem 0.3rem; margin: 0;">conversation123-en-user-001-agent-002.wav</code></p>

              <p style="margin-top: 1rem;"><strong>2. Unscripted/Spontaneous recordings:</strong></p>
              <code>SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav</code>
              <p style="margin-top: 0.5rem; font-size: 0.85rem;">Example: <code style="display: inline; padding: 0.15rem 0.3rem; margin: 0;">SPONTANEOUS_5-en-user-001-agent-002.wav</code></p>

              <p style="margin-top: 1rem;"><strong>Rules:</strong></p>
              <ul>
                <li>All lowercase except "SPONTANEOUS" keyword</li>
                <li>No spaces or special characters</li>
                <li>Language code must be valid (e.g., en, es, fr, de, ja, zh)</li>
                <li>User/Agent IDs must be a valid contributor pair</li>
                <li>Conversation ID must be valid for the language</li>
              </ul>

            {:else if $selectedPreset.filenameValidationType === 'script-match'}
              <p><strong>Three Hour Script Matching Format:</strong></p>
              <code>[scriptName]_[speakerID].wav</code>
              <p style="margin-top: 0.5rem; font-size: 0.85rem;">Example: <code style="display: inline; padding: 0.15rem 0.3rem; margin: 0;">FoxAndCrow_SP001.wav</code></p>

              <p style="margin-top: 1rem; padding: 0.75rem; background: rgba(255, 152, 0, 0.1); border-left: 3px solid var(--warning, #ff9800); border-radius: 4px;">
                <strong>⚠️ Important:</strong> Filename validation for Three Hour preset <strong>only works on the Google Drive tab</strong> with a configured scripts folder. It will not work on Local Files or Box tabs.
              </p>

              <p style="margin-top: 1rem;"><strong>Rules:</strong></p>
              <ul>
                <li>Script name must match a .txt file in the Google Drive scripts folder</li>
                <li>Speaker ID must match the configured speaker ID</li>
                <li>Must be a .wav file</li>
              </ul>
            {/if}
          </div>
        {/if}
      </div>
    {:else if $currentPresetId === 'custom'}
      <div class="custom-config">
        <h4>Custom Criteria Configuration</h4>

        {#if !$hasValidPresetConfig}
          <div class="config-warning">
            ⚠️ <strong>Configuration Required:</strong> You must select at least one criterion to enable file analysis. Choose one or more options below.
          </div>
        {/if}

        <p style="margin-bottom: 1rem; color: var(--text-secondary, #666666); font-size: 0.9rem;">
          Select the criteria you want to validate. Hold Ctrl/Cmd to select multiple options.
        </p>

        <div class="custom-fields">
          <!-- File Type -->
          <div class="custom-field">
            <label for="custom-file-type">File Type:</label>
            <select
              id="custom-file-type"
              multiple
              bind:value={customFileTypes}
              on:change={(e) => handleMultiSelect(e, 'fileType')}
            >
              {#each fileTypeOptions as fileType}
                <option value={fileType}>{fileType.toUpperCase()}</option>
              {/each}
            </select>
            <span class="field-hint">Ctrl/Cmd + Click to select multiple</span>
          </div>

          <!-- Sample Rate -->
          <div class="custom-field">
            <label for="custom-sample-rate">Sample Rate:</label>
            <select
              id="custom-sample-rate"
              multiple
              bind:value={customSampleRates}
              on:change={(e) => handleMultiSelect(e, 'sampleRate')}
            >
              {#each sampleRateOptions as rate}
                <option value={rate}>{parseInt(rate) / 1000} kHz</option>
              {/each}
            </select>
            <span class="field-hint">Ctrl/Cmd + Click to select multiple</span>
          </div>

          <!-- Bit Depth -->
          <div class="custom-field">
            <label for="custom-bit-depth">Bit Depth:</label>
            <select
              id="custom-bit-depth"
              multiple
              bind:value={customBitDepths}
              on:change={(e) => handleMultiSelect(e, 'bitDepth')}
            >
              {#each bitDepthOptions as depth}
                <option value={depth}>{depth}-bit</option>
              {/each}
            </select>
            <span class="field-hint">Ctrl/Cmd + Click to select multiple</span>
          </div>

          <!-- Channels -->
          <div class="custom-field">
            <label for="custom-channels">Channels:</label>
            <select
              id="custom-channels"
              multiple
              bind:value={customChannels}
              on:change={(e) => handleMultiSelect(e, 'channels')}
            >
              {#each channelOptions as channel}
                <option value={channel}>
                  {channel === '1' ? 'Mono (1)' : channel === '2' ? 'Stereo (2)' : channel === '6' ? '5.1 Surround (6)' : `7.1 Surround (${channel})`}
                </option>
              {/each}
            </select>
            <span class="field-hint">Ctrl/Cmd + Click to select multiple</span>
          </div>

          <!-- Min Duration -->
          <div class="custom-field duration-field">
            <label for="custom-min-duration">Minimum Duration (seconds):</label>
            <input
              id="custom-min-duration"
              type="number"
              min="0"
              placeholder="e.g., 120 for 2 minutes"
              bind:value={customMinDuration}
              on:input={handleDurationChange}
            />
            <span class="field-hint">Leave empty for no minimum duration requirement</span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Export Settings Section -->
  <div class="settings-section">
    <h3>Export Settings</h3>

    <p style="margin-bottom: 1rem; color: var(--text-secondary, #666666); font-size: 0.9rem;">
      Customize what information is included in your CSV exports. When both options are disabled, standard exports will be used.
    </p>

    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <!-- Failure Analysis Toggle -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--bg-primary, #ffffff); border-radius: 4px; border: 1px solid var(--border-color, #e0e0e0);">
        <div>
          <div style="font-weight: 500; color: var(--text-primary, #333333);">Include Failure Analysis</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary, #666666); margin-top: 0.25rem;">Multi-level issue detection (technical specs, quality issues)</div>
        </div>
        <button
          class="toggle-switch"
          class:active={$enableIncludeFailureAnalysis}
          on:click={() => setIncludeFailureAnalysis(!$enableIncludeFailureAnalysis)}
          aria-label="Toggle failure analysis"
          aria-pressed={$enableIncludeFailureAnalysis}
        ></button>
      </div>

      <!-- Recommendations Toggle -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--bg-primary, #ffffff); border-radius: 4px; border: 1px solid var(--border-color, #e0e0e0);">
        <div>
          <div style="font-weight: 500; color: var(--text-primary, #333333);">Include Recommendations</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary, #666666); margin-top: 0.25rem;">Context-aware suggestions for fixing problems</div>
        </div>
        <button
          class="toggle-switch"
          class:active={$enableIncludeRecommendations}
          on:click={() => setIncludeRecommendations(!$enableIncludeRecommendations)}
          aria-label="Toggle recommendations"
          aria-pressed={$enableIncludeRecommendations}
        ></button>
      </div>

      <!-- Peak Detection Mode Toggle -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--bg-primary, #ffffff); border-radius: 4px; border: 1px solid var(--border-color, #e0e0e0);">
        <div style="flex: 1;">
          <div style="font-weight: 500; color: var(--text-primary, #333333);">Fast Peak Detection (Experimental)</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary, #666666); margin-top: 0.25rem;">
            {#if $peakDetectionMode === 'fast'}
              ⚡ Speed mode: 90%+ faster analysis (~0.1-0.5dB tolerance)
            {:else}
              🎯 Accurate mode: 100% precise peak detection (slower)
            {/if}
          </div>
        </div>
        <button
          class="toggle-switch"
          class:active={$peakDetectionMode === 'fast'}
          on:click={() => setPeakDetectionMode($peakDetectionMode === 'fast' ? 'accurate' : 'fast')}
          aria-label="Toggle peak detection mode"
          aria-pressed={$peakDetectionMode === 'fast'}
        ></button>
      </div>
    </div>
  </div>
</div>
