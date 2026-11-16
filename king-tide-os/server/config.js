// Reads all configuration in one place. Nothing in here is sent to the browser.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAMPLE_USERS } from './auth/sampleUsers.js';

const USERS_FILE = fileURLToPath(new URL('../config/users.json', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url));

const bool = (v, fallback) => (v === undefined || v === '' ? fallback : /^(1|true|yes)$/i.test(v));

// Approved founders come from KTOS_USERS (JSON), else config/users.json, else
// the fictional sample founders. Each: { name, role, emails: [...] }.
function loadUsers(env, usersFile) {
  let users = null;
  if (bool(env.KTOS_USE_SAMPLE_USERS, false)) {
    // Class demos: fictional founders even when real ones are configured.
  } else if (env.KTOS_USERS) {
    try {
      users = JSON.parse(env.KTOS_USERS);
    } catch {
      throw new Error('KTOS_USERS must be a JSON list like [{"name":"...","role":"CEO","emails":["..."]}]');
    }
  } else if (usersFile && existsSync(usersFile)) {
    users = JSON.parse(readFileSync(usersFile, 'utf8'));
  }
  if (!users) return { users: SAMPLE_USERS, usingSampleUsers: true };
  return {
    users: users.map((u) => ({ name: u.name, role: u.role, emails: u.emails || (u.email ? [u.email] : []) })),
    usingSampleUsers: false,
  };
}

export function loadConfig(env = process.env, { usersFile = USERS_FILE } = {}) {
  const dataMode = env.KTOS_DATA_MODE === 'live' ? 'live' : 'demo';
  const { users, usingSampleUsers } = loadUsers(env, usersFile);

  return {
    dataMode,
    port: Number(env.PORT) || 3000,
    users,
    usingSampleUsers,
    // Showing the code on screen is only for the fictional sample founders.
    showLoginCodes: bool(env.KTOS_SHOW_LOGIN_CODES, usingSampleUsers),
    secureCookies: bool(env.KTOS_SECURE_COOKIES, false),
    simulateBiginOutage: bool(env.KTOS_SIMULATE_BIGIN_OUTAGE, false),
    adminEmail: env.KTOS_ADMIN_EMAIL || 'admin@kingtideconcepts.com',
    dataDir: env.KTOS_DATA_DIR || DATA_DIR,
    smtp: {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT) || 465,
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.KTOS_EMAIL_FROM || env.SMTP_USER || '',
    },
    zoho: {
      clientId: env.ZOHO_CLIENT_ID || '',
      clientSecret: env.ZOHO_CLIENT_SECRET || '',
      refreshToken: env.ZOHO_REFRESH_TOKEN || '',
      accountsUrl: (env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/$/, ''),
      apiUrl: (env.ZOHO_API_URL || 'https://www.zohoapis.com').replace(/\/$/, ''),
      recordUrlTemplate: env.BIGIN_RECORD_URL_TEMPLATE || '',
    },
  };
}
