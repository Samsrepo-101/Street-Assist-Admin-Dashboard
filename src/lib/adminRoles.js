export const ADMIN_ROLES = {
  MAIN: 'admin',
  MISSING_ANIMALS: 'missing_animals_admin',
};

export function normalizeAdminRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function getAdminRoleFromUserDoc(userDoc) {
  const rawRole =
    userDoc?.role ||
    userDoc?.userType ||
    userDoc?.user_type ||
    userDoc?.type ||
    '';

  const role = normalizeAdminRole(rawRole);

  if (
    role === 'missing_animals_admin' ||
    role === 'missing_animal_admin' ||
    role === 'animal_admin' ||
    role === 'animals_admin'
  ) {
    return ADMIN_ROLES.MISSING_ANIMALS;
  }

  if (role === 'admin' || userDoc?.isAdmin === true || userDoc?.is_admin === true || userDoc === null) {
    return ADMIN_ROLES.MAIN;
  }

  return '';
}

export function isAllowedAdminRole(role) {
  return role === ADMIN_ROLES.MAIN || role === ADMIN_ROLES.MISSING_ANIMALS;
}

export function isMissingAnimalsAdminRole(role) {
  return role === ADMIN_ROLES.MISSING_ANIMALS;
}

export function isAnimalReport(report) {
  const fields = [
    report?.category,
    report?.reportType,
    report?.type,
    report?.description,
    report?.assistanceDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    fields.includes('animal') ||
    fields.includes('dog') ||
    fields.includes('cat') ||
    fields.includes('pet')
  );
}

export function canAccessReport(report, adminRole) {
  if (isMissingAnimalsAdminRole(adminRole)) {
    return isAnimalReport(report);
  }

  return true;
}
