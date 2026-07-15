# ABCDEF — Card Schema

Derived from the Canva card layout (Kenjto, Skylle, Wilhelm, Independence Dragon reference cards) and `GAME_RULES.md`. This describes the fields every card record needs, independent of how it's rendered visually.

## Visual layout (observed on reference cards)

- Top-left: Character name (+ optional epithet/subtitle, e.g. "The Coffin Monk")
- Top-right: EF logo mark
- Center: Character art
- Lower-left overlay on art: Species badge (hexagon), e.g. `H/ESU`, `NU`, `3S/H`, `D`
- Stat bar: `LIFE | DEFENSE | PL`
- Move list: up to 3 moves, each with a numbered circle badge whose **fill color encodes the move's Myst color** (gold / black / green — see `GAME_RULES.md` Move Colors), move name, and rules text. Moves with a printed usage cap show it in the name, e.g. `Ngombe Ngulu Cut (10x)`.
- Right-side vertical strip (when present): **Ability** text — always-on passive, separate from the 3 moves.
- Bottom banner: italic flavor text / character blurb.

## Field reference

| Field | Type | Notes |
|---|---|---|
| `id` | string (slug) | Unique, stable, used as key everywhere |
| `name` | string | Printed character name |
| `displayName` | string? | Short/nickname if the printed name differs (e.g. "Kenjto" → "Ken") |
| `epithet` | string? | Subtitle under the name, e.g. "The Coffin Monk" |
| `cardType` | enum | `Character`, `Commander`, `Weapon`, `Summon`, `Titan`, `Item`, `Trap` (see `GAME_RULES.md` §3) |
| `tags` | string[] | Free-form classification layered on species, e.g. `ESU` |
| `species` | string | Species code per `GAME_RULES.md` species table (`H`, `Nu`, `3S`, `E`, `DJ`, `D`, `OR`, `OG`, `G`, `SU`, or a hybrid like `3S/H`) |
| `life` | number | Starting Life |
| `defense` | number | Starting Defense |
| `powerLevel` | number | Informational only — not a gameplay stat |
| `moves` | Move[] | Exactly 3 for standard Character/Commander cards |
| `ability` | string \| null | Always-active passive text; `null` if the card has none printed |
| `flavorText` | string? | Bottom-banner blurb |

### Move object

| Field | Type | Notes |
|---|---|---|
| `slot` | 1‑3 | Print order |
| `name` | string | Move name |
| `color` | enum | `gold` (ambient Myst), `black` (physical/non-Myst), `green` (stored Myst) — badge fill color on the card |
| `usesLimit` | number? | Present only if the card prints a use cap (`Use Nx`); omitted = unlimited |
| `text` | string | Full rules text as printed |

## Non-Character card types

Trap, Weapon, Summon, and Titan cards reuse the same base fields but not all of them — most have no `life`/`defense`/`powerLevel`, and Trap cards have no `moves` at all.

| Field | Type | Applies to | Notes |
|---|---|---|---|
| `attachesTo` | string (card id) | Weapon | The character card this weapon equips |
| `summonedBy` | string (card id) | Summon | The card that brings this summon into play |

- **Trap**: `id`, `name`, `cardType: "Trap"`, `ability` (the trap's effect), `flavorText`. No stats, no moves.
- **Weapon**: stats usually absent (the weapon modifies its host); has `moves` and/or `ability`; set `attachesTo`.
- **Summon**: has full stats (`life`/`defense`/`powerLevel`) like a Character, since summons fight independently per `GAME_RULES.md` §Summons; set `summonedBy`.
- **Titan**: has full stats; `moves` may be empty if the card's only effect is its always-on `ability` (seen on Water Titan).

Some cards print **formulas instead of fixed numbers** for `life`/`defense`/`powerLevel` (e.g. Addie: life = "300 + total of all enemies' Defense"; Li-Ola: defense/PL = "??"). These are stored as strings rather than numbers — the game engine will need a small formula-evaluation step for this handful of cards rather than assuming every stat is a plain integer.

## Resolved transcription questions

- Wilhelm's move 3 is "Dodge and Counter" (source card printed "Doge," corrected per user).
- Li-Ola/Lola uses the revision with the opponent's-hand-stealing Ability (roll 1/3/7) and the coin-flip variant of move 3, confirmed per user.
- Wilhelm's Coffin is a Weapon card (flavor text calling it a "Summon" is just flavor, not the card type).
- Yamabe's Drive file was named "Ken Card.png" — confirmed as a misfiled/typo'd upload; game data is correctly filed under `yamabe`.

## Open transcription questions

- Several non-Character cards (Trap, Weapon, Summon, Titan) were transcribed from Google Drive's text extraction rather than the images, so **move badge colors (gold/black/green) are missing** on most of them. Per user direction, left alone for now — revisit later.
