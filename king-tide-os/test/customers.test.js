// Acceptance tests for the Zoho Bigin customer slice (TC-01 … TC-07).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapBiginRecordToCustomer } from '../server/integrations/bigin/biginAdapter.js';
import { ALL_SECRET_VALUES, fakeZoho, startApp } from './helpers.js';

const STAGES = ['Contacted', 'Contacted Again', 'Contract Phase', 'Paid Phase', 'Development Phase', 'Follow-up', 'Onboarding'];
const RECORDS = [
  { id: '11', Deal_Name: 'High Wire Electric', Stage: 'Development Phase', Owner: { name: 'Don', id: 'u1' }, Pipeline: { name: 'Sales Pipeline', id: 'p1' }, Modified_Time: '2026-11-15T15:42:00-05:00' },
  { id: '12', Deal_Name: 'Tidewater Bakery', Stage: 'Contacted', Owner: { name: 'Avery', id: 'u2' }, Pipeline: { name: 'Sales Pipeline', id: 'p1' }, Modified_Time: '2026-11-14T09:00:00-05:00' },
  { id: '13', Deal_Name: 'Harbor Lights Inn', Stage: 'Onboarding', Owner: { name: 'Don', id: 'u1' }, Pipeline: { name: 'Sales Pipeline', id: 'p1' }, Modified_Time: '2026-11-13T12:30:00-05:00' },
];

const assertNoSecrets = (text) => {
  for (const secret of ALL_SECRET_VALUES) assert.ok(!text.includes(secret), 'response must not contain a credential');
};

test('Brief example: a raw Bigin record becomes a King Tide OS customer', () => {
  const customer = mapBiginRecordToCustomer(
    { id: '42', Deal_Name: 'High Wire Electric', Stage: 'Development Phase', Owner: { name: 'Don' }, Modified_Time: '2026-11-15 15:42' },
    { recordUrlTemplate: 'https://bigin.example/deals/{id}' },
  );
  assert.deepEqual(customer, {
    customerId: '42',
    customerName: 'High Wire Electric',
    stage: 'Development Phase',
    accountManager: 'Don',
    pipeline: null,
    lastModified: '2026-11-15 15:42',
    sourceSystem: 'Zoho Bigin',
    sourceRecordUrl: 'https://bigin.example/deals/42',
  });
});

