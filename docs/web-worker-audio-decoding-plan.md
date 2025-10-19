# Web Worker Audio Decoding Implementation Plan

## Problem Statement

During batch processing of audio files, the browser freezes for ~5 seconds approximately every 8-11 files. This is caused by:
- `audioContext.decodeAudioData()` allocating ~250MB AudioBuffers per file
- Browser garbage collection running synchronously during memory allocation
- All processing happening on the main UI thread

**Current Impact:**
- 5-second UI freezes every ~8-11 files
- Poor user experience despite 60% performance improvement
- Worse on low-memory machines

## Proposed Solution: Web Workers

Move audio decoding and analysis to Web Workers, keeping the main thread free for UI updates.

## Architecture Overview

```
Main Thread                    Worker Thread(s)
-----------                    ----------------
LocalFileTab.svelte ---------> audio-worker.js
     |                              |
     ├─ Send arrayBuffer ────────> │
     |                              ├─ decodeAudioData()
     ├─ Update UI                   ├─ Run analysis
     |                              ├─ Return results
     ├─ Receive results <────────── │
     |
     └─ Display results
```

## Implementation Plan

### Phase 1: Create Basic Worker Infrastructure

#### 1.1 Create Worker File
**File:** `/packages/web/src/workers/audio-analysis-worker.js`

```javascript
// Import necessary modules
import { LevelAnalyzer } from '@audio-analyzer/core';

// Message handler
self.onmessage = async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'ANALYZE_FILE':
      await analyzeFile(data);
      break;
    case 'CANCEL':
      // Handle cancellation
      break;
  }
};

async function analyzeFile({ arrayBuffer, filename, config }) {
  try {
    // Report progress
    self.postMessage({
      type: 'PROGRESS',
      data: { filename, stage: 'decoding', progress: 0 }
    });

    // Decode audio (this is where the freeze currently happens)
    const audioContext = new OfflineAudioContext(2, 1, 44100);
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Run analysis
    self.postMessage({
      type: 'PROGRESS',
      data: { filename, stage: 'analyzing', progress: 0.5 }
    });

    const analyzer = new LevelAnalyzer();
    const results = await analyzer.analyzeAudioBuffer(
      audioBuffer,
      null, // progressCallback - need to adapt for worker
      true, // includeExperimental
      config.peakDetectionMode
    );

    // Send results back
    self.postMessage({
      type: 'RESULT',
      data: { filename, results }
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { filename, error: error.message }
    });
  }
}
```

#### 1.2 Create Worker Manager
**File:** `/packages/web/src/services/worker-pool-manager.ts`

```typescript
export class WorkerPoolManager {
  private workers: Worker[] = [];
  private queue: QueueItem[] = [];
  private busyWorkers = new Set<Worker>();

  constructor(poolSize: number = navigator.hardwareConcurrency || 4) {
    // Create worker pool
    for (let i = 0; i < Math.min(poolSize, 4); i++) {
      const worker = new Worker('/workers/audio-analysis-worker.js');
      this.workers.push(worker);
    }
  }

  async analyzeFile(file: File, config: AnalysisConfig): Promise<AudioResults> {
    const worker = await this.getAvailableWorker();

    return new Promise((resolve, reject) => {
      worker.onmessage = (event) => {
        const { type, data } = event.data;

        switch (type) {
          case 'RESULT':
            this.releaseWorker(worker);
            resolve(data.results);
            break;
          case 'ERROR':
            this.releaseWorker(worker);
            reject(new Error(data.error));
            break;
          case 'PROGRESS':
            // Handle progress updates
            break;
        }
      };

      // Send work to worker
      const arrayBuffer = await file.arrayBuffer();
      worker.postMessage({
        type: 'ANALYZE_FILE',
        data: { arrayBuffer, filename: file.name, config }
      }, [arrayBuffer]); // Transfer ownership!
    });
  }
}
```

### Phase 2: Integrate with Existing Code

#### 2.1 Modify audio-analysis-service.ts

```typescript
// Add worker pool option
const workerPool = new WorkerPoolManager();

export async function analyzeAudioFile(
  file: File | Blob,
  options: AnalysisOptions
): Promise<AudioResults> {
  // Check if we should use worker
  const useWorker = options.useWorker && file.size > 10 * 1024 * 1024; // Use worker for files > 10MB

  if (useWorker && options.analysisMode === 'experimental') {
    // Use worker path
    return await workerPool.analyzeFile(file, {
      peakDetectionMode: SettingsManager.getPeakDetectionMode(),
      // ... other config
    });
  } else {
    // Use existing main thread path
    // ... existing code
  }
}
```

