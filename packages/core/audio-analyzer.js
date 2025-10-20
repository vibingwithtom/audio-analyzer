/**
 * Core Audio Analysis Engine
 * Shared between Chrome Extension and Desktop Application
 */

export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
  }

  // WAV format constants
  static WAVE_FORMAT_PCM = 1;
  static WAVE_FORMAT_EXTENSIBLE = 65534; // 0xFFFE
  static WAVE_FORMAT_NON_PCM_MARKER = -1; // Internal marker for non-PCM extensible formats
  static EXTENSIBLE_FMT_MIN_SIZE = 36; // Minimum bytes needed to read SubFormat GUID

  /**
   * Get the actual file size, checking for partial downloads
   * Google Drive/Box store actual size in file.actualSize for partial downloads
   */
  getActualFileSize(file) {
    return file.actualSize || file.size;
  }

  async analyzeFile(file) {
    const arrayBuffer = await file.arrayBuffer();

    // For WAV files, parse headers first for accurate bit depth
    if (file.name.toLowerCase().endsWith('.wav')) {
      const view = new DataView(arrayBuffer);
      const wavInfo = this.parseWavHeaders(view);

      let fileType = this.getFileType(file.name);
      if (fileType === 'WAV') {
        if (wavInfo.audioFormat === AudioAnalyzer.WAVE_FORMAT_PCM) {
          fileType = 'WAV (PCM)';
        } else if (wavInfo.audioFormat === AudioAnalyzer.WAVE_FORMAT_NON_PCM_MARKER) {
          fileType = 'WAV (Not PCM)';
        } else if (typeof wavInfo.audioFormat === 'number') {
          fileType = `WAV (Compressed - Format ${wavInfo.audioFormat})`;
        } else {
          // WAV header parsing failed - check actual file type from header
          const detectedType = this.detectFileTypeFromHeader(view);
          if (detectedType && detectedType !== 'WAV') {
            // File has wrong extension - fall through to decode with Web Audio API
            // which can handle M4A, MP3, etc. We'll use the detected type for the label.
            fileType = `${detectedType} (wrong extension)`;
            // Don't return here - fall through to Web Audio API decoding below
          } else {
            fileType = 'Unknown Format';
            // Truly unknown format - return with Unknown values
            return {
              fileType: fileType,
              sampleRate: wavInfo.sampleRate,
              channels: wavInfo.channels,
              bitDepth: wavInfo.bitDepth,
              duration: wavInfo.duration,
              fileSize: this.getActualFileSize(file)
            };
          }
        }
      }

      // Only return here if we successfully parsed WAV headers
      if (fileType.startsWith('WAV')) {
        return {
          fileType: fileType,
          sampleRate: wavInfo.sampleRate,
          channels: wavInfo.channels,
          bitDepth: wavInfo.bitDepth,
          duration: wavInfo.duration,
          fileSize: this.getActualFileSize(file)
        };
      }

      // For misnamed files (e.g., M4A with .wav extension), continue to Web Audio API decoding
      // Store the detected file type to use later
      this._detectedFileType = fileType;
    }

    // Initialize audio context if needed
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    try {
      // decodeAudioData consumes/detaches the ArrayBuffer, so make a copy for fallback
      const arrayBufferCopy = arrayBuffer.slice(0);
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBufferCopy);

      // Use detected file type if we found one (e.g., M4A with .wav extension)
      // Otherwise use file type from extension
      const fileType = this._detectedFileType || this.getFileType(file.name);

      // Clear the detected file type for next analysis
      this._detectedFileType = null;

      return {
        fileType: fileType,
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels,
        duration: this.audioBuffer.duration,
        fileSize: this.getActualFileSize(file),
        bitDepth: this.estimateBitDepth(arrayBuffer, file.name, fileType)
      };
    } catch (error) {
      // Clear detected file type on error
      this._detectedFileType = null;

      // Fallback to header analysis using the original arrayBuffer
      return await this.analyzeFileHeaders(arrayBuffer, file.name, this.getActualFileSize(file));
    }
  }

  async analyzeFileHeaders(arrayBuffer, fileName, fileSize) {
    const view = new DataView(arrayBuffer);

    // Start with file type from extension
    let fileType = this.getFileType(fileName);

    // For .wav files, check if they're actually WAV or misnamed
    if (fileName.toLowerCase().endsWith('.wav')) {
      const wavInfo = this.parseWavHeaders(view);

      // If WAV parsing succeeded, it's a real WAV file
      if (wavInfo.audioFormat === AudioAnalyzer.WAVE_FORMAT_PCM) {
        fileType = 'WAV (PCM)';
      } else if (wavInfo.audioFormat === AudioAnalyzer.WAVE_FORMAT_NON_PCM_MARKER) {
        fileType = 'WAV (Not PCM)';
      } else if (typeof wavInfo.audioFormat === 'number') {
        fileType = `WAV (Compressed - Format ${wavInfo.audioFormat})`;
      } else {
        // WAV parsing failed - check actual file type from header
        const detectedType = this.detectFileTypeFromHeader(view);
        if (detectedType && detectedType !== 'WAV') {
          fileType = `${detectedType} (wrong extension)`;
        } else {
          fileType = 'Unknown Format';
        }
      }

      return {
        fileType: fileType,
        sampleRate: wavInfo.sampleRate,
        channels: wavInfo.channels,
        bitDepth: wavInfo.bitDepth,
        duration: wavInfo.duration,
        fileSize: fileSize
      };
    } else {
      // Non-WAV file
      return {
        fileType: fileType,
        sampleRate: 'Unknown',
        bitDepth: 'Unknown',
        channels: 'Unknown',
        duration: 'Unknown',
        fileSize: fileSize
      };
    }
  }

  parseWavHeaders(view) {
    try {
      // Check for RIFF header
      const riffHeader = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      if (riffHeader !== 'RIFF') {
        throw new Error('Not a valid WAV file');
      }

      // Check for WAVE format
      const waveHeader = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      if (waveHeader !== 'WAVE') {
        throw new Error('Not a valid WAV file');
      }

      // Find fmt chunk
      let offset = 12;
      while (offset < view.byteLength - 8) {
        const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
        const chunkSize = view.getUint32(offset + 4, true);

        if (chunkId === 'fmt ') {
          let audioFormat = view.getUint16(offset + 8, true);
          const channels = view.getUint16(offset + 10, true);
          const sampleRate = view.getUint32(offset + 12, true);
          const bitsPerSample = view.getUint16(offset + 22, true);

          // Handle WAVE_FORMAT_EXTENSIBLE (format 65534 / 0xFFFE)
          // For extensible format, read the SubFormat GUID to get the actual format
          if (audioFormat === AudioAnalyzer.WAVE_FORMAT_EXTENSIBLE) {
            // ExtensibleFormat has:
            // offset + 24: extsize (2 bytes)
            // offset + 26: validbits (2 bytes)
            // offset + 28: channelmask (4 bytes)
            // offset + 32: SubFormat GUID (16 bytes)

            // Read the first 4 bytes of SubFormat GUID (little-endian format code)
            if (offset + AudioAnalyzer.EXTENSIBLE_FMT_MIN_SIZE <= view.byteLength) {
              const subFormatCode = view.getUint32(offset + 32, true);
              // 0x00000001 = PCM (uncompressed)
              if (subFormatCode === 1) {
                audioFormat = AudioAnalyzer.WAVE_FORMAT_PCM; // Treat as standard PCM format
              } else {
                // Other SubFormat codes (ADPCM, ALAW, MULAW, etc.)
                // Mark as non-PCM so it shows "WAV (Not PCM)" and triggers warnings
                audioFormat = AudioAnalyzer.WAVE_FORMAT_NON_PCM_MARKER;
              }
              // Common SubFormat codes:
              // 0x00000002 = ADPCM
              // 0x00000006 = ALAW
              // 0x00000007 = MULAW
              // 0xFFFE = deprecated, shouldn't appear here
            }
          }

          // Calculate duration from data chunk
          const duration = this.calculateWavDuration(view, sampleRate, channels, bitsPerSample);

          return {
            sampleRate: sampleRate,
            channels: channels,
            bitDepth: bitsPerSample,
            duration: duration,
            audioFormat: audioFormat
          };
        }

        offset += 8 + chunkSize;
      }

      throw new Error('fmt chunk not found');
    } catch (error) {
      console.error('Error parsing WAV headers:', error);
      return {
        sampleRate: 'Unknown',
        channels: 'Unknown',
        bitDepth: 'Unknown',
        duration: 'Unknown',
        audioFormat: 'Unknown'
      };
    }
  }

  calculateWavDuration(view, sampleRate, channels, bitsPerSample) {
    try {
      // Find data chunk
      let offset = 12;
      while (offset < view.byteLength - 8) {
        const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
        const chunkSize = view.getUint32(offset + 4, true);

        if (chunkId === 'data') {
          const bytesPerSample = bitsPerSample / 8;
          const totalSamples = chunkSize / (channels * bytesPerSample);
          return totalSamples / sampleRate;
        }

        offset += 8 + chunkSize;
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Detect actual file type from file header bytes (magic numbers)
   * Returns null if file type cannot be determined from header
   */
  detectFileTypeFromHeader(view) {
    try {
      // Check first 12 bytes for common audio file signatures
      const bytes = [];
      for (let i = 0; i < Math.min(12, view.byteLength); i++) {
        bytes.push(view.getUint8(i));
      }

      // RIFF/WAV: 'RIFF' + size + 'WAVE'
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
        return 'WAV';
      }

      // MP3: ID3 tag or MPEG frame sync
      if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // 'ID3'
          (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) { // MPEG frame sync
        return 'MP3';
      }

      // FLAC: 'fLaC'
      if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
        return 'FLAC';
      }

      // M4A/AAC: 'ftyp' (MP4 container)
      if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        // Check for M4A brand markers
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (brand === 'M4A ' || brand === 'M4A' || brand === 'mp42' || brand === 'isom') {
          return 'M4A';
        }
        return 'AAC'; // Generic MP4 audio
      }

      // OGG: 'OggS'
      if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        return 'OGG';
      }

      return null; // Unknown file type
    } catch (error) {
      return null;
    }
  }

  getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'wav': 'WAV',
      'mp3': 'MP3',
      'flac': 'FLAC',
      'aac': 'AAC',
      'm4a': 'M4A',
      'ogg': 'OGG',
      'webm': 'WebM'
    };
    return typeMap[extension] || extension.toUpperCase();
  }

  estimateBitDepth(arrayBuffer, filename, actualFileType) {
    // If actual file type is provided, use that instead of filename extension
    if (actualFileType) {
      // Extract the base type (e.g., "M4A" from "M4A (wrong extension)")
      const baseType = actualFileType.split(' ')[0].toLowerCase();

      if (baseType === 'wav') {
        return 'See WAV analysis';
      }

      if (['mp3', 'aac', 'm4a'].includes(baseType)) {
        return 'Compressed (variable)';
      }

      return 'Unknown';
    }

    // Fallback to filename extension if no actual type provided
    if (filename.toLowerCase().endsWith('.wav')) {
      return 'See WAV analysis';
    }

    const extension = filename.split('.').pop().toLowerCase();
    if (['mp3', 'aac', 'm4a'].includes(extension)) {
      return 'Compressed (variable)';
    }

    return 'Unknown';
  }

  /**
   * Clean up AudioContext resources.
   * Should be called when the analyzer is no longer needed to prevent resource leaks.
   */
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioBuffer = null;
  }
}