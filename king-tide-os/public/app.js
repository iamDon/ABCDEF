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

/* ---------- Sign-in: position -> email -> code ---------- */

let publicConfig = { positions: [], demoAccounts: [], adminEmail: '' };
let chosen = null; // the position picked on the splash page
let pendingEmail = '';

function showLoginError(message) {
  $('login-error').textContent = message || '';
  $('login-error').hidden = !message;
}

function showStep(step) {
  $('position-step').hidden = step !== 'position';
  $('email-form').hidden = step !== 'email';
  $('code-form').hidden = step !== 'code';
  showLoginError('');
}

function choosePosition(position) {
  chosen = position;
  $('email-heading').textContent = `Signing in as ${position.label}`;
  // Demo only: fill in the fictional sample address for this position.
  $('email').value = publicConfig.demoAccounts.find((a) => a.role === position.role)?.email || '';
  showStep('email');
  $('email').focus();
}

async function showLogin() {
  $('dashboard-view').hidden = true;
  $('login-view').hidden = false;
  showStep('position');
  const { data } = await api('/api/public-config');
  if (data) publicConfig = data;
  for (const link of document.querySelectorAll('.contact-admin')) link.href = `mailto:${publicConfig.adminEmail}`;
  $('position-list').replaceChildren(...publicConfig.positions.map((p) => {
    const button = el('button', { type: 'button', class: 'position' },
      el('span', { class: 'position-label', text: p.label }),
      el('span', { class: 'position-title', text: p.title === p.label ? 'Site administrator' : p.title }),
      el('span', { class: 'arrow', 'aria-hidden': 'true', text: '→' }));
    button.addEventListener('click', () => choosePosition(p));
    return button;
  }));
}

$('email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  if (!email) return showLoginError('Enter your email address.');
  showLoginError('');
  const { ok, data } = await api('/api/auth/request-code', { email, role: chosen.role });
  if (!ok) return showLoginError(data?.message || 'Something went wrong. Please try again.');
  pendingEmail = email;
  showStep('code');
  $('code-sent').textContent = data.demoCode
    ? `Demo mode: your code is ${data.demoCode}. Normally it arrives by email.`
    : `${data.message} Check ${email}.`;
  $('code').value = data.demoCode || '';
  $('code').focus();
});

$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoginError('');
  const { ok, data } = await api('/api/auth/verify', { email: pendingEmail, code: $('code').value.trim() });
  if (!ok) return showLoginError(data?.message || 'That code did not work. Try again.');
  showDashboard(data.user);
});

$('email-back').addEventListener('click', () => showStep('position'));
$('code-back').addEventListener('click', () => showStep('position'));

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
    if (status === 403) return body.replaceChildren(notice('Your position does not include this section.'));
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
    setTile('customers', 'Clients', '—');
    const last = failure?.lastSuccessfulRefresh;
    $('customers-meta').textContent = last ? `Last successful update: ${formatWhen(last)}` : '';
    return;
  }
  setTile('customers', 'Clients', String(data.totalCustomers));
  $('customers-meta').replaceChildren(
    document.createTextNode(`From ${data.sourceSystem} · Last refreshed ${formatWhen(data.lastSuccessfulRefresh)} `),
    sampleBadge(data) || '');

  if (data.totalCustomers === 0) return body.replaceChildren(notice(data.message));

  const stages = el('ol', { class: 'tideline', 'aria-label': 'Clients by pipeline stage' },
    ...data.stages.map((s) => el('li', { class: `tideline-stage${s.count ? '' : ' is-empty'}` },
      el('span', { class: 'tideline-label', text: s.stage }),
      el('span', { class: 'tideline-count', text: String(s.count) }))));

  const rows = data.customers.map((c) => el('tr', {},
    el('td', { 'data-label': 'Client', class: 'cell-name' },
      c.sourceRecordUrl
        ? el('a', { href: c.sourceRecordUrl, target: '_blank', rel: 'noopener noreferrer', text: c.customerName, title: `Open in ${c.sourceSystem}` })
        : document.createTextNode(c.customerName)),
    el('td', { 'data-label': 'Stage' }, el('span', { class: 'badge badge--stage', text: c.stage })),
    el('td', { 'data-label': 'Account manager', class: c.accountManager === 'Unassigned' ? 'muted' : '', text: c.accountManager }),
    el('td', { 'data-label': 'Last updated', class: 'muted', text: formatWhen(c.lastModified) })));

  const table = el('table', { class: 'table' },
    el('thead', {}, el('tr', {},
      ...['Client', 'Stage', 'Account manager', 'Last updated'].map((h) => el('th', { scope: 'col', text: h })))),
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

const canPost = () => currentUser?.permissions.includes('announcements:post');

function renderCommunications(data, body) {
  if (!data) return setMeta('communications-meta', null, '');
  setMeta('communications-meta', data);
  if (data.items.length === 0) return body.replaceChildren(notice(data.message));
  body.replaceChildren(el('ul', { class: 'list' }, ...data.items.map((m) => {
    let remove = null;
    if (canPost() && !m.sample) {
      remove = el('button', { type: 'button', class: 'btn btn--small', text: 'Remove', 'aria-label': `Remove announcement: ${m.title}` });
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        await api('/api/communications/delete', { id: m.id });
        load('communications');
      });
    }
    return el('li', { class: 'list-item' },
      el('div', { class: 'list-main' },
        el('span', { class: 'list-title', text: m.title }),
        m.body ? el('span', { class: 'list-body', text: m.body }) : null,
        el('span', { class: 'muted', text: `${m.from} · ${formatWhen(m.when)}` })),
      remove);
  })));
}

