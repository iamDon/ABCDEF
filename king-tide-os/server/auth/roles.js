// Authorization: what each role is allowed to see.
// This is the single place to change role-specific views. The split below is a
// starting point and should be confirmed with the founders.
export const PERMISSIONS = {
  customers: 'customers:view',
  projects: 'projects:view',
  communications: 'communications:view',
  finance: 'finance:view',
  integrations: 'integrations:view',
};

const P = PERMISSIONS;
const everyone = [P.customers, P.projects, P.communications];

const ROLE_PERMISSIONS = {
  CEO: [...everyone, P.finance, P.integrations],
  CTO: [...everyone, P.integrations],
  CMO: everyone,
  CPO: everyone,
  FOUNDER: everyone,
};

// Unknown roles get nothing (deny by default).
export function permissionsFor(role) {
  return ROLE_PERMISSIONS[String(role || '').toUpperCase()] || [];
}

export function can(user, permission) {
  return Boolean(user) && permissionsFor(user.role).includes(permission);
}
