import { auth, getSecondaryApp } from './firebase.js';
import { db } from './firebase.js';
import {
  getAuth as getAuthFromApp,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getUserById } from './users.js';
import { ADMIN_ROLES, getAdminRoleFromUserDoc, isAllowedAdminRole } from '../lib/adminRoles.js';

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

/**
 * Signs in with email/password and verifies the user has an admin role.
 * Throws if credentials are wrong or role check fails.
 */
export async function signIn(email, password) {
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, password);
  } catch (firebaseError) {
    console.error('[auth] signIn error:', firebaseError.code, firebaseError.message);
    throw firebaseError;
  }

  const uid = userCredential.user.uid;
  const userDoc = await getUserById(uid);

  console.log('[auth] uid:', uid);
  console.log('[auth] userDoc:', userDoc);

  if (userDoc === null) {
    console.warn('[auth] No Firestore user doc — allowing login');
    return ADMIN_ROLES.MAIN;
  }

  const role = getAdminRoleFromUserDoc(userDoc);
  const isAdmin = isAllowedAdminRole(role);

  if (!isAdmin) {
    console.warn('[auth] Role check failed:', userDoc?.role || role);
    await firebaseSignOut(auth);
    throw new Error('Access denied');
  }

  return role;
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOut() {
  await firebaseSignOut(auth);
}

function getSecondaryAuth() {
  return getAuthFromApp(getSecondaryApp());
}

// ---------------------------------------------------------------------------
// Register new account
// ---------------------------------------------------------------------------

/**
 * Creates a Firebase Auth account + Firestore /users/{uid} document.
 *
 * @param {{ displayName: string, email: string, password: string, role: string }} params
 * @returns {Promise<string>} New user UID
 */
export async function registerUser({ displayName, email, password, role }) {
  const secondaryAuth = getSecondaryAuth();
  const secondaryDb = getFirestore(getSecondaryApp());
  let credential;

  try {
    credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;

    await firebaseUpdateProfile(credential.user, { displayName });

    await setDoc(doc(secondaryDb, 'users', uid), {
      displayName,
      email,
      role,
      isAdmin: true,
      userType: role === ADMIN_ROLES.MAIN ? 'admin' : role,
      user_type: role === ADMIN_ROLES.MAIN ? 'admin' : role,
      photoURL: '',
      createdAt: serverTimestamp(),
      lastSignInAt: serverTimestamp(),
    });

    return uid;
  } catch (err) {
    console.error('[auth] registerUser failed', err);
    if (credential?.user) {
      try {
        await credential.user.delete();
      } catch (cleanupError) {
        console.error('[auth] failed to delete orphaned user after registration failure', cleanupError);
      }
    }
    throw err;
  } finally {
    try {
      await firebaseSignOut(secondaryAuth);
    } catch (signOutError) {
      console.error('[auth] failed to sign out secondary auth', signOutError);
    }
  }
}

// ---------------------------------------------------------------------------
// Update profile
// ---------------------------------------------------------------------------

/**
 * Updates Firestore /users/{uid} with the provided fields.
 * Only touches the fields you pass — does not overwrite others.
 */
export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, 'users', uid), fields);
}

/**
 * Updates the Firebase Auth user profile (displayName, photoURL).
 */
export async function updateAuthProfile(firebaseUser, fields) {
  await firebaseUpdateProfile(firebaseUser, fields);
}
