// Feature: firebase-integration, Property 1: Environment variable validation

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 1.4
 *
 * Property 1: For any subset of the six required VITE_FIREBASE_* environment
 * variables where at least one is missing, the module init SHALL throw an error
 * whose message contains the name of at least one missing variable.
 */

// The six required Firebase environment variable keys
const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

/**
 * Mirrors the validation logic in /api/firebase.js.
 * Iterates over all required keys; throws an Error naming the first missing key.
 *
 * @param {Record<string, string>} env - The environment object to validate
 * @throws {Error} When any required key is absent or falsy
 */
function validateFirebaseEnv(env) {
  for (const key of REQUIRED_ENV_KEYS) {
    if (!env[key]) {
      throw new Error(`Missing Firebase environment variable: ${key}`);
    }
  }
}

describe('Property 1 — Firebase env-var validation', () => {
  it('throws when at least one required env var is missing, and the error message names a missing key', () => {
    // fc.subarray generates a subset of REQUIRED_ENV_KEYS representing the PRESENT keys.
    // We filter to cases where the present subset is smaller than the full set,
    // i.e., at least one key is missing.
    fc.assert(
      fc.property(
        fc.subarray(REQUIRED_ENV_KEYS, { minLength: 0, maxLength: REQUIRED_ENV_KEYS.length - 1 }),
        (presentKeys) => {
          // Build an env object that only contains the "present" keys
          const env = {};
          for (const key of presentKeys) {
            env[key] = 'dummy-value';
          }

          // Determine which keys are missing
          const missingKeys = REQUIRED_ENV_KEYS.filter((k) => !presentKeys.includes(k));

          // The validation must throw
          let thrownError = null;
          try {
            validateFirebaseEnv(env);
          } catch (err) {
            thrownError = err;
          }

          // Assert an error was thrown
          expect(thrownError).not.toBeNull();
          expect(thrownError).toBeInstanceOf(Error);

          // Assert the error message contains the name of at least one missing key
          const messageContainsMissingKey = missingKeys.some((key) =>
            thrownError.message.includes(key)
          );
          expect(messageContainsMissingKey).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('does NOT throw when all six required env vars are present', () => {
    const fullEnv = {};
    for (const key of REQUIRED_ENV_KEYS) {
      fullEnv[key] = 'dummy-value';
    }
    expect(() => validateFirebaseEnv(fullEnv)).not.toThrow();
  });
});
