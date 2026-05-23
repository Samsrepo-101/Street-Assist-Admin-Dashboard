// Feature: firebase-integration, Property 5: Announcement subscriber mapping completeness
// Feature: firebase-integration, Property 6: Announcement input validation
// Feature: firebase-integration, Property 7: Comment subscriber mapping completeness
// Feature: firebase-integration, Property 8: Comment announcementId validation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 8.1, 8.2, 9.2, 9.3, 10.1, 10.4
 */

// ---------------------------------------------------------------------------
// Module mocks — declared before any dynamic imports
// ---------------------------------------------------------------------------

// Mock sonner to prevent toast side-effects during tests
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

// Mock ../src/api/firebase.js to export a dummy db instance
vi.mock('../src/api/firebase.js', () => ({
  db: {},
}));

// Mock firebase/firestore — we control onSnapshot and addDoc behaviour per test
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((...args) => args[0]),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteField: vi.fn(() => ({ _deleteField: true })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

// ---------------------------------------------------------------------------
// Property 5: Announcement subscriber mapping completeness
// ---------------------------------------------------------------------------

describe('Property 5 — Announcement subscriber mapping completeness', () => {
  /**
   * For any non-empty array of Firestore announcement document snapshots,
   * `subscribeToAnnouncements` SHALL invoke the callback with an array of the
   * same length where every element contains `id`, `title`, `content`, and
   * `timestamp` with values matching the source document.
   *
   * Validates: Requirements 8.1, 8.2
   */
  it(
    'callback receives an array of the same length with correct id, title, content, timestamp for any non-empty input',
    async () => {
      const { onSnapshot } = await import('firebase/firestore');
      const { subscribeToAnnouncements } = await import('../src/api/announcement.js');

      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string(),
              content: fc.string(),
              timestamp: fc.option(fc.integer(), { nil: null }),
            }),
            { minLength: 1 }
          ),
          (announcementDataArray) => {
            // Build mock Firestore document objects
            const mockDocs = announcementDataArray.map((data, index) => ({
              id: `announcement-id-${index}`,
              data: () => data,
            }));

            // Mock onSnapshot to synchronously invoke the snapshot handler
            onSnapshot.mockImplementation((_query, successHandler, _errorHandler) => {
              successHandler({ docs: mockDocs });
              return vi.fn(); // unsubscribe stub
            });

            const callback = vi.fn();

            subscribeToAnnouncements(callback);

            // Callback must have been called exactly once
            expect(callback).toHaveBeenCalledTimes(1);

            const result = callback.mock.calls[0][0];

            // Result array must have the same length as the input
            expect(result).toHaveLength(announcementDataArray.length);

            // Each element must have the correct mapped fields
            result.forEach((item, index) => {
              const src = announcementDataArray[index];
              expect(item.id).toBe(`announcement-id-${index}`);
              expect(item.title).toBe(src.title ?? '');
              expect(item.content).toBe(src.content ?? '');
              expect(item.timestamp).toBe(src.timestamp ?? null);
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 6: Announcement input validation
// ---------------------------------------------------------------------------

describe('Property 6 — Announcement input validation', () => {
  /**
   * For any call to `createAnnouncement` where `title` or `content` is an
   * empty string or a string composed entirely of whitespace, the function
   * SHALL throw a `TypeError` and SHALL NOT make any Firestore call.
   *
   * Validates: Requirements 9.2, 9.3
   */

  // Generator for invalid (empty or whitespace-only) strings
  const invalidString = fc.oneof(
    fc.constant(''),
    fc.string({ maxLength: 10 }).map((s) => s.replace(/\S/g, ' '))
  );

  // Generator for a valid (non-empty, non-whitespace) string
  const validString = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

  it(
    'throws TypeError and never calls addDoc when title is empty or whitespace-only',
    async () => {
      const { addDoc } = await import('firebase/firestore');
      const { createAnnouncement } = await import('../src/api/announcement.js');

      await fc.assert(
        fc.asyncProperty(
          invalidString,
          validString,
          async (badTitle, goodContent) => {
            addDoc.mockClear();

            let thrownError = null;
            try {
              await createAnnouncement({ title: badTitle, content: goodContent });
            } catch (err) {
              thrownError = err;
            }

            // Must throw a TypeError
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(TypeError);

            // addDoc must never have been called
            expect(addDoc).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'throws TypeError and never calls addDoc when content is empty or whitespace-only',
    async () => {
      const { addDoc } = await import('firebase/firestore');
      const { createAnnouncement } = await import('../src/api/announcement.js');

      await fc.assert(
        fc.asyncProperty(
          validString,
          invalidString,
          async (goodTitle, badContent) => {
            addDoc.mockClear();

            let thrownError = null;
            try {
              await createAnnouncement({ title: goodTitle, content: badContent });
            } catch (err) {
              thrownError = err;
            }

            // Must throw a TypeError
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(TypeError);

            // addDoc must never have been called
            expect(addDoc).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

describe('Announcement archive resident visibility', () => {
  it('hides archived announcements from residents and restores visibility when restored', async () => {
    const { updateDoc, getDoc } = await import('firebase/firestore');
    const { archiveAnnouncement, restoreArchivedAnnouncement } = await import('../src/api/announcement.js');

    updateDoc.mockClear();
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'Reported' }),
    });

    await archiveAnnouncement('announcement-1');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'archived',
        case_status: 'Reported',
        caseStatus: 'Reported',
        previous_status: 'Reported',
        deleted_at: null,
        archived_at: expect.any(String),
        archivedAt: expect.any(String),
        archived: true,
        isArchived: true,
        is_archived: true,
        hidden: true,
        visible_to_residents: false,
        visibleToResidents: false,
        isVisible: false,
        visible: false,
        active: false,
        isActive: false,
        published: false,
        isPublished: false,
        public: false,
        isPublic: false,
        show_to_residents: false,
        resident_visibility_synced: true,
      })
    );

    await restoreArchivedAnnouncement('announcement-1');

    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'Reported',
        case_status: 'Reported',
        caseStatus: 'Reported',
        previous_status: null,
        archived_at: null,
        archivedAt: null,
        archived: false,
        isArchived: false,
        is_archived: false,
        visible_to_residents: true,
        visibleToResidents: true,
        isVisible: true,
        visible: true,
        active: true,
        isActive: true,
        published: true,
        isPublished: true,
        public: true,
        isPublic: true,
      })
    );
  });

  it('backfills resident visibility aliases for existing archived announcements', async () => {
    const { updateDoc } = await import('firebase/firestore');
    const { syncArchivedAnnouncementVisibility } = await import('../src/api/announcement.js');

    updateDoc.mockClear();

    await syncArchivedAnnouncementVisibility({
      id: 'announcement-2',
      archived_at: '2026-05-21T09:03:00.000Z',
      previous_status: 'Reported',
      resident_visibility_synced: false,
    });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'archived',
        case_status: 'Reported',
        caseStatus: 'Reported',
        archived_at: '2026-05-21T09:03:00.000Z',
        archivedAt: '2026-05-21T09:03:00.000Z',
        archived: true,
        isArchived: true,
        is_archived: true,
        visible_to_residents: false,
        visibleToResidents: false,
        isVisible: false,
        visible: false,
        active: false,
        isActive: false,
        published: false,
        isPublished: false,
        public: false,
        isPublic: false,
      })
    );
  });

  it('moves deleted announcements to trash instead of permanently deleting them', async () => {
    const { updateDoc, deleteDoc } = await import('firebase/firestore');
    const { deleteAnnouncement } = await import('../src/api/announcement.js');

    updateDoc.mockClear();
    deleteDoc.mockClear();
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'Reported' }),
    });

    await deleteAnnouncement('announcement-3');

    expect(deleteDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'deleted',
        case_status: 'Reported',
        caseStatus: 'Reported',
        previous_status: 'Reported',
        deleted_at: expect.any(String),
        archived: true,
        isArchived: true,
        is_archived: true,
        deleted: true,
        isDeleted: true,
        hidden: true,
        visible_to_residents: false,
        visibleToResidents: false,
        isVisible: false,
        visible: false,
        active: false,
        isActive: false,
        published: false,
        isPublished: false,
        public: false,
        isPublic: false,
        show_to_residents: false,
        resident_visibility_synced: true,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Comment subscriber mapping completeness
// ---------------------------------------------------------------------------

describe('Property 7 — Comment subscriber mapping completeness', () => {
  /**
   * For any valid announcementId and non-empty array of Firestore comment
   * document snapshots, `subscribeToComments` SHALL invoke the callback with
   * an array of the same length where every element contains `id`, `userId`,
   * `text`, and `timestamp` with values matching the source document.
   *
   * Validates: Requirements 10.1
   */
  it(
    'callback receives an array of the same length with correct id, userId, text, timestamp for any non-empty input',
    async () => {
      const { onSnapshot } = await import('firebase/firestore');
      const { subscribeToComments } = await import('../src/api/announcement.js');

      fc.assert(
        fc.property(
          // Valid announcementId: non-empty, non-whitespace string
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          // Non-empty array of comment data
          fc.array(
            fc.record({
              userId: fc.string(),
              text: fc.string(),
              timestamp: fc.option(fc.integer(), { nil: null }),
            }),
            { minLength: 1 }
          ),
          (announcementId, commentDataArray) => {
            // Build mock Firestore document objects
            const mockDocs = commentDataArray.map((data, index) => ({
              id: `comment-id-${index}`,
              data: () => data,
            }));

            // Mock onSnapshot to synchronously invoke the snapshot handler
            onSnapshot.mockImplementation((_query, successHandler) => {
              successHandler({ docs: mockDocs });
              return vi.fn(); // unsubscribe stub
            });

            const callback = vi.fn();

            subscribeToComments(announcementId, callback);

            // Callback must have been called exactly once
            expect(callback).toHaveBeenCalledTimes(1);

            const result = callback.mock.calls[0][0];

            // Result array must have the same length as the input
            expect(result).toHaveLength(commentDataArray.length);

            // Each element must have the correct mapped fields
            result.forEach((item, index) => {
              const src = commentDataArray[index];
              expect(item.id).toBe(`comment-id-${index}`);
              expect(item.userId).toBe(src.userId ?? '');
              expect(item.text).toBe(src.text ?? '');
              expect(item.timestamp).toBe(src.timestamp ?? null);
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 8: Comment announcementId validation
// ---------------------------------------------------------------------------

describe('Property 8 — Comment announcementId validation', () => {
  /**
   * For any falsy or empty `announcementId`, calling either `subscribeToComments`
   * or `postComment` SHALL throw a `TypeError` and SHALL NOT make any Firestore call.
   *
   * Validates: Requirements 10.4
   */

  const falsyAnnouncementId = fc.oneof(
    fc.constant(''),
    fc.constant(null),
    fc.constant(undefined)
  );

  it(
    'subscribeToComments throws TypeError and never calls any Firestore function for falsy announcementId',
    async () => {
      const firestoreModule = await import('firebase/firestore');
      const { subscribeToComments } = await import('../src/api/announcement.js');

      fc.assert(
        fc.property(
          falsyAnnouncementId,
          (badId) => {
            // Reset all Firestore mock call counts
            firestoreModule.collection.mockClear();
            firestoreModule.query.mockClear();
            firestoreModule.onSnapshot.mockClear();

            let thrownError = null;
            try {
              subscribeToComments(badId, vi.fn());
            } catch (err) {
              thrownError = err;
            }

            // Must throw a TypeError
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(TypeError);

            // No Firestore functions should have been called
            expect(firestoreModule.collection).not.toHaveBeenCalled();
            expect(firestoreModule.query).not.toHaveBeenCalled();
            expect(firestoreModule.onSnapshot).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'postComment throws TypeError and never calls any Firestore function for falsy announcementId',
    async () => {
      const firestoreModule = await import('firebase/firestore');
      const { postComment } = await import('../src/api/announcement.js');

      await fc.assert(
        fc.asyncProperty(
          falsyAnnouncementId,
          async (badId) => {
            // Reset all Firestore mock call counts
            firestoreModule.collection.mockClear();
            firestoreModule.addDoc.mockClear();

            let thrownError = null;
            try {
              await postComment(badId, { userId: 'user-1', text: 'hello' });
            } catch (err) {
              thrownError = err;
            }

            // Must throw a TypeError
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(TypeError);

            // No Firestore functions should have been called
            expect(firestoreModule.collection).not.toHaveBeenCalled();
            expect(firestoreModule.addDoc).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
