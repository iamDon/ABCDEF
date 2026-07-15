import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf-8'));

// v1 scope: only cards with fixed numeric Life/Defense and no dependency on
// another card being in play (Weapons attach, Summons are brought in,
// Titans/Traps have bespoke battlefield-wide or face-down mechanics).
const PLAYABLE_TYPES = new Set(['Character', 'Commander']);

export const ALL_CARDS = raw.cards;

export const PLAYABLE_CARDS = raw.cards.filter(
  (c) => PLAYABLE_TYPES.has(c.cardType) && typeof c.life === 'number' && typeof c.defense === 'number'
);

export const CARDS_BY_ID = new Map(raw.cards.map((c) => [c.id, c]));

export function getCard(id) {
  const card = CARDS_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

export function isPlayable(id) {
  const card = CARDS_BY_ID.get(id);
  return !!card && PLAYABLE_TYPES.has(card.cardType) && typeof card.life === 'number' && typeof card.defense === 'number';
}
