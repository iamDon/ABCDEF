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

## Open transcription questions

Move badge colors on the first batch of cards are confirmed. Still open: whether Wilhelm's move 3, "Doge and Counter," is printed as-is or should read "Dodge and Counter."
