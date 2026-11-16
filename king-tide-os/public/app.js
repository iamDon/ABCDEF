// King Tide OS dashboard. Talks only to this app's own /api — never to Zoho
// or any other external service — and holds no credentials.
// All data is written with textContent, never as HTML.

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  return { ok: res.ok, status: res.status, data };
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const formatWhen = (iso, fmt = dateTime) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? fmt.format(d) : '—';
};
// Date-only values ("2026-12-04") must not shift a day in western time zones.
const formatDay = (day) => formatWhen(day ? `${day}T12:00:00` : null, dateOnly);

/* ---------- Sign-in ---------- */

let pendingEmail = '';

function showLoginError(message) {
  $('login-error').textContent = message || '';
  $('login-error').hidden = !message;
}

async function requestCode(email) {
  showLoginError('');
  const { ok, data } = await api('/api/auth/request-code', { email });
  if (!ok) return showLoginError('Enter the email address you use for King Tide.');
  pendingEmail = email;
  $('email-form').hidden = true;
  $('code-form').hidden = false;
  $('code-sent').textContent = data.demoCode
    ? `Demo mode: your code is ${data.demoCode}. In production it would arrive by email.`
    : `${data.message} Enter it below.`;
  $('code').value = data.demoCode || '';
  $('code').focus();
}

async function showLogin() {
  $('dashboard-view').hidden = true;
  $('login-view').hidden = false;
  $('email-form').hidden = false;
  $('code-form').hidden = true;
  showLoginError('');
  const { data } = await api('/api/public-config');
  const accounts = data?.demoAccounts || [];
  $('demo-accounts').hidden = accounts.length === 0;
  $('demo-account-list').replaceChildren(...accounts.map((a) => {
    const chip = el('button', { type: 'button', class: 'chip', text: a.role === 'FOUNDER' ? 'Founder' : a.role });
    chip.addEventListener('click', () => { $('email').value = a.email; requestCode(a.email); });
    return chip;
  }));
}

$('email-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  if (!email) return showLoginError('Enter your work email.');
  requestCode(email);
});

$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoginError('');
  const { ok, data } = await api('/api/auth/verify', { email: pendingEmail, code: $('code').value.trim() });
  if (!ok) return showLoginError(data?.message || 'That code did not work. Try again.');
  showDashboard(data.user);
});

$('code-back').addEventListener('click', showLogin);

$('sign-out').addEventListener('click', async () => {
  await api('/api/auth/logout', {});
  showLogin();
});

/* ---------- Dashboard ---------- */

const tiles = new Map(); // key -> { label, value }

function setTile(key, label, value) {
  tiles.set(key, { label, value });
  $('tiles').replaceChildren(...[...tiles.values()].map((t) =>
    el('div', { class: 'tile' }, el('span', { class: 'tile-label', text: t.label }), el('span', { class: 'tile-value', text: t.value }))));
}

const sampleBadge = (data) => (data?.isSampleData ? el('span', { class: 'badge badge--sample', text: 'Sample data' }) : null);
const notice = (message, kind = 'info') => el('p', { class: `notice notice--${kind}`, text: message });

function setMeta(id, data, fallback = '') {
  const source = data?.sourceSystem ? `From ${data.sourceSystem}` : fallback;
  $(id).replaceChildren(document.createTextNode(source ? `${source} ` : ''), sampleBadge(data) || '');
}

// Loads one dashboard section. A failure here stays inside this section.
async function loadSection(name, render) {
  const body = $(`${name}-body`);
  body.replaceChildren(el('p', { class: 'loading', text: 'Loading…' }));
  try {
    const { status, data } = await api(`/api/${name}`);
    if (status === 401) return showLogin();
    if (data?.status === 'ok' || (name === 'integrations' && data?.integrations)) return render(data, body);
    body.replaceChildren(notice(data?.message || 'This section is temporarily unavailable. Please try again later.',
      data?.status === 'not_connected' ? 'info' : 'warn'));
    return render(null, null, data);
  } catch {
    body.replaceChildren(notice('This section is temporarily unavailable. Please try again later.', 'warn'));
    return render(null, null, null);
  }
}

