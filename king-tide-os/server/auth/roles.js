// Authorization and role-specific views.
// Each position lists the dashboard sections its founder sees, in the order
// they asked for them. This file is the single place to change that. The
// server enforces it on every request; the browser only uses it for layout.
export const PERMISSIONS = {
  customers: 'customers:view',
  projects: 'projects:view',
  communications: 'communications:view',
  finance: 'finance:view',
  calendar: 'calendar:view',
  integrations: 'integrations:view',
  access: 'access:view',
  postAnnouncements: 'announcements:post',
};

const P = PERMISSIONS;

export const ROLES = {
  CEO: {
    title: 'Chief Executive Officer',
    label: 'CEO',
    sections: ['finance', 'communications', 'projects', 'customers'],
    extra: [P.postAnnouncements],
  },
  CTO: {
    title: 'Chief Technical Officer',
    label: 'CTO',
    sections: ['projects', 'finance', 'communications'],
  },
  CMO: {
    title: 'Chief Marketing Officer',
    label: 'CMO',
    sections: ['customers', 'finance', 'projects', 'links'],
    links: [{ label: 'Post to Zoho Social', description: 'Schedule and publish social posts.', url: 'https://social.zoho.com/' }],
  },
  CPO: {
    title: 'Chief People Officer',
    label: 'CPO',
    sections: ['communications', 'calendar', 'customers', 'projects'],
  },
  ADMIN: {
    title: 'Admin',
    label: 'Admin',
    sections: ['customers', 'projects', 'communications', 'finance', 'calendar', 'integrations', 'access'],
    extra: [P.postAnnouncements],
  },
};

const roleOf = (role) => ROLES[String(role || '').toUpperCase()] || null;

// Unknown roles get nothing (deny by default). "links" needs no permission:
// it is a list of shortcuts, not data.
export function permissionsFor(role) {
  const r = roleOf(role);
  if (!r) return [];
  return [...r.sections.filter((s) => s !== 'links').map((s) => `${s}:view`), ...(r.extra || [])];
}

export function can(user, permission) {
  return Boolean(user) && permissionsFor(user.role).includes(permission);
}

// What the dashboard needs to lay itself out for this role.
export function viewFor(role) {
  const r = roleOf(role);
  return {
    roleLabel: r?.label || String(role || ''),
    sections: r?.sections || [],
    links: r?.links || [],
    permissions: permissionsFor(role),
  };
}

// Positions offered on the sign-in page (titles only, no names).
export function listPositions() {
  return Object.entries(ROLES).map(([role, r]) => ({ role, title: r.title, label: r.label }));
}

// For the admin's "who sees what" panel.
export function describeAccess() {
  return Object.entries(ROLES).map(([role, r]) => ({
    role,
    title: r.title,
    sections: r.sections,
    canPostAnnouncements: (r.extra || []).includes(P.postAnnouncements),
  }));
}
