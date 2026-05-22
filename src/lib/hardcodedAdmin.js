export const HARDCODED_ADMIN = {
  uid: 'hardcoded-admin',
  email: 'admin@streetassist.local',
  password: 'Admin123!',
  displayName: 'StreetAssist Admin',
};

export const HARDCODED_ADMIN_STORAGE_KEY = 'streetassist_hardcoded_admin';

export function isHardcodedAdminCredentials(email, password) {
  return (
    String(email).trim().toLowerCase() === HARDCODED_ADMIN.email.toLowerCase() &&
    String(password) === HARDCODED_ADMIN.password
  );
}

export function getHardcodedAdminUser() {
  return {
    uid: HARDCODED_ADMIN.uid,
    email: HARDCODED_ADMIN.email,
    displayName: HARDCODED_ADMIN.displayName,
    isHardcodedAdmin: true,
  };
}
