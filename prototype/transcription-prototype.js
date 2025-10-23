#!/usr/bin/env node

/**
 * Audio Transcription Prototype
 *
 * A simple CLI tool to test Whisper transcription performance and quality
 *
 * Usage:
 *   node transcription-prototype.js <audio-file> <script-file>
 *
 * Example:
 *   node transcription-prototype.js recording.wav script.txt
 */

import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// String similarity function
function stringSimilarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 100;

  const editDistance = getEditDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
}

// Levenshtein distance
function getEditDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// Word accuracy
function calculateWordAccuracy(transcribed, reference) {
  const refWords = reference.toLowerCase().split(/\s+/).filter(w => w);
  const transWords = transcribed.toLowerCase().split(/\s+/).filter(w => w);

  if (refWords.length === 0) return 0;

  let matches = 0;
  const used = new Set();

  for (const refWord of refWords) {
    for (let i = 0; i < transWords.length; i++) {
      if (!used.has(i) && transWords[i] === refWord) {
        matches++;
        used.add(i);
        break;
      }
    }
  }

  return (matches / refWords.length) * 100;
}

// Decode audio file to Float32Array using ffmpeg
async function decodeAudio(audioPath) {
  const tempFile = `/tmp/audio_decoded_${Date.now()}.raw`;
  console.log(`   Decoding audio...`);

  try {
    // Use ffmpeg to decode audio to raw PCM float32
    const command = `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -acodec pcm_f32le -f f32le "${tempFile}" 2>/dev/null`;
    console.log(`   Running: ffmpeg -i "${path.basename(audioPath)}" -ar 16000 -ac 1 -acodec pcm_f32le...`);

    execSync(command, { stdio: 'pipe' });

    console.log(`   ✓ Audio decoded successfully`);
    const buffer = fs.readFileSync(tempFile);
    const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    console.log(`   ✓ Converted to Float32Array (${float32Array.length} samples)`);

    fs.unlinkSync(tempFile);
    return float32Array;
  } catch (error) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw new Error(`Failed to decode audio: ${error.message}`);
  }
}

