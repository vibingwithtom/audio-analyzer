/**
 * Type definitions for filename validation
 */

/**
 * Result of filename validation
 */
export interface ValidationResult {
  /** Validation status: 'pass' or 'fail' */
  status: 'pass' | 'fail';
  /** Expected filename format */
  expectedFormat: string;
  /** Validation issue details (empty string if passed) */
  issue: string;
  /** Whether this is a spontaneous recording (bilingual only) */
  isSpontaneous?: boolean;
}

/**
 * Bilingual validation data structure
 */
export interface BilingualValidationData {
  /** Valid language codes */
  languageCodes: string[];
  /** Conversation IDs grouped by language code */
  conversationsByLanguage: Record<string, string[]>;
  /** Valid contributor ID pairs (arrays of 2 strings) */
  contributorPairs: string[][];
}