#### 2.2 Update LocalFileTab.svelte

```javascript
// Enable worker for batch processing
const result = await processSingleFile(file, true, progressCallback, {
  useWorker: isBatchMode // Use workers for batch, main thread for single files
});
```

### Phase 3: Handle Edge Cases

#### 3.1 Progress Reporting
- Worker sends progress messages
- Main thread updates UI
- Maintain smooth progress bar

#### 3.2 Cancellation
- Add cancellation support to workers
- Clean up on cancel
- Properly terminate workers if needed

#### 3.3 Error Handling
- Catch worker crashes
- Fallback to main thread processing
- Report errors appropriately

### Phase 4: Optimization

#### 4.1 Worker Pool Sizing
```javascript
// Determine optimal pool size
function getOptimalPoolSize() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (performance as any).memory?.jsHeapSizeLimit;

  if (memory && memory < 2 * 1024 * 1024 * 1024) {
    return Math.min(2, cores); // Low memory: max 2 workers
  }

  return Math.min(4, cores); // Normal: max 4 workers
}
```

#### 4.2 Memory Transfer Optimization
```javascript
// Transfer ArrayBuffer ownership to avoid copying
worker.postMessage(
  { type: 'ANALYZE', data: arrayBuffer },
  [arrayBuffer] // Transferable object - moves, not copies!
);
```

## Benefits

1. **No UI Freezes**: GC pauses happen in worker threads, not main thread
2. **Parallel Processing**: Can process multiple files simultaneously
3. **Better Resource Usage**: Utilizes multiple CPU cores
4. **Improved Responsiveness**: UI remains responsive during processing

## Potential Challenges

### 1. Module Loading in Workers
**Challenge**: Workers can't use ES modules in all browsers
**Solution**: Bundle worker code with Vite or use importScripts()

### 2. AudioContext in Workers
**Challenge**: Not all browsers support AudioContext in workers
**Solution**: Feature detection and fallback to main thread

```javascript
// Feature detection
const supportsAudioInWorker = 'OfflineAudioContext' in self;
```

### 3. Shared Memory
**Challenge**: Can't share AudioBuffer directly between threads
**Solution**: Transfer typed arrays or use SharedArrayBuffer (requires CORS headers)

### 4. Progress Reporting
**Challenge**: Progress callbacks don't work across thread boundaries
**Solution**: PostMessage-based progress reporting

## Testing Plan

1. **Unit Tests**
   - Test worker message handling
   - Test error scenarios
   - Test cancellation

2. **Integration Tests**
   - Test single file processing
   - Test batch processing
   - Test mixed workloads

3. **Performance Tests**
   - Measure time to process 137 files
   - Monitor memory usage
   - Check for UI responsiveness

4. **Browser Compatibility**
   - Chrome/Edge
   - Firefox
   - Safari (may have limitations)

## Rollout Strategy

1. **Feature Flag**: Add setting to enable/disable worker processing
2. **Gradual Rollout**:
   - Start with batch processing only
   - Monitor for issues
   - Expand to all processing if stable
3. **Fallback**: Automatic fallback to main thread if workers fail

## Success Metrics

- **Freeze Elimination**: No UI freezes > 100ms during batch processing
- **Performance**: Maintain 60% speed improvement from fast mode
- **Memory**: Reduce peak memory usage by 30%
- **User Experience**: Smooth progress updates throughout processing

## Implementation Timeline

1. **Day 1**: Create basic worker and manager (Phase 1)
2. **Day 2**: Integrate with existing code (Phase 2)
3. **Day 3**: Handle edge cases (Phase 3)
4. **Day 4**: Testing and optimization (Phase 4)
5. **Day 5**: Final testing and deployment

## Alternative Approach (If Workers Don't Work)

If Web Workers prove problematic, consider:

1. **Streaming Decoding**: Process audio in chunks rather than all at once
2. **WebAssembly**: Use WASM for decoding (more control over memory)
3. **IndexedDB Caching**: Cache decoded audio to avoid re-decoding
4. **Server-Side Processing**: For large batches, upload and process server-side

## Questions to Resolve

1. Should we use a worker pool or single worker?
2. How many files should we process in parallel?
3. Should we make this opt-in or default behavior?
4. How do we handle progress reporting for parallel processing?
5. What's the fallback strategy if workers aren't supported?