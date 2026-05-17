import { db } from './firebase.js';
import { doc, getDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';

/**
 * Reads the Firestore document at /users/{uid}.
 * Returns the document data (role, displayName, email, photoURL, etc.)
 * or null if the document does not exist.
 *
 * @param {string} uid - The Firebase Auth user ID.
 * @returns {Promise<object|null>}
 */
export async function getUserById(uid) {
  if (!uid) return null;
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.error('[users] getUserById error:', err);
    return null;
  }
}

/**
 * Fetches multiple user documents by their UIDs in a single batched read.
 * Returns a Map of uid → user data for fast lookup.
 * Silently skips missing documents.
 *
 * @param {string[]} uids - Array of Firebase Auth UIDs.
 * @returns {Promise<Map<string, object>>}
 */
export async function getUsersByIds(uids) {
  const result = new Map();
  if (!uids || uids.length === 0) return result;

  // Firestore 'in' queries support max 30 items; chunk if needed
  const unique = [...new Set(uids.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) {
    chunks.push(unique.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach(d => result.set(d.id, { id: d.id, ...d.data() }));
      } catch (err) {
        console.error('[users] getUsersByIds chunk error:', err);
      }
    })
  );

  return result;
}
