// Authentication, role-based access (R-04) and credential protection (R-07).
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { AuthService } from '../server/auth/authService.js';
import { ALL_SECRET_VALUES, fakeZoho, startApp, USERS } from './helpers.js';

test('Sign-in: correct code starts a session; sign-out ends it', async () => {
  const app = await startApp();
  try {
    const cookie = await app.signIn('ceo@test.example');
    assert.match(cookie, /^ktos_session=[a-f0-9]{64}$/);
    const me = await app.request('/api/me', { cookie });
    assert.equal(me.json.user.role, 'CEO');
    await app.request('/api/auth/logout', { cookie, body: {} });
    assert.equal((await app.request('/api/me', { cookie })).status, 401);
  } finally { await app.close(); }
});

test('Sign-in: session cookie is HttpOnly and codes are not returned outside demo mode', async () => {
  const app = await startApp();
  try {
    const requested = await app.request('/api/auth/request-code', { body: { email: 'ceo@test.example' } });
    assert.equal(requested.json.demoCode, undefined);
    const verified = await app.request('/api/auth/verify', { body: { email: 'ceo@test.example', code: app.sentCodes.get('ceo@test.example') } });
    assert.match(verified.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  } finally { await app.close(); }
});

test('Sign-in: unapproved email gets the same reply, no code and no session', async () => {
  const app = await startApp();
  try {
    const approved = await app.request('/api/auth/request-code', { body: { email: 'ceo@test.example' } });
    const stranger = await app.request('/api/auth/request-code', { body: { email: 'stranger@elsewhere.example' } });
    assert.deepEqual(stranger.json, approved.json);
    assert.equal(app.sentCodes.has('stranger@elsewhere.example'), false);
    const verify = await app.request('/api/auth/verify', { body: { email: 'stranger@elsewhere.example', code: '000000' } });
    assert.equal(verify.status, 401);
  } finally { await app.close(); }
});

test('Sign-in: wrong, reused, expired and over-attempted codes are rejected', async () => {
  let now = 1_000_000;
  let sent;
  const auth = new AuthService({ users: USERS, codeSender: async ({ code }) => { sent = code; }, now: () => now });
  const email = 'ceo@test.example';

  await auth.requestCode(email);
  const wrong = sent === '000000' ? '000001' : '000000';
  assert.equal(auth.verifyCode(email, wrong), null);
  assert.ok(auth.verifyCode(email, sent));
  assert.equal(auth.verifyCode(email, sent), null, 'codes are single-use');

  await auth.requestCode(email);
  now += 11 * 60 * 1000;
  assert.equal(auth.verifyCode(email, sent), null, 'codes expire after 10 minutes');

  await auth.requestCode(email);
  const bad = sent === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i += 1) auth.verifyCode(email, bad);
  assert.equal(auth.verifyCode(email, sent), null, 'locked after 5 wrong attempts');
});

test('R-04 role-based access: finance and integration status are limited by role', async () => {
  const app = await startApp();
  try {
    const ceo = await app.signIn('ceo@test.example');
    const cmo = await app.signIn('cmo@test.example');
    assert.equal((await app.request('/api/finance', { cookie: ceo })).status, 200);
    assert.equal((await app.request('/api/finance', { cookie: cmo })).status, 403);
    assert.equal((await app.request('/api/integrations', { cookie: cmo })).status, 403);
    assert.equal((await app.request('/api/projects', { cookie: cmo })).status, 200);
    for (const path of ['/api/projects', '/api/communications', '/api/finance', '/api/integrations', '/api/me']) {
      assert.equal((await app.request(path)).status, 401, `${path} requires sign-in`);
    }
  } finally { await app.close(); }
});

test('R-07 credentials never reach the browser', async () => {
  const records = [{ id: '1', Deal_Name: 'Acme', Stage: 'Contacted', Owner: { name: 'Don' } }];
  const app = await startApp({ zoho: fakeZoho({ records }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const paths = ['/', '/app.js', '/styles.css', '/api/public-config', '/api/me', '/api/customers', '/api/integrations'];
    for (const path of paths) {
      const { text } = await app.request(path, { cookie });
      for (const secret of ALL_SECRET_VALUES) assert.ok(!text.includes(secret), `${path} must not contain a credential`);
    }
    // Front-end files do not talk to Zoho or mention its credentials at all.
    for (const file of (await readdir(new URL('../public/', import.meta.url))).filter((f) => /\.(html|js|css)$/.test(f))) {
      const source = await readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
      assert.ok(!/zohoapis|accounts\.zoho|client_secret|refresh_token/i.test(source), `${file} must not reference Zoho credentials`);
    }
    // Files outside public/ cannot be fetched.
    for (const path of ['/../server/config.js', '/%2e%2e/.env', '/.env', '/..%2f.env.example']) {
      assert.equal((await app.request(path)).status, 404);
    }
  } finally { await app.close(); }
});

test('Demo mode serves fictional sample data through the same customer pipeline', async () => {
  const app = await startApp({ env: { KTOS_DATA_MODE: 'demo' } });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { json } = await app.request('/api/customers', { cookie });
    assert.equal(json.status, 'ok');
    assert.equal(json.isSampleData, true);
    assert.ok(json.totalCustomers > 0);
    assert.ok(json.customers.some((c) => c.accountManager === 'Unassigned'));
    assert.equal(app.zoho.calls.length, 0, 'demo mode makes no external calls');
  } finally { await app.close(); }
});
