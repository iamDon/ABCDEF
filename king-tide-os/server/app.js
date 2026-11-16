// HTTP layer: serves the dashboard files and a small JSON API.
// Every /api route except sign-in checks authentication, then authorization,
// before any data is requested.
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMISSIONS, can, describeAccess, listPositions, viewFor } from './auth/roles.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const COOKIE = 'ktos_session';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function createApp({ config, auth, customerLogic, modules, announcements, health, log = console.error }) {
  const cookieFlags = `HttpOnly; SameSite=Lax; Path=/${config.secureCookies ? '; Secure' : ''}`;

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...headers,
    });
    res.end(JSON.stringify(body));
  };

  const sessionId = (req) => {
    const match = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
    return match ? match[1] : null;
  };

  // Returns the user when allowed; otherwise answers 401/403 and returns null.
  const authorize = (req, res, permission) => {
    const user = auth.getUser(sessionId(req));
    if (!user) {
      send(res, 401, { error: 'not_authenticated', message: 'Please sign in.' });
      return null;
    }
    if (permission && !can(user, permission)) {
      send(res, 403, { error: 'not_authorized', message: 'Your role does not include access to this information.' });
      return null;
    }
    return user;
  };

  const publicUser = (user) => ({
    name: user.name,
    email: user.email,
    role: user.role,
    ...viewFor(user.role), // roleLabel, sections (in order), links, permissions
    dataMode: config.dataMode,
  });

  const routes = {
    // Public: what the sign-in page needs. Position titles only — no names
    // or real email addresses. Sample addresses are fictional.
    'GET /api/public-config': async (req, res) => {
      send(res, 200, {
        dataMode: config.dataMode,
        adminEmail: config.adminEmail,
        positions: listPositions(),
        demoAccounts: config.usingSampleUsers && config.showLoginCodes
          ? config.users.map((u) => ({ role: u.role, email: u.emails[0] }))
          : [],
      });
    },

    'POST /api/auth/request-code': async (req, res) => {
      const body = await readJson(req);
      if (!body) return send(res, 400, { error: 'bad_request' });
      let code;
      try {
        code = await auth.requestCode(body.email, body.role);
      } catch (err) {
        log(`[auth] Could not deliver a sign-in code: ${err?.code || err?.name || 'error'}`);
        return send(res, 503, { error: 'email_unavailable', message: 'We could not send your code right now. Please try again, or contact the admin.' });
      }
      // Same answer whether or not the email is approved for that position.
      const reply = { message: 'If that email matches the position you chose, a sign-in code is on its way.' };
      if (config.showLoginCodes && code) reply.demoCode = code;
      send(res, 200, reply);
    },

    'POST /api/auth/verify': async (req, res) => {
      const body = await readJson(req);
      const result = body && auth.verifyCode(body.email, body.code);
      if (!result) return send(res, 401, { error: 'invalid_code', message: 'That code is not valid or has expired.' });
      send(res, 200, { user: publicUser(result.user) }, {
        'Set-Cookie': `${COOKIE}=${result.sessionId}; Max-Age=${result.maxAgeSeconds}; ${cookieFlags}`,
      });
    },

    'POST /api/auth/logout': async (req, res) => {
      auth.logout(sessionId(req));
      send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Max-Age=0; ${cookieFlags}` });
    },

    'GET /api/me': async (req, res) => {
      const user = authorize(req, res);
      if (user) send(res, 200, { user: publicUser(user) });
    },

    'GET /api/customers': async (req, res) => {
      if (!authorize(req, res, PERMISSIONS.customers)) return;
      const snapshot = await customerLogic.getSnapshot();
      send(res, snapshot.status === 'ok' ? 200 : 503, snapshot);
    },

    'GET /api/projects': async (req, res) => {
      if (authorize(req, res, PERMISSIONS.projects)) send(res, 200, modules.get('projects'));
    },

    'GET /api/communications': async (req, res) => {
      if (authorize(req, res, PERMISSIONS.communications)) send(res, 200, announcements.list());
    },

    'POST /api/communications': async (req, res) => {
      const user = authorize(req, res, PERMISSIONS.postAnnouncements);
      if (!user) return;
      const item = announcements.post((await readJson(req)) || {}, user);
      if (!item) return send(res, 400, { error: 'bad_request', message: 'An announcement needs a title.' });
      send(res, 201, { item });
    },

    'POST /api/communications/delete': async (req, res) => {
      if (!authorize(req, res, PERMISSIONS.postAnnouncements)) return;
      const body = await readJson(req);
      send(res, announcements.remove(body?.id) ? 200 : 404, { ok: true });
    },

    'GET /api/calendar': async (req, res) => {
      if (authorize(req, res, PERMISSIONS.calendar)) send(res, 200, modules.get('calendar'));
    },

    // Admin only: who can sign in and what each position sees. No email addresses.
    'GET /api/access': async (req, res) => {
      if (authorize(req, res, PERMISSIONS.access)) send(res, 200, { status: 'ok', roles: describeAccess(), people: auth.listPeople() });
    },

    'GET /api/finance': async (req, res) => {
      if (authorize(req, res, PERMISSIONS.finance)) send(res, 200, modules.get('finance'));
    },

    'GET /api/integrations': async (req, res) => {
      if (authorize(req, res, PERMISSIONS.integrations)) send(res, 200, { integrations: health.list() });
    },
  };

  return async function handler(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      const route = routes[`${req.method} ${pathname}`];
      if (route) return await route(req, res);
      if (pathname.startsWith('/api/')) return send(res, 404, { error: 'not_found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method_not_allowed' });
      return await serveStatic(pathname, res);
    } catch (err) {
      console.error(`[app] ${req.method} ${pathname} failed: ${err?.message}`);
      if (!res.headersSent) send(res, 500, { error: 'server_error', message: 'Something went wrong. Please try again.' });
      else res.end();
    }
  };
}

// Accepts only small JSON bodies. Requiring a JSON content type also blocks
// cross-site form posts.
async function readJson(req) {
  if (!/^application\/json/i.test(req.headers['content-type'] || '')) return null;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) return null;
  }
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

async function serveStatic(pathname, res) {
  let relative;
  try {
    relative = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  } catch {
    relative = sep; // malformed URL -> 404 below
  }
  const file = join(PUBLIC_DIR, relative);
  const type = MIME[extname(file)];
  if (!file.startsWith(PUBLIC_DIR + sep) || !type) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    return res.end('Not found');
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Not found');
  }
}
