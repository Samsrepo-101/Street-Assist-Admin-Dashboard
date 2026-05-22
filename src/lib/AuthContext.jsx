import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserById } from '../api/users.js';
import { signOut } from '../api/auth.js';
import { getAdminRoleFromUserDoc, getStoredAdminRole, isAllowedAdminRole, isScopedAdminRole, storeSelectedAdminRole } from './adminRoles.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(getStoredAdminRole);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser === null) {
        setCurrentUser(null);
        setIsAdmin(false);
        setAdminRole(getStoredAdminRole());
        setIsLoadingAuth(false);
      } else {
        try {
          const userDoc = await getUserById(firebaseUser.uid);
          const role = getAdminRoleFromUserDoc(userDoc);
          const isAdminUser = isAllowedAdminRole(role);
          const selectedRole = getStoredAdminRole();
          const effectiveRole =
            role === 'admin' && isScopedAdminRole(selectedRole)
              ? selectedRole
              : role;

          setIsAdmin(isAdminUser);
          setAdminRole(effectiveRole);
          setCurrentUser(firebaseUser);
        } catch (error) {
          console.error('Failed to fetch user document:', error);
          setCurrentUser(firebaseUser);
          setIsAdmin(false);
          setAdminRole('');
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

  const selectAdminRole = (role) => {
    setAdminRole(storeSelectedAdminRole(role));
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, adminRole, isLoadingAuth, logout, selectAdminRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