test('TC-01 successful Bigin retrieval shows name, stage and account manager', async () => {
  const app = await startApp({ zoho: fakeZoho({ records: RECORDS, stages: STAGES }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { status, json } = await app.request('/api/customers', { cookie });
    assert.equal(status, 200);
    assert.equal(json.status, 'ok');
    assert.equal(json.totalCustomers, 3);
    assert.equal(json.sourceSystem, 'Zoho Bigin');
    assert.ok(!Number.isNaN(Date.parse(json.lastSuccessfulRefresh)), 'records the last successful refresh');
    for (const c of json.customers) assert.ok(c.customerName && c.stage && c.accountManager);
    // Read-only: King Tide OS only ever sends GET requests to Bigin.
    const biginCalls = app.zoho.calls.filter((c) => c.url.includes('/bigin/'));
    assert.ok(biginCalls.length > 0 && biginCalls.every((c) => c.method === 'GET'));
  } finally { await app.close(); }
});

test('TC-02 displayed customers match the Bigin source records', async () => {
  const app = await startApp({ zoho: fakeZoho({ records: RECORDS, stages: STAGES }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { json } = await app.request('/api/customers', { cookie });
    assert.deepEqual(
      json.customers.map((c) => [c.customerId, c.customerName, c.stage, c.accountManager, c.lastModified]),
      RECORDS.map((r) => [r.id, r.Deal_Name, r.Stage, r.Owner.name, r.Modified_Time]),
    );
    // Stages are listed in Bigin's configured order, not re-sorted, and counts add up.
    assert.deepEqual(json.stages.map((s) => s.stage), STAGES);
    assert.equal(json.stages.reduce((n, s) => n + s.count, 0), RECORDS.length);
  } finally { await app.close(); }
});

test('TC-02b all pages of Bigin records are retrieved', async () => {
  const app = await startApp({ zoho: fakeZoho({ pages: [RECORDS.slice(0, 2), RECORDS.slice(2)] }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { json } = await app.request('/api/customers', { cookie });
    assert.equal(json.totalCustomers, 3);
  } finally { await app.close(); }
});

test('TC-03 empty data shows "No customers currently available."', async () => {
  const app = await startApp({ zoho: fakeZoho({ records: [] }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { status, json } = await app.request('/api/customers', { cookie });
    assert.equal(status, 200);
    assert.equal(json.status, 'ok');
    assert.deepEqual(json.customers, []);
    assert.equal(json.message, 'No customers currently available.');
  } finally { await app.close(); }
});

test('TC-04 Bigin outage: customers unavailable, other modules still work, nothing sensitive shown', async () => {
  const app = await startApp({ zoho: fakeZoho({ networkDown: true }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const customers = await app.request('/api/customers', { cookie });
    assert.equal(customers.status, 503);
    assert.equal(customers.json.status, 'unavailable');
    assert.equal(customers.json.message, 'Customer data is temporarily unavailable. Please try again later.');
    assert.equal(customers.json.customers, undefined);
    assertNoSecrets(customers.text);
    assert.ok(!/zoho|fetch failed|stack/i.test(customers.text), 'no raw error details');

    for (const path of ['/api/me', '/api/projects', '/api/communications', '/api/finance', '/api/integrations', '/']) {
      assert.equal((await app.request(path, { cookie })).status, 200, `${path} still works`);
    }
    const { json } = await app.request('/api/integrations', { cookie });
    assert.equal(json.integrations.find((i) => i.id === 'bigin').state, 'error');
    assertNoSecrets(JSON.stringify(json) + app.logs.join('\n'));
  } finally { await app.close(); }
});

test('TC-04b Bigin server error is handled the same way', async () => {
  const app = await startApp({ zoho: fakeZoho({ recordsStatus: 500 }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { status, json } = await app.request('/api/customers', { cookie });
    assert.equal(status, 503);
    assert.equal(json.status, 'unavailable');
  } finally { await app.close(); }
});

test('TC-05 invalid or expired Bigin credential fails safely', async () => {
  const app = await startApp({ zoho: fakeZoho({ records: RECORDS, tokenBody: { error: 'invalid_code' } }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const customers = await app.request('/api/customers', { cookie });
    assert.equal(customers.status, 503);
    assert.equal(customers.json.message, 'Customer data is temporarily unavailable. Please try again later.');
    assertNoSecrets(customers.text + app.logs.join('\n'));
    assert.equal((await app.request('/api/projects', { cookie })).status, 200, 'application remains operational');
  } finally { await app.close(); }
});

test('TC-06 a customer without an account manager shows "Unassigned"', async () => {
  const records = [{ id: '21', Deal_Name: 'Bogue Banks Realty', Stage: 'Contacted', Owner: null }, { id: '22', Deal_Name: 'No Stage Co' }];
  const app = await startApp({ zoho: fakeZoho({ records }) });
  try {
    const cookie = await app.signIn('ceo@test.example');
    const { status, json } = await app.request('/api/customers', { cookie });
    assert.equal(status, 200);
    assert.equal(json.customers[0].accountManager, 'Unassigned');
    assert.equal(json.customers[1].stage, 'No stage');
    assert.equal(json.customers[1].accountManager, 'Unassigned');
  } finally { await app.close(); }
});

test('TC-07 unauthenticated or unauthorized users get no customer data', async () => {
  const app = await startApp({ zoho: fakeZoho({ records: RECORDS }) });
  try {
    const anonymous = await app.request('/api/customers');
    assert.equal(anonymous.status, 401);
    assert.ok(!anonymous.text.includes('High Wire Electric'));

    const forged = await app.request('/api/customers', { cookie: `ktos_session=${'a'.repeat(64)}` });
    assert.equal(forged.status, 401);

    const guestCookie = await app.signIn('guest@test.example');
    const guest = await app.request('/api/customers', { cookie: guestCookie });
    assert.equal(guest.status, 403);
    assert.ok(!guest.text.includes('High Wire Electric'));

    assert.equal(app.zoho.calls.length, 0, 'Bigin is never contacted for a denied request');
  } finally { await app.close(); }
});
