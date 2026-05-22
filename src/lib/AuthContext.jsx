import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserById } from '../api/users.js';
import { signOut } from '../api/auth.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser === null) {
        setCurrentUser(null);
        setIsAdmin(false);
        setIsLoadingAuth(false);
      } else {
        try {
          const userDoc = await getUserById(firebaseUser.uid);

          // Accept common field name variants
          const role =
            userDoc?.role ||
            userDoc?.userType ||
            userDoc?.user_type ||
            userDoc?.type ||
            '';

          const isAdminUser =
            role === 'admin' ||
            role === 'Admin' ||
            userDoc?.isAdmin === true ||
            userDoc?.is_admin === true ||
            userDoc === null; // no doc = allow (admin-only app with single account)

          setIsAdmin(isAdminUser);
          setCurrentUser(firebaseUser);
        } catch (error) {
          console.error('Failed to fetch user document:', error);
          setCurrentUser(firebaseUser);
          setIsAdmin(false);
        } finally {
          setIsLoadingAuth(false);
        }
      }
    });

    // Return the unsubscribe function for cleanup on unmount
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, isLoadingAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
