// Talks to the Zoho Bigin REST API (v2). Read-only: this client only ever
// sends GET requests to Bigin. Everything Zoho-specific about transport
// (OAuth, URLs, paging, error shapes) lives in this file.
import { IntegrationError } from '../errors.js';

const FIELDS = ['Deal_Name', 'Stage', 'Owner', 'Pipeline', 'Sub_Pipeline', 'Account_Name', 'Modified_Time'];
const PER_PAGE = 200;
const MAX_PAGES = 10;
const TIMEOUT_MS = 10_000;

export class ZohoBiginClient {
  constructor({ clientId, clientSecret, refreshToken, accountsUrl, apiUrl, fetchImpl = fetch, now = () => Date.now() }) {
    this.credentials = { clientId, clientSecret, refreshToken };
    this.accountsUrl = accountsUrl;
    this.apiUrl = apiUrl;
    this.fetch = fetchImpl;
    this.now = now;
    this.token = null; // { value, expiresAt } — kept in memory only
  }

  // Raw deal records from Bigin's "Pipelines" module, in the order Bigin returns them.
  async listPipelineRecords() {
    const records = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const body = await this.#get(`/bigin/v2/Pipelines?fields=${FIELDS.join(',')}&page=${page}&per_page=${PER_PAGE}`);
      if (!body) break; // 204: no records
      if (!Array.isArray(body.data)) throw new IntegrationError('bad_response', 'Bigin returned an unexpected response.');
      records.push(...body.data);
      if (!body.info?.more_records) break;
    }
    return records;
  }

  // Stage names in the order configured in Bigin (the Stage picklist).
  async listStageNames() {
    const body = await this.#get('/bigin/v2/settings/fields?module=Pipelines');
    const stage = body?.fields?.find((f) => f.api_name === 'Stage');
    const names = stage?.pick_list_values?.map((v) => v.display_value).filter((v) => v && v !== '-None-');
    return names?.length ? names : null;
  }

  async #get(path, isRetry = false) {
    const token = await this.#accessToken();
    const res = await this.#request(`${this.apiUrl}${path}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.status === 204) return null;
    if (res.status === 401) {
      this.token = null;
      if (!isRetry) return this.#get(path, true); // token may have been revoked early
      throw new IntegrationError('auth', 'Bigin rejected the access token.');
    }
    if (!res.ok) throw new IntegrationError('unavailable', `Bigin responded with status ${res.status}.`);
    return this.#json(res);
  }

  async #accessToken() {
    if (this.token && this.now() < this.token.expiresAt) return this.token.value;
    const { clientId, clientSecret, refreshToken } = this.credentials;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new IntegrationError('not_configured', 'Zoho Bigin credentials are not configured.');
    }
    const res = await this.#request(`${this.accountsUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    // Zoho reports bad credentials as HTTP 200 with an "error" field.
    const body = res.ok ? await this.#json(res) : null;
    if (!body?.access_token) throw new IntegrationError('auth', 'Zoho did not issue an access token.');
    const lifetimeMs = (Number(body.expires_in) || 3600) * 1000;
    this.token = { value: body.access_token, expiresAt: this.now() + lifetimeMs - 60_000 };
    return this.token.value;
  }

  async #request(url, options) {
    try {
      return await this.fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      // Deliberately drop the underlying error: it can include the request URL.
      throw new IntegrationError('unavailable', 'Could not reach Zoho.');
    }
  }

  async #json(res) {
    try {
      return await res.json();
    } catch {
      throw new IntegrationError('bad_response', 'Zoho returned a response that was not valid JSON.');
    }
  }
}
