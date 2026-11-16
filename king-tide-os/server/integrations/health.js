// Integration health: King Tide OS owns this small piece of state — whether
// each external system answered, and when it last answered successfully.
export class IntegrationHealth {
  constructor(now = () => new Date()) {
    this.now = now;
    this.entries = new Map();
  }

  register(id, name, state, note = '') {
    this.entries.set(id, { id, name, state, note, lastSuccessfulRefresh: null, lastFailure: null });
  }

  recordSuccess(id) {
    const e = this.entries.get(id);
    if (!e) return null;
    e.lastSuccessfulRefresh = this.now().toISOString();
    if (e.state !== 'sample') e.state = 'connected';
    e.note = '';
    return e.lastSuccessfulRefresh;
  }

  recordFailure(id, kind) {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.state !== 'sample') e.state = 'error';
    e.lastFailure = this.now().toISOString();
    e.note =
      kind === 'auth'
        ? 'Zoho rejected the saved credentials.'
        : kind === 'not_configured'
          ? 'Credentials have not been set up yet.'
          : 'The service did not respond as expected.';
  }

  lastSuccess(id) {
    return this.entries.get(id)?.lastSuccessfulRefresh || null;
  }

  list() {
    return [...this.entries.values()].map((e) => ({ ...e }));
  }
}
