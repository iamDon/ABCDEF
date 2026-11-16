// Authentication: passwordless sign-in with a one-time email code.
//   choose position -> approved email -> one-time code -> session -> role
// State is kept in memory (a restart signs everyone out), which is enough for
// five founders and avoids adding a database.
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 5; // per email address
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

const normalize = (value) => String(value || '').trim().toLowerCase();

export class AuthService {
  // users: [{ name, role, emails: [...] }]
  // codeSender: async ({ email, name, code }) => void  — delivers the code.
  constructor({ users, codeSender, now = () => Date.now() }) {
    this.users = new Map(); // email -> { name, role, email }
    for (const u of users) {
      for (const email of u.emails || []) {
        this.users.set(normalize(email), { name: u.name, role: String(u.role).toUpperCase(), email: normalize(email) });
      }
    }
    this.codeSender = codeSender;
    this.now = now;
    this.codes = new Map(); // email -> { code, expiresAt, attempts }
    this.requests = new Map(); // email -> [timestamps]
    this.sessions = new Map(); // sessionId -> { email, expiresAt }
  }

  // Sends a code when the email is approved AND belongs to the chosen
  // position. Returns the code in that case (the caller decides whether it may
  // be shown) and null otherwise. Callers must answer identically either way
  // so the sign-in page does not reveal which emails are approved.
  async requestCode(email, role) {
    const user = this.users.get(normalize(email));
    if (!user || user.role !== normalize(role).toUpperCase()) return null;

    const recent = (this.requests.get(user.email) || []).filter((t) => this.now() - t < REQUEST_WINDOW_MS);
    if (recent.length >= MAX_CODES_PER_WINDOW) return null; // quietly stop flooding an inbox
    this.requests.set(user.email, [...recent, this.now()]);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.codes.set(user.email, { code, expiresAt: this.now() + CODE_TTL_MS, attempts: 0 });
    await this.codeSender({ email: user.email, name: user.name, code });
    return code;
  }

  // Returns { sessionId, user } on success, otherwise null.
  verifyCode(email, code) {
    const key = normalize(email);
    const entry = this.codes.get(key);
    const user = this.users.get(key);
    if (!entry || !user) return null;
    if (this.now() > entry.expiresAt || entry.attempts >= MAX_ATTEMPTS) {
      this.codes.delete(key);
      return null;
    }
    entry.attempts += 1;
    const given = Buffer.from(String(code || '').trim());
    const expected = Buffer.from(entry.code);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    this.codes.delete(key); // one-time use
    const sessionId = randomBytes(32).toString('hex');
    this.sessions.set(sessionId, { email: key, expiresAt: this.now() + SESSION_TTL_MS });
    return { sessionId, user, maxAgeSeconds: SESSION_TTL_MS / 1000 };
  }

  getUser(sessionId) {
    const session = sessionId && this.sessions.get(sessionId);
    if (!session) return null;
    if (this.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return this.users.get(session.email) || null;
  }

  logout(sessionId) {
    this.sessions.delete(sessionId);
  }

  // For the admin panel: one row per founder, without email addresses.
  listPeople() {
    const people = new Map();
    for (const u of this.users.values()) {
      const key = `${u.role}|${u.name}`;
      const p = people.get(key) || { name: u.name, role: u.role, emailCount: 0 };
      p.emailCount += 1;
      people.set(key, p);
    }
    return [...people.values()];
  }
}
