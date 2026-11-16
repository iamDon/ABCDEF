// Authentication: passwordless sign-in with a one-time email code.
//   approved email -> one-time code -> verified -> session -> role
// State is kept in memory (a restart signs everyone out), which is enough for
// five founders and avoids adding a database.
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const normalize = (email) => String(email || '').trim().toLowerCase();

export class AuthService {
  // codeSender: async ({ email, name, code }) => void  — delivers the code.
  constructor({ users, codeSender, now = () => Date.now() }) {
    this.users = new Map(users.map((u) => [normalize(u.email), { ...u, email: normalize(u.email) }]));
    this.codeSender = codeSender;
    this.now = now;
    this.codes = new Map(); // email -> { code, expiresAt, attempts }
    this.sessions = new Map(); // sessionId -> { email, expiresAt }
  }

  // Returns the code for approved emails (the caller decides whether it may be
  // shown) and null otherwise. Callers must respond identically either way so
  // the sign-in form does not reveal which emails are approved.
  async requestCode(email) {
    const user = this.users.get(normalize(email));
    if (!user) return null;
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
}

// Default delivery until an email provider is chosen: write the code to the
// server log, where only whoever operates the server can read it.
export const consoleCodeSender = async ({ email, code }) => {
  console.log(`[auth] Sign-in code for ${email}: ${code} (valid 10 minutes)`);
};
