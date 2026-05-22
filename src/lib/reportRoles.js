export const REPORT_ROLES = [
  {
    value: 'homeless',
    label: 'Homeless',
    description: 'Reports for people needing street assistance.',
    loginCode: 'HOMELESS-ADMIN',
    aliases: ['homeless', 'street dweller', 'person in need', 'individual'],
  },
  {
    value: 'missing-dogs',
    label: 'Missing Dogs',
    description: 'Reports about lost or missing dogs.',
    loginCode: 'DOGS-ADMIN',
    aliases: ['missing dog', 'missing dogs', 'lost dog', 'lost dogs', 'dog', 'animal'],
  },
  {
    value: 'missing-person',
    label: 'Missing Person',
    description: 'Reports about a missing person.',
    loginCode: 'PERSON-ADMIN',
    aliases: ['missing person', 'missing persons', 'lost person'],
  },
];

export const DEFAULT_REPORT_ROLE = REPORT_ROLES[0].value;

const ROLE_ORDER = REPORT_ROLES.reduce((order, role, index) => {
  order[role.value] = index;
  return order;
}, {});

export function getReportRoleByValue(value) {
  return REPORT_ROLES.find(role => role.value === value) ?? REPORT_ROLES[0];
}

export function isValidReportRoleCode(roleValue, code) {
  const role = getReportRoleByValue(roleValue);
  return role.loginCode.toLowerCase() === String(code).trim().toLowerCase();
}

export function getReportRole(report) {
  const fields = [
    report?.role,
    report?.reportRole,
    report?.reportType,
    report?.category,
    report?.description,
    report?.assistanceDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return REPORT_ROLES.find(role =>
    role.aliases.some(alias => fields.includes(alias))
  ) ?? REPORT_ROLES[0];
}

export function compareReportsByRole(a, b) {
  const aRole = getReportRole(a).value;
  const bRole = getReportRole(b).value;
  const roleDiff = (ROLE_ORDER[aRole] ?? 0) - (ROLE_ORDER[bRole] ?? 0);
  if (roleDiff !== 0) return roleDiff;

  const aTime = a?.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
  const bTime = b?.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
  return bTime - aTime;
}