// Main transcription function
async function transcribeAudio(audioPath, scriptPath, language = null) {
  // Validate files exist
  if (!fs.existsSync(audioPath)) {
    console.error(`❌ Error: Audio file not found: ${audioPath}`);
    process.exit(1);
  }

  const scriptText = scriptPath && fs.existsSync(scriptPath)
    ? fs.readFileSync(scriptPath, 'utf-8').trim()
    : null;

  console.log('\n🎙️  Audio Transcription Prototype\n');
  console.log(`📄 Audio file: ${path.basename(audioPath)}`);
  if (scriptText) {
    console.log(`📝 Reference script: ${path.basename(scriptPath)}`);
  }
  if (language) {
    console.log(`🌐 Language: ${language}`);
  }

  // Initialize model
  console.log('\n⏳ Loading Whisper-base model (multilingual, may take 5-10 minutes on first run)...\n');
  let recognizer;
  try {
    recognizer = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
      quantized: true,
    });
  } catch (error) {
    console.error(`❌ Failed to load model: ${error.message}`);
    process.exit(1);
  }

  // Decode and transcribe
  console.log('🎤 Decoding audio and transcribing...\n');
  const startTime = performance.now();

  try {
    // Decode audio to Float32Array using ffmpeg
    const audioData = await decodeAudio(audioPath);

    // Transcribe with chunking for long audio (>30 seconds)
    // chunk_length_s: 30 seconds per chunk
    // stride_length_s: 5 seconds overlap between chunks
    const transcribeOptions = {
      chunk_length_s: 30,
      stride_length_s: 5,
    };

    // Add language if specified (e.g., "tr" for Turkish, "es" for Spanish)
    if (language) {
      transcribeOptions.language = language;
      console.log(`   Using language hint: ${language}`);
    }

    console.log(`   Transcription options:`, JSON.stringify(transcribeOptions, null, 2));
    console.log(`   Starting transcription... (this may take several minutes for long audio)`);
    console.log(`   Note: If language is still not recognized, transformers.js may have a bug or require different format`);

    const result = await recognizer(audioData, transcribeOptions);
    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;

    console.log(`   ✓ Transcription complete`);

    // Inspect full result object to find language info
    console.log(`\n   === Result Object Inspection ===`);
    console.log(`   Full result:`, JSON.stringify(result, null, 2));
    console.log(`   Result type:`, typeof result);
    console.log(`   Result keys:`, Object.keys(result));

    // Check for language info in various places
    if (result.language) {
      console.log(`   ✓ Found language in result.language: ${result.language}`);
    }
    if (result.detected_language) {
      console.log(`   ✓ Found language in result.detected_language: ${result.detected_language}`);
    }
    if (result.language_code) {
      console.log(`   ✓ Found language in result.language_code: ${result.language_code}`);
    }
    if (result.detected_language_code) {
      console.log(`   ✓ Found language in result.detected_language_code: ${result.detected_language_code}`);
    }

    if (!result.language && !result.detected_language && !result.language_code && !result.detected_language_code) {
      console.log(`   ⚠ No language detection info available in result object`);
    }
    console.log(`   === End Inspection ===\n`);

    const transcribedText = result.text;
    const fileSize = fs.statSync(audioPath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    // Results
    console.log('=' .repeat(70));
    console.log('RESULTS');
    console.log('=' .repeat(70));

    console.log('\n📊 Performance Metrics:');
    console.log(`   Processing time:      ${processingTime.toFixed(2)}s`);
    console.log(`   File size:            ${fileSizeMB} MB`);

    // Try to estimate audio duration from file (rough estimate)
    // Audio file bitrate typically: 16-bit PCM @ sample rate
    // This is approximate - actual duration depends on format
    const estimatedDuration = (fileSize / 192000).toFixed(2); // assuming typical WAV specs
    console.log(`   Estimated duration:   ~${estimatedDuration}s`);
    console.log(`   Processing speed:     ${(estimatedDuration / processingTime).toFixed(2)}x`);

    // Initialize similarity and wordAccuracy
    let similarity = null;
    let wordAccuracy = null;

    if (scriptText) {
      similarity = stringSimilarity(
        transcribedText.toLowerCase(),
        scriptText.toLowerCase()
      );
      wordAccuracy = calculateWordAccuracy(transcribedText, scriptText);

      console.log('\n🎯 Matching Results:');
      console.log(`   String similarity:    ${similarity.toFixed(1)}%`);
      console.log(`   Word accuracy:        ${wordAccuracy.toFixed(1)}%`);

      // Pass/Fail
      if (similarity >= 90) {
        console.log(`   Status:               ✅ PASS (≥90%)`);
      } else if (similarity >= 80) {
        console.log(`   Status:               ⚠️  WARNING (80-90%)`);
      } else {
        console.log(`   Status:               ❌ FAIL (<80%)`);
      }
    }

    console.log('\n📋 Transcribed Text:');
    console.log('-' .repeat(70));
    console.log(transcribedText);
    console.log('-' .repeat(70));

    if (scriptText) {
      console.log('\n📖 Reference Script:');
      console.log('-' .repeat(70));
      console.log(scriptText);
      console.log('-' .repeat(70));
    }

    console.log('\n' + '=' .repeat(70));
    console.log('\n✅ Transcription complete!\n');

    // Save results
    const resultsFile = `transcription-results-${Date.now()}.json`;
    const results = {
      timestamp: new Date().toISOString(),
      audioFile: path.basename(audioPath),
      scriptFile: scriptPath ? path.basename(scriptPath) : null,
      language: language || 'auto-detected',
      processingTime,
      estimatedDuration: parseFloat(estimatedDuration),
      fileSizeMB: parseFloat(fileSizeMB),
      transcribedText,
      referenceScript: scriptText,
      metrics: scriptText ? {
        stringSimilarity: parseFloat(similarity.toFixed(1)),
        wordAccuracy: parseFloat(wordAccuracy.toFixed(1))
      } : null
    };

    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${resultsFile}\n`);

  } catch (error) {
    console.error(`❌ Transcription failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// CLI usage
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`\n🎙️  Audio Transcription Prototype\n`);
  console.log('Usage: node transcription-prototype.js <audio-file> [script-file] [language]\n');
  console.log('Examples:');
  console.log('  node transcription-prototype.js recording.wav');
  console.log('  node transcription-prototype.js recording.wav script.txt');
  console.log('  node transcription-prototype.js recording.wav script.txt tr\n');
  console.log('Common language codes:');
  console.log('  en - English       es - Spanish        fr - French');
  console.log('  de - German        it - Italian        pt - Portuguese');
  console.log('  tr - Turkish       ja - Japanese       zh - Chinese\n');
  process.exit(0);
}

const audioFile = args[0];
const scriptFile = args[1] || null;
const language = args[2] || null;

transcribeAudio(audioFile, scriptFile, language)
  .then(() => {
    console.log('Process completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
