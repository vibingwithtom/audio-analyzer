<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isSimplifiedMode } from '../stores/simplifiedMode';

  interface FileUploadProps {
    id: string;
    processing?: boolean;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
  }

  let { id, processing = false, accept = 'audio/*', multiple = false, disabled = false }: FileUploadProps = $props();

  const dispatch = createEventDispatcher();

  let isDragging = $state(false);

  let isDisabled = $derived(processing || disabled);

  function handleInputChange(event: Event) {
    console.log('FileUpload handleInputChange', event);
    dispatch('change', event);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!isDisabled) {
      isDragging = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  async function getAllFilesFromEntry(entry: any): Promise<File[]> {
    const files: File[] = [];

    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          // Only include audio files
          if (file.type.startsWith('audio/') || /\.(wav|mp3|flac|m4a|ogg)$/i.test(file.name)) {
            resolve([file]);
          } else {
            resolve([]);
          }
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        const readEntries = async () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length === 0) {
              resolve(files);
              return;
            }

            for (const entry of entries) {
              const entryFiles = await getAllFilesFromEntry(entry);
              files.push(...entryFiles);
            }

            // Continue reading (directories may return entries in batches)
            await readEntries();
          });
        };
        readEntries();
      });
    }

    return files;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    if (isDisabled) return;

    const items = event.dataTransfer?.items;
    const files = event.dataTransfer?.files;

    console.log('Drop event received:', {
      itemsLength: items?.length,
      filesLength: files?.length,
      items: items ? Array.from(items).map(i => ({ kind: i.kind, type: i.type })) : [],
      files: files ? Array.from(files).map(f => f.name) : []
    });

    if (items && items.length > 0) {
      const allFiles: File[] = [];
      let totalDropped = 0;

      // Process all dropped items (files and folders)
      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          totalDropped++;
          const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.();
          if (entry) {
            promises.push(
              getAllFilesFromEntry(entry).then(files => {
                console.log(`Entry ${entry.name} (${entry.isDirectory ? 'dir' : 'file'}): found ${files.length} audio files`);
                return files;
              })
            );
          } else {
            // Fallback for browsers without webkitGetAsEntry
            const file = item.getAsFile();
            if (file) {
              console.log(`Processing file: ${file.name}, type: ${file.type}`);
              if (file.type.startsWith('audio/') || /\.(wav|mp3|flac|m4a|ogg)$/i.test(file.name)) {
                console.log(`Adding audio file: ${file.name}`);
                promises.push(Promise.resolve([file]));
              } else {
                console.log(`Skipping non-audio file: ${file.name}`);
              }
            }
          }
        }
      }

      // Wait for all files to be processed
      const fileArrays = await Promise.all(promises);
      fileArrays.forEach(files => allFiles.push(...files));

      console.log(`Dropped ${totalDropped} items, found ${allFiles.length} audio files`);

      if (allFiles.length > 0) {
        const input = document.getElementById(id) as HTMLInputElement;
        if (input) {
          const dataTransfer = new DataTransfer();

          // Add all files if multiple is enabled, otherwise just the first
          if (multiple) {
            for (const file of allFiles) {
              dataTransfer.items.add(file);
            }
          } else {
            dataTransfer.items.add(allFiles[0]);
          }

          input.files = dataTransfer.files;

          // Dispatch change event
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        // No valid audio files found
        console.warn('No valid audio files found in dropped items');
      }
    }
  }
</script>

<style>
  .file-upload-wrapper {
    margin: 1.5rem 0;
  }

  .drop-zone {
    padding: 2rem;
    border: 2px dashed var(--bg-tertiary, #e0e0e0);
    border-radius: 8px;
    text-align: center;
    background: var(--bg-secondary, #f5f5f5);
    background-image:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(0, 0, 0, 0.04) 10px,
        rgba(0, 0, 0, 0.04) 20px
      );
    transition: all 0.2s ease;
    position: relative;
  }

  .drop-zone::before,
  .drop-zone::after {
    content: '🎵';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 4rem;
    opacity: 0.08;
    pointer-events: none;
  }

  .drop-zone::before {
    left: 20%;
  }

  .drop-zone::after {
    right: 20%;
  }

  .drop-zone.dragging {
    border-color: var(--primary, #2563eb);
    background: rgba(37, 99, 235, 0.05);
    transform: scale(1.01);
  }

  .drop-zone.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .file-upload-label {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: var(--primary, #2563eb);
    color: white;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  .file-upload-label:hover {
    background: var(--primary-dark, #1d4ed8);
    box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  }

  .file-upload-label:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  .file-upload-label.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .file-info {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
  }

  .drop-instruction {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #666666);
  }

  /* Dark mode: lighter stripe pattern */
  :global([data-theme="dark"]) .drop-zone {
    background-image:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255, 255, 255, 0.06) 10px,
        rgba(255, 255, 255, 0.06) 20px
      );
  }
</style>

<div class="file-upload-wrapper">
  <div
    class="drop-zone"
    class:dragging={isDragging}
    class:disabled={isDisabled}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <label for={id} class="file-upload-label" class:disabled={isDisabled}>
      <span>{isDisabled && !processing ? 'Configure preset to enable' : processing ? 'Processing...' : multiple ? 'Choose Audio Files' : 'Choose Audio File'}</span>
    </label>
    <input type="file" {id} {accept} {multiple} onchange={handleInputChange} disabled={isDisabled} class="file-input" />

    <div class="drop-instruction">{isDisabled && !processing ? 'Select a preset in Settings to analyze files' : `or drag and drop ${multiple ? 'files/folders' : 'file'} here`}</div>
  </div>
</div>