$('announce-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('announce-error');
  error.hidden = true;
  const { ok, data } = await api('/api/communications', { title: $('announce-title').value, body: $('announce-body').value });
  if (!ok) {
    error.textContent = data?.message || 'The announcement could not be posted. Please try again.';
    error.hidden = false;
    return;
  }
  $('announce-form').reset();
  load('communications');
});

function renderCalendar(data, body) {
  if (!data) return setMeta('calendar-meta', null, '');
  setMeta('calendar-meta', data);
  body.replaceChildren(el('ul', { class: 'list' }, ...data.events.map((ev) => el('li', { class: 'list-item' },
    el('div', { class: 'list-main' },
      el('span', { class: 'list-title', text: ev.title }),
      el('span', { class: 'muted', text: `${formatWhen(ev.when)} · ${ev.where}` }))))));
}

function renderLinks() {
  $('links-body').replaceChildren(...currentUser.links.map((link) =>
    el('a', { class: 'btn btn--primary', href: link.url, target: '_blank', rel: 'noopener noreferrer', title: link.description },
      el('span', { text: link.label }), el('span', { class: 'arrow', 'aria-hidden': 'true', text: '↗' }))));
}

const SECTION_LABELS = {
  customers: 'Clients', projects: 'Projects', communications: 'Announcements', finance: 'Finance',
  calendar: 'Calendar', links: 'Shortcuts', integrations: 'Connections', access: 'Access',
};

function renderAccess(data, body) {
  if (!data) return;
  body.replaceChildren(el('ul', { class: 'list' }, ...data.roles.map((r) => {
    const people = data.people.filter((p) => p.role === r.role).map((p) => p.name).join(', ') || 'Nobody assigned';
    const sees = r.sections.map((s, i) => `${i + 1}. ${SECTION_LABELS[s] || s}`).join('   ');
    return el('li', { class: 'list-item' },
      el('div', { class: 'list-main' },
        el('span', { class: 'list-title', text: `${r.title} — ${people}` }),
        el('span', { class: 'muted', text: sees })),
      r.canPostAnnouncements ? el('span', { class: 'badge', text: 'Can post announcements' }) : null);
  })));
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

const RENDERERS = {
  customers: renderCustomers,
  projects: renderProjects,
  communications: renderCommunications,
  finance: renderFinance,
  calendar: renderCalendar,
  integrations: renderIntegrations,
  access: renderAccess,
};

let currentUser = null;
const allowed = (name) => Boolean(currentUser?.sections.includes(name));
const load = (name) => loadSection(name, RENDERERS[name]);

async function refreshCustomers() {
  $('customers-refresh').disabled = true;
  await load('customers');
  if (allowed('integrations')) await load('integrations'); // reflects the refresh just made
  $('customers-refresh').disabled = false;
}

// Puts this founder's sections on the page in their order. The first section
// and the client table get the full width; a half-width card left alone on a
// row is widened so there are no gaps.
function layoutSections(sections) {
  const grid = document.querySelector('main.grid');
  for (const card of grid.querySelectorAll('section.card')) card.hidden = true;
  let openHalf = null;
  sections.forEach((name, index) => {
    const card = $(name);
    card.hidden = false;
    grid.append(card);
    const wide = index === 0 || name === 'customers';
    card.classList.toggle('card--wide', wide);
    if (wide) {
      openHalf?.classList.add('card--wide');
      openHalf = null;
    } else {
      openHalf = openHalf ? null : card;
    }
  });
  openHalf?.classList.add('card--wide');
}

function showDashboard(user) {
  currentUser = user;
  $('login-view').hidden = true;
  $('dashboard-view').hidden = false;

  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('greeting').textContent = `${partOfDay}, ${user.name.split(' ')[0]}.`;
  $('today').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());
  $('user-chip').textContent = `${user.name} · ${user.roleLabel}`;
  $('sample-banner').hidden = user.dataMode !== 'demo';
  $('announce-form').hidden = !canPost();
  for (const link of document.querySelectorAll('.contact-admin')) if (publicConfig.adminEmail) link.href = `mailto:${publicConfig.adminEmail}`;

  tiles.clear();
  $('tiles').replaceChildren();
  if (allowed('customers')) setTile('customers', 'Clients', '…');
  if (allowed('projects')) setTile('projects', 'Active projects', '…');

  // Only sections this position may see are shown or requested; the server
  // enforces the same rule on every request.
  layoutSections(user.sections);
  for (const name of user.sections) {
    if (name === 'links') renderLinks();
    else if (name !== 'customers' && name !== 'integrations') load(name);
  }
  if (allowed('customers')) refreshCustomers();
  else if (allowed('integrations')) load('integrations');
}

$('customers-refresh').addEventListener('click', refreshCustomers);

const me = await api('/api/me');
if (me.ok) {
  api('/api/public-config').then(({ data }) => { if (data) publicConfig = data; });
  showDashboard(me.data.user);
} else {
  showLogin();
}
