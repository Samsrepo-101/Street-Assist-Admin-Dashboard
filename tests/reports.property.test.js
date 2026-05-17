// Feature: firebase-integration, Property 3: Report subscriber mapping completeness
// Feature: firebase-integration, Property 4: Report status validation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 6.1, 6.4, 7.2, 7.3
 *
 * Property 3: For any non-empty array of Firestore report document snapshots,
 * `subscribeToReports` SHALL invoke the callback with an array of the same
 * length where every element contains `id`, `userId`, `category`, `description`,
 * `status`, and `timestamp` with values matching the source document.
 *
 * Property 4: For any string that is NOT one of `"pending"`, `"ongoing"`, or
 * `"resolved"`, calling `updateReportStatus` SHALL throw a `TypeError` and
 * SHALL NOT make any Firestore call.
 */

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any dynamic imports
// ---------------------------------------------------------------------------

// Mock sonner to prevent toast side-effects during tests
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

// Mock ../src/api/firebase.js to export a dummy db instance
vi.mock('../src/api/firebase.js', () => ({
  db: {},
}));

// Mock firebase/firestore — we control onSnapshot and updateDoc behaviour per test
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((...args) => args[0]),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper: mirrors the mapping logic in /api/reports.js
// ---------------------------------------------------------------------------

/**
 * Mirrors the document mapping performed inside subscribeToReports.
 *
 * @param {string} docId - The Firestore document ID
 * @param {object} data  - The raw document data object
 * @returns {object} Mapped report plain object (core fields only)
 */
function mapReport(docId, data) {
  return {
    id: docId,
    userId: data.userId ?? null,
    category: data.category ?? '',
    description: data.description ?? '',
    status: data.status ?? '',
    timestamp: data.timestamp ?? null,
  };
}

// ---------------------------------------------------------------------------
// Property 3 — Report subscriber mapping completeness
// ---------------------------------------------------------------------------

describe('Property 3 — Report subscriber mapping completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'callback receives an array of the same length with correct mapped fields for any non-empty input',
    async () => {
      // Dynamically import after mocks are set up
      const { onSnapshot } = await import('firebase/firestore');
      const { subscribeToReports } = await import('../src/api/reports.js');

      fc.assert(
        fc.property(
          // Generate a non-empty array of arbitrary report data objects
          fc.array(
            fc.record({
              userId: fc.string(),
              category: fc.string(),
              description: fc.string(),
              status: fc.string(),
              timestamp: fc.option(fc.integer(), { nil: null }),
            }),
            { minLength: 1 }
          ),
          (reportDataArray) => {
            // Build mock Firestore document objects
            const mockDocs = reportDataArray.map((data, index) => ({
              id: `doc-id-${index}`,
              data: () => data,
            }));

            // Mock onSnapshot to synchronously invoke the snapshot handler
            onSnapshot.mockImplementation((_query, successHandler, _errorHandler) => {
              successHandler({ docs: mockDocs });
              return vi.fn(); // unsubscribe stub
            });

            // Capture the callback argument
            const callback = vi.fn();

            // Call the function under test
            subscribeToReports(callback);

            // Assert: callback was called exactly once
            expect(callback).toHaveBeenCalledTimes(1);

            const result = callback.mock.calls[0][0];

            // Assert: result array has the same length as the input
            expect(result).toHaveLength(reportDataArray.length);

            // Assert: each element has the correct mapped fields
            result.forEach((item, index) => {
              const sourceData = reportDataArray[index];
              const expected = mapReport(`doc-id-${index}`, sourceData);

              expect(item.id).toBe(expected.id);
              expect(item.userId).toBe(expected.userId);
              expect(item.category).toBe(expected.category);
              expect(item.description).toBe(expected.description);
              expect(item.status).toBe(expected.status);
              expect(item.timestamp).toBe(expected.timestamp);
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 4 — Report status validation
// ---------------------------------------------------------------------------

describe('Property 4 — Report status validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'throws TypeError and never calls updateDoc for any string that is not a valid status',
    async () => {
      // Dynamically import after mocks are set up
      const { updateDoc } = await import('firebase/firestore');
      const { updateReportStatus } = await import('../src/api/reports.js');

      fc.assert(
        fc.asyncProperty(
          // Generate any string that is NOT one of the three valid statuses
          fc.string().filter((s) => !['pending', 'ongoing', 'resolved'].includes(s)),
          async (invalidStatus) => {
            // Reset updateDoc mock call count before each iteration
            updateDoc.mockClear();

            // Call updateReportStatus with an invalid status and expect a TypeError
            let thrownError = null;
            try {
              await updateReportStatus('some-report-id', invalidStatus);
            } catch (err) {
              thrownError = err;
            }

            // Assert: a TypeError was thrown
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(TypeError);

            // Assert: updateDoc was NEVER called
            expect(updateDoc).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
