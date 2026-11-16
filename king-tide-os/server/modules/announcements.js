// Announcements are one of the few things King Tide OS owns itself. They are
// kept in a small JSON file (data/announcements.json) — no database needed.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_TITLE = 140;
const MAX_BODY = 1000;
const MAX_KEPT = 200;

const SAMPLE_ITEMS = [
  { id: 'sample-1', title: 'Founders sync moved to Thursday 9:00', body: '', from: 'Marina Ellis', when: '2026-11-16T08:30:00-05:00', sample: true },
  { id: 'sample-2', title: 'Roanoke Roasters asked for a revised timeline', body: '', from: 'Reed Marsh', when: '2026-11-15T16:10:00-05:00', sample: true },
  { id: 'sample-3', title: 'New inbound lead from the Wilmington chamber mixer', body: '', from: 'Sandy Shoals', when: '2026-11-14T12:45:00-05:00', sample: true },
];

export class Announcements {
  constructor({ dataDir, includeSamples = false, now = () => new Date() }) {
    this.file = join(dataDir, 'announcements.json');
    this.dataDir = dataDir;
    this.includeSamples = includeSamples;
    this.now = now;
    try {
      this.items = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch {
      this.items = []; // first run, or unreadable file: start empty
    }
  }

  list() {
    const items = [...this.items, ...(this.includeSamples ? SAMPLE_ITEMS : [])];
    return {
      status: 'ok',
      sourceSystem: 'King Tide OS',
      isSampleData: this.includeSamples && this.items.length === 0,
      items,
      message: items.length === 0 ? 'No announcements yet.' : null,
    };
  }

  // Returns the new item, or null when the title is missing.
  post({ title, body }, author) {
    const cleanTitle = String(title || '').trim().slice(0, MAX_TITLE);
    if (!cleanTitle) return null;
    const item = {
      id: randomUUID(),
      title: cleanTitle,
      body: String(body || '').trim().slice(0, MAX_BODY),
      from: author.name,
      when: this.now().toISOString(),
    };
    this.items = [item, ...this.items].slice(0, MAX_KEPT);
    this.#save();
    return item;
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length === before) return false;
    this.#save();
    return true;
  }

  #save() {
    mkdirSync(this.dataDir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    renameSync(tmp, this.file); // replace in one step so a crash cannot leave half a file
  }
}