function renderCustomers(data, body, failure) {
  if (!data) {
    setTile('customers', 'Customers', '—');
    const last = failure?.lastSuccessfulRefresh;
    $('customers-meta').textContent = last ? `Last successful update: ${formatWhen(last)}` : '';
    return;
  }
  setTile('customers', 'Customers', String(data.totalCustomers));
  $('customers-meta').replaceChildren(
    document.createTextNode(`From ${data.sourceSystem} · Last refreshed ${formatWhen(data.lastSuccessfulRefresh)} `),
    sampleBadge(data) || '');

  if (data.totalCustomers === 0) return body.replaceChildren(notice(data.message));

  const stages = el('ol', { class: 'tideline', 'aria-label': 'Customers by pipeline stage' },
    ...data.stages.map((s) => el('li', { class: `tideline-stage${s.count ? '' : ' is-empty'}` },
      el('span', { class: 'tideline-label', text: s.stage }),
      el('span', { class: 'tideline-count', text: String(s.count) }))));

  const rows = data.customers.map((c) => el('tr', {},
    el('td', { 'data-label': 'Customer', class: 'cell-name' },
      c.sourceRecordUrl
        ? el('a', { href: c.sourceRecordUrl, target: '_blank', rel: 'noopener noreferrer', text: c.customerName, title: `Open in ${c.sourceSystem}` })
        : document.createTextNode(c.customerName)),
    el('td', { 'data-label': 'Stage' }, el('span', { class: 'badge badge--stage', text: c.stage })),
    el('td', { 'data-label': 'Account manager', class: c.accountManager === 'Unassigned' ? 'muted' : '', text: c.accountManager }),
    el('td', { 'data-label': 'Last updated', class: 'muted', text: formatWhen(c.lastModified) })));

  const table = el('table', { class: 'table' },
    el('thead', {}, el('tr', {},
      ...['Customer', 'Stage', 'Account manager', 'Last updated'].map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', {}, ...rows));

  body.replaceChildren(stages, table);
}

function renderProjects(data, body) {
  if (!data) { setTile('projects', 'Active projects', '—'); return setMeta('projects-meta', null, ''); }
  setMeta('projects-meta', data);
  setTile('projects', 'Active projects', String(data.projects.length));
  body.replaceChildren(el('ul', { class: 'list' }, ...data.projects.map((p) => el('li', { class: 'list-item' },
    el('div', { class: 'list-main' },
      el('span', { class: 'list-title', text: p.name }),
      el('span', { class: 'muted', text: `${p.owner} · Next: ${p.nextMilestone} (${formatDay(p.due)})` })),
    el('span', { class: `badge badge--status${p.status === 'At risk' ? ' is-risk' : ''}`, text: p.status })))));
}

function renderCommunications(data, body) {
  if (!data) return setMeta('communications-meta', null, '');
  setMeta('communications-meta', data);
  body.replaceChildren(el('ul', { class: 'list' }, ...data.items.map((m) => el('li', { class: 'list-item' },
    el('div', { class: 'list-main' },
      el('span', { class: 'list-title', text: m.title }),
      el('span', { class: 'muted', text: `${m.from} · ${formatWhen(m.when)}` }))))));
}

function renderFinance(data, body) {
  if (!data) return setMeta('finance-meta', null, '');
  setMeta('finance-meta', data);
  body.replaceChildren(el('dl', { class: 'figures' }, ...data.figures.map((f) =>
    el('div', { class: 'figure' }, el('dt', { text: f.label }), el('dd', { text: f.value })))));
}

const STATE_LABELS = { connected: 'Connected', sample: 'Sample data', pending: 'Checking', error: 'Not responding', planned: 'Planned' };

function renderIntegrations(data, body) {
  if (!data) return;
  body.replaceChildren(el('ul', { class: 'list' }, ...data.integrations.map((i) => el('li', { class: 'list-item' },
    el('div', { class: 'list-main' },
      el('span', { class: 'list-title', text: i.name }),
      el('span', { class: 'muted', text: i.lastSuccessfulRefresh ? `Last successful update ${formatWhen(i.lastSuccessfulRefresh)}` : i.note })),
    el('span', { class: `badge badge--state is-${i.state}`, text: STATE_LABELS[i.state] || i.state })))));
}

const SECTIONS = [
  { name: 'customers', permission: 'customers:view', render: renderCustomers },
  { name: 'projects', permission: 'projects:view', render: renderProjects },
  { name: 'communications', permission: 'communications:view', render: renderCommunications },
  { name: 'finance', permission: 'finance:view', render: renderFinance },
  { name: 'integrations', permission: 'integrations:view', render: renderIntegrations },
];

let currentUser = null;
const allowed = (name) => currentUser?.permissions.includes(SECTIONS.find((s) => s.name === name).permission);
const load = (name) => loadSection(name, SECTIONS.find((s) => s.name === name).render);

async function refreshCustomers() {
  $('customers-refresh').disabled = true;
  await load('customers');
  if (allowed('integrations')) await load('integrations'); // reflects the refresh just made
  $('customers-refresh').disabled = false;
}

function showDashboard(user) {
  currentUser = user;
  $('login-view').hidden = true;
  $('dashboard-view').hidden = false;

  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('greeting').textContent = `${partOfDay}, ${user.name.split(' ')[0]}.`;
  $('today').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());
  $('user-chip').textContent = `${user.name} · ${user.role}`;
  $('sample-banner').hidden = user.dataMode !== 'demo';

  tiles.clear();
  $('tiles').replaceChildren();
  if (allowed('customers')) setTile('customers', 'Customers', '…');
  if (allowed('projects')) setTile('projects', 'Active projects', '…');
  // Only sections this role may see are shown or requested; the server
  // enforces the same rule on every request.
  for (const s of SECTIONS) $(s.name).hidden = !allowed(s.name);
  for (const s of SECTIONS) {
    if (s.name === 'customers' || s.name === 'integrations' || !allowed(s.name)) continue;
    load(s.name);
  }
  if (allowed('customers')) refreshCustomers();
  else if (allowed('integrations')) load('integrations');
}

$('customers-refresh').addEventListener('click', refreshCustomers);

const me = await api('/api/me');
if (me.ok) showDashboard(me.data.user);
else showLogin();
