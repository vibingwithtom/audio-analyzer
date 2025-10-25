/**
 * Filename Validation Module
 *
 * Provides validation for different filename patterns:
 * - Three Hour preset: Script matching validation
 * - Bilingual Conversational preset: Pattern validation
 */

import type { ValidationResult, BilingualValidationData } from './types';
import bilingualValidationData from './bilingual-validation-data.json' assert { type: 'json' };

const typedBilingualData = bilingualValidationData as BilingualValidationData;

export class FilenameValidator {
  /**
   * Validates Three Hour preset filename format
   *
   * Expected format: [scriptName]_[speakerID].wav
   *
   * @param filename - Filename to validate
   * @param scriptBaseNames - Array of valid script base names
   * @param speakerId - Expected speaker ID
   * @returns Validation result
   */
  static validateThreeHour(
    filename: string,
    scriptBaseNames: string[],
    speakerId: string
  ): ValidationResult {
    // Based on Google Apps Script logic
    const wavName = filename.trim();
    const nameWithoutExt = wavName.replace(/\.wav$/i, '');

    // Get what's before the speaker ID
    const possibleBase = nameWithoutExt.split(`_${speakerId}`)[0];
    const expectedName = `${possibleBase}_${speakerId}.wav`;

    if (!scriptBaseNames.includes(possibleBase)) {
      return {
        status: 'fail',
        expectedFormat: '-',
        issue: 'No matching script file found'
      };
    } else if (wavName === expectedName) {
      return {
        status: 'pass',
        expectedFormat: expectedName,
        issue: ''
      };
    } else {
      return {
        status: 'fail',
        expectedFormat: `${possibleBase}_${speakerId}.wav`,
        issue: 'Incorrect filename for existing script'
      };
    }
  }

  /**
   * Validates Bilingual Conversational preset filename format
   *
   * Two accepted formats:
   * - Regular: [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav
   * - Spontaneous: SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav
   *
   * @param filename - Filename to validate
   * @returns Validation result with isSpontaneous flag
   */
  static validateBilingual(filename: string): ValidationResult {
    // Collect all validation issues
    const issues: string[] = [];

    // Check for leading/trailing whitespace (DO NOT trim - we want to catch this as an error)
    if (filename !== filename.trim()) {
      issues.push('Filename has leading or trailing whitespace');
    }

    // Check for embedded whitespace
    if (/\s/.test(filename)) {
      issues.push('Filename contains whitespace characters');
    }

    // Check file extension - must end with exactly .wav (case insensitive)
    const hasWavExtension = /\.wav$/i.test(filename);
    if (!hasWavExtension) {
      issues.push('Filename must end with .wav extension');
    }

    // Check for double extensions like .mp3.wav or .wav.wav (only if .wav extension exists)
    if (hasWavExtension) {
      const nameWithoutWav = filename.replace(/\.wav$/i, '');
      if (/\.\w+$/.test(nameWithoutWav)) {
        issues.push('Filename has multiple extensions (e.g., .mp3.wav or .wav.wav)');
      }
    }

    // Remove any extension for parsing
    const nameWithoutExt = filename.replace(/\.\w+$/i, '');

    // Check if this is a spontaneous recording (case-insensitive to catch capitalization errors)
    const isSpontaneous = nameWithoutExt.toUpperCase().startsWith('SPONTANEOUS_');

    if (isSpontaneous) {
      return this.validateSpontaneousBilingual(nameWithoutExt, issues);
    } else {
      return this.validateRegularBilingual(nameWithoutExt, issues);
    }
  }

