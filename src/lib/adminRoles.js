export const ADMIN_ROLES = {
  MAIN: 'admin',
  MISSING_ANIMALS: 'missing_animals_admin',
  HOMELESS: 'homeless_admin',
  MISSING_PERSON: 'missing_person_admin',
};

export const SELECTED_ADMIN_ROLE_KEY = 'streetassist_selected_admin_role';

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

  if (
    role === 'homeless_admin' ||
    role === 'homeless' ||
    role === 'individual_admin' ||
    role === 'individuals_admin'
  ) {
    return ADMIN_ROLES.HOMELESS;
  }

  if (
    role === 'missing_person_admin' ||
    role === 'missing_person' ||
    role === 'missing_persons_admin' ||
    role === 'person_admin'
  ) {
    return ADMIN_ROLES.MISSING_PERSON;
  }

  if (role === 'admin' || userDoc?.isAdmin === true || userDoc?.is_admin === true || userDoc === null) {
    return ADMIN_ROLES.MAIN;
  }

  return '';
}

export function isAllowedAdminRole(role) {
  return (
    role === ADMIN_ROLES.MAIN ||
    role === ADMIN_ROLES.MISSING_ANIMALS ||
    role === ADMIN_ROLES.HOMELESS ||
    role === ADMIN_ROLES.MISSING_PERSON
  );
}

export function isMissingAnimalsAdminRole(role) {
  return role === ADMIN_ROLES.MISSING_ANIMALS;
}

export function isHomelessAdminRole(role) {
  return role === ADMIN_ROLES.HOMELESS;
}

export function isMissingPersonAdminRole(role) {
  return role === ADMIN_ROLES.MISSING_PERSON;
}

export function isScopedReportAdminRole(role) {
  return isMissingAnimalsAdminRole(role) || isHomelessAdminRole(role);
}

export function isScopedAnnouncementAdminRole(role) {
  return isMissingAnimalsAdminRole(role) || isMissingPersonAdminRole(role);
}

export function isScopedAdminRole(role) {
  return isScopedReportAdminRole(role) || isScopedAnnouncementAdminRole(role);
}

export function getDefaultRouteForAdminRole(role) {
  if (isMissingPersonAdminRole(role)) return '/announcements';
  if (isScopedReportAdminRole(role)) return '/reports';
  return '/';
}

export function getRoleLabel(role) {
  if (role === ADMIN_ROLES.HOMELESS) return 'Homeless Admin';
  if (role === ADMIN_ROLES.MISSING_ANIMALS) return 'Missing Animals Admin';
  if (role === ADMIN_ROLES.MISSING_PERSON) return 'Missing Person Admin';
  return 'Main Admin';
}

export function getStoredAdminRole() {
  if (typeof localStorage === 'undefined') {
    return ADMIN_ROLES.MAIN;
  }

  const role = normalizeAdminRole(localStorage.getItem(SELECTED_ADMIN_ROLE_KEY));
  return isAllowedAdminRole(role) ? role : ADMIN_ROLES.MAIN;
}

export function storeSelectedAdminRole(role) {
  const normalized = normalizeAdminRole(role);
  const nextRole = isAllowedAdminRole(normalized) ? normalized : ADMIN_ROLES.MAIN;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SELECTED_ADMIN_ROLE_KEY, nextRole);
  }
  return nextRole;
}

export function isAnimalReport(report) {
  const category = String(report?.category || report?.reportType || '').trim().toLowerCase();
  if (category === 'animal') return true;
  if (category === 'individual') return false;

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

export function isIndividualReport(report) {
  const category = String(report?.category || report?.reportType || '').trim().toLowerCase();
  if (category === 'individual') return true;
  if (category === 'animal') return false;

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
    fields.includes('individual') ||
    fields.includes('homeless') ||
    fields.includes('person in need') ||
    fields.includes('street dweller')
  );
}

export function isAnimalAnnouncement(announcement) {
  const category = String(announcement?.category || '').trim().toLowerCase();
  if (category === 'missing animal') return true;
  if (category === 'missing person') return false;

  const fields = [
    announcement?.category,
    announcement?.title,
    announcement?.content,
    announcement?.subtitle,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    fields.includes('missing animal') ||
    fields.includes('animal') ||
    fields.includes('dog') ||
    fields.includes('cat') ||
    fields.includes('pet')
  );
}

export function isMissingPersonAnnouncement(announcement) {
  const category = String(announcement?.category || '').trim().toLowerCase();
  if (category === 'missing person') return true;
  if (category === 'missing animal') return false;

  const fields = [
    announcement?.category,
    announcement?.title,
    announcement?.content,
    announcement?.subtitle,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    fields.includes('missing person') ||
    fields.includes('missing persons') ||
    fields.includes('person')
  );
}

export function canAccessReport(report, adminRole) {
  if (isMissingAnimalsAdminRole(adminRole)) {
    return isAnimalReport(report);
  }

  if (isHomelessAdminRole(adminRole)) {
    return isIndividualReport(report);
  }

  return true;
}

export function canAccessAnnouncement(announcement, adminRole) {
  if (isMissingAnimalsAdminRole(adminRole)) {
    return isAnimalAnnouncement(announcement);
  }

  if (isMissingPersonAdminRole(adminRole)) {
    return isMissingPersonAnnouncement(announcement);
  }

  return true;
}
