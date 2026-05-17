// Feature: firebase-integration, Property 9: Notification subscriber mapping completeness

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 11.1, 11.2
 *
 * Property 9: For any non-empty array of Firestore admin notification document
 * snapshots, `subscribeToAdminNotifications` SHALL invoke the callback with an
 * array of the same length where every element contains `id`, `relatedReportId`,
 * `message`, `isRead`, and `timestamp` matching the source document.
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

// Mock firebase/firestore — we control onSnapshot behaviour per test
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
// Helper: mirrors the mapping logic in /api/notifications.js
// ---------------------------------------------------------------------------

/**
 * Mirrors the document mapping performed inside subscribeToAdminNotifications.
 *
 * @param {string} docId - The Firestore document ID
 * @param {object} data  - The raw document data object
 * @returns {object} Mapped notification plain object
 */
function mapNotification(docId, data) {
  return {
    id: docId,
    relatedReportId: data.relatedReportId ?? null,
    message: data.message ?? '',
    isRead: data.isRead ?? false,
    timestamp: data.timestamp ?? null,
    title: data.title ?? '',
    type: data.type ?? '',
  };
}

// ---------------------------------------------------------------------------
// Property 9 test
// ---------------------------------------------------------------------------

describe('Property 9 — Notification subscriber mapping completeness', () => {
  it(
    'callback receives an array of the same length with correct mapped fields for any non-empty input',
    async () => {
      // Dynamically import after mocks are set up
      const { onSnapshot } = await import('firebase/firestore');
      const { subscribeToAdminNotifications } = await import('../src/api/notifications.js');

      fc.assert(
        fc.property(
          // Generate a non-empty array of arbitrary notification data objects
          fc.array(
            fc.record({
              relatedReportId: fc.string(),
              message: fc.string(),
              isRead: fc.boolean(),
              timestamp: fc.option(fc.integer(), { nil: null }),
              title: fc.string(),
              type: fc.string(),
            }),
            { minLength: 1 }
          ),
          (notificationDataArray) => {
            // Build mock Firestore document objects
            const mockDocs = notificationDataArray.map((data, index) => ({
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
            subscribeToAdminNotifications(callback);

            // Assert: callback was called exactly once
            expect(callback).toHaveBeenCalledTimes(1);

            const result = callback.mock.calls[0][0];

            // Assert: result array has the same length as the input
            expect(result).toHaveLength(notificationDataArray.length);

            // Assert: each element has the correct mapped fields
            result.forEach((item, index) => {
              const sourceData = notificationDataArray[index];
              const expected = mapNotification(`doc-id-${index}`, sourceData);

              expect(item.id).toBe(expected.id);
              expect(item.relatedReportId).toBe(expected.relatedReportId);
              expect(item.message).toBe(expected.message);
              expect(item.isRead).toBe(expected.isRead);
              expect(item.timestamp).toBe(expected.timestamp);
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
