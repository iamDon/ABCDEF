// Test helpers: start the real app on a spare port with a fake Zoho.
import http from 'node:http';
import { compose } from '../server/compose.js';
import { loadConfig } from '../server/config.js';

export const SECRETS = {
  ZOHO_CLIENT_ID: 'test-client-id-1000.ABC',
  ZOHO_CLIENT_SECRET: 'test-client-secret-s3cr3t',
  ZOHO_REFRESH_TOKEN: 'test-refresh-token-r3fr3sh',
};
export const ACCESS_TOKEN = 'test-access-token-acc3ss';
export const ALL_SECRET_VALUES = [...Object.values(SECRETS), ACCESS_TOKEN];

export const USERS = [
  { email: 'ceo@test.example', name: 'Casey CEO', role: 'CEO' },
  { email: 'cmo@test.example', name: 'Morgan CMO', role: 'CMO' },
  { email: 'guest@test.example', name: 'Glenn Guest', role: 'GUEST' }, // role with no permissions
];

const jsonResponse = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status });

// A fake Zoho. `records` is the Bigin "data" array; options simulate failures.
export function fakeZoho({ records = [], stages = null, tokenBody, recordsStatus = 200, networkDown = false, pages = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (networkDown) throw new TypeError(`fetch failed for ${url}`);
    const u = new URL(url);
    if (u.pathname === '/oauth/v2/token') {
      return jsonResponse(200, tokenBody ?? { access_token: ACCESS_TOKEN, expires_in: 3600 });
    }
    if (options.headers?.Authorization !== `Zoho-oauthtoken ${ACCESS_TOKEN}`) return jsonResponse(401, { code: 'INVALID_TOKEN' });
    if (u.pathname === '/bigin/v2/settings/fields') {
      if (!stages) return jsonResponse(403, { code: 'OAUTH_SCOPE_MISMATCH' });
      return jsonResponse(200, { fields: [{ api_name: 'Stage', pick_list_values: stages.map((s) => ({ display_value: s })) }] });
    }
    if (u.pathname === '/bigin/v2/Pipelines') {
      if (recordsStatus !== 200) return jsonResponse(recordsStatus, { code: 'ERROR' });
      if (pages) {
        const page = Number(u.searchParams.get('page'));
        return jsonResponse(200, { data: pages[page - 1], info: { more_records: page < pages.length } });
      }
      if (records.length === 0) return new Response(null, { status: 204 });
      return jsonResponse(200, { data: records, info: { more_records: false } });
    }
    return jsonResponse(404, {});
  };
  return { fetchImpl, calls };
}

// Starts King Tide OS. Returns helpers to sign in and call the API.
export async function startApp({ env = {}, zoho = fakeZoho(), users = USERS } = {}) {
  const config = loadConfig({ KTOS_DATA_MODE: 'live', KTOS_USERS: JSON.stringify(users), ...SECRETS, ...env });
  const sentCodes = new Map();
  const logs = [];
  const { handler } = compose(config, {
    fetchImpl: zoho.fetchImpl,
    codeSender: async ({ email, code }) => sentCodes.set(email, code),
    log: (line) => logs.push(line),
  });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = async (path, { cookie, body } = {}) => {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* static file */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  const signIn = async (email) => {
    await request('/api/auth/request-code', { body: { email } });
    const res = await request('/api/auth/verify', { body: { email, code: sentCodes.get(email) } });
    return res.headers.get('set-cookie')?.split(';')[0];
  };

  return { request, signIn, sentCodes, logs, zoho, close: () => new Promise((resolve) => server.close(resolve)) };
}
