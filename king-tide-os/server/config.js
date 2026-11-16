// Reads all configuration from environment variables in one place.
// Nothing in here is ever sent to the browser.
import { SAMPLE_USERS } from './auth/sampleUsers.js';

const bool = (v, fallback) => (v === undefined || v === '' ? fallback : /^(1|true|yes)$/i.test(v));

export function loadConfig(env = process.env) {
  const dataMode = env.KTOS_DATA_MODE === 'live' ? 'live' : 'demo';

  let users = dataMode === 'demo' ? SAMPLE_USERS : [];
  if (env.KTOS_USERS) {
    try {
      users = JSON.parse(env.KTOS_USERS);
    } catch {
      throw new Error('KTOS_USERS must be a JSON list like [{"email":"...","name":"...","role":"CEO"}]');
    }
  }

  return {
    dataMode,
    port: Number(env.PORT) || 3000,
    users,
    showLoginCodes: bool(env.KTOS_SHOW_LOGIN_CODES, dataMode === 'demo'),
    secureCookies: bool(env.KTOS_SECURE_COOKIES, false),
    simulateBiginOutage: bool(env.KTOS_SIMULATE_BIGIN_OUTAGE, false),
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