  /**
   * Validates spontaneous bilingual filename format
   * Format: SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID]
   */
  private static validateSpontaneousBilingual(
    nameWithoutExt: string,
    issues: string[]
  ): ValidationResult {
    // Check that SPONTANEOUS is all caps
    if (!nameWithoutExt.startsWith('SPONTANEOUS_')) {
      issues.push('Unscripted recordings must start with "SPONTANEOUS_" (all caps)');
    }

    // Extract the spontaneous ID and rest of filename
    const spontaneousMatch = nameWithoutExt.match(/^SPONTANEOUS_(\d+)-(.+)$/);
    if (!spontaneousMatch) {
      issues.push('Invalid unscripted format: expected SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID]');
      return {
        status: 'fail',
        expectedFormat: 'SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav',
        issue: issues.join('\n'),
        isSpontaneous: true
      };
    }

    const spontaneousId = spontaneousMatch[1];
    const restOfFilename = spontaneousMatch[2];

    // Validate that rest of filename (after SPONTANEOUS_[number]-) is lowercase
    if (restOfFilename !== restOfFilename.toLowerCase()) {
      issues.push('All text after "SPONTANEOUS_[number]-" must be lowercase');
    }

    // Parse the rest of the filename
    const parts = restOfFilename.toLowerCase().split('-');

    // Expected: [LanguageCode]-user-[UserID]-agent-[AgentID]
    if (parts.length !== 5) {
      issues.push(`Invalid format: expected 5 parts after SPONTANEOUS_[number]-, got ${parts.length}`);
      return {
        status: 'fail',
        expectedFormat: 'SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav',
        issue: issues.join('\n'),
        isSpontaneous: true
      };
    }

    const languageCode = parts[0];
    const userLabel = parts[1];
    const userId = parts[2];
    const agentLabel = parts[3];
    const agentId = parts[4];

    // Validate labels
    if (userLabel !== 'user') {
      issues.push(`Expected 'user' label, got '${userLabel}'`);
    }

    if (agentLabel !== 'agent') {
      issues.push(`Expected 'agent' label, got '${agentLabel}'`);
    }

    // Validate language code
    if (!typedBilingualData.languageCodes.includes(languageCode)) {
      issues.push(`Invalid language code: '${languageCode}'`);
    }

    // Validate contributor pair (order doesn't matter)
    const isValidPair = typedBilingualData.contributorPairs.some(pair =>
      (pair[0] === userId && pair[1] === agentId) ||
      (pair[0] === agentId && pair[1] === userId)
    );

    if (!isValidPair) {
      issues.push(`Invalid contributor pair: user-${userId}, agent-${agentId}`);
    }

    // If there are any issues, return failure with all issues
    if (issues.length > 0) {
      return {
        status: 'fail',
        expectedFormat: 'SPONTANEOUS_[number]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav',
        issue: issues.join('\n'),
        isSpontaneous: true
      };
    }

    // All validations passed
    const expectedFormat = `SPONTANEOUS_${spontaneousId}-${languageCode}-user-${userId}-agent-${agentId}.wav`;
    return {
      status: 'pass',
      expectedFormat: expectedFormat,
      issue: '',
      isSpontaneous: true
    };
  }

  /**
   * Validates regular (non-spontaneous) bilingual filename format
   * Format: [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]
   */
  private static validateRegularBilingual(
    nameWithoutExt: string,
    issues: string[]
  ): ValidationResult {
    // Check that filename is lowercase (except .wav extension)
    if (nameWithoutExt !== nameWithoutExt.toLowerCase()) {
      issues.push('Filename must be all lowercase');
    }

    // Use lowercase version for parsing
    const lowercaseName = nameWithoutExt.toLowerCase();

    // Expected format: [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]
    // Parse from the end since conversation IDs may contain dashes
    // Pattern: ends with -user-[ID]-agent-[ID]
    const match = lowercaseName.match(/^(.+)-([a-z_]+)-user-([^-]+)-agent-([^-]+)$/);

    if (!match) {
      issues.push('Invalid format: expected [ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID]');
      return {
        status: 'fail',
        expectedFormat: '[ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav',
        issue: issues.join('\n'),
        isSpontaneous: false
      };
    }

    const conversationId = match[1];
    const languageCode = match[2];
    const userId = match[3];
    const agentId = match[4];

    // Validate language code
    if (!typedBilingualData.languageCodes.includes(languageCode)) {
      issues.push(`Invalid language code: '${languageCode}'`);
    }

    // Validate conversation ID for this language (only if language code is valid)
    if (typedBilingualData.languageCodes.includes(languageCode)) {
      const validConversations = typedBilingualData.conversationsByLanguage[languageCode] || [];
      if (!validConversations.includes(conversationId)) {
        issues.push(`Invalid conversation ID: '${conversationId}' for language '${languageCode}'`);
      }
    }

    // Validate contributor pair (order doesn't matter)
    const isValidPair = typedBilingualData.contributorPairs.some(pair =>
      (pair[0] === userId && pair[1] === agentId) ||
      (pair[0] === agentId && pair[1] === userId)
    );

    if (!isValidPair) {
      issues.push(`Invalid contributor pair: user-${userId}, agent-${agentId}`);
    }

    // If there are any issues, return failure with all issues
    if (issues.length > 0) {
      return {
        status: 'fail',
        expectedFormat: '[ConversationID]-[LanguageCode]-user-[UserID]-agent-[AgentID].wav',
        issue: issues.join('\n'),
        isSpontaneous: false
      };
    }

    // All validations passed
    const expectedFormat = `${conversationId}-${languageCode}-user-${userId}-agent-${agentId}.wav`;
    return {
      status: 'pass',
      expectedFormat: expectedFormat,
      issue: '',
      isSpontaneous: false
    };
  }
}
