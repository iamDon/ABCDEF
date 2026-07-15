// Structured, server-executable definitions for every playable card's moves.
//
// Step vocabulary (executed in order by rooms.js executeSteps):
//   damage        {target:'enemy'|'self', amount, aoe?, ignoreDefense?, direct?}
//                 direct = raw life loss (costs/recoil): skips attack mods, myst and Defense.
//   coinDamage    {flips, perHeads, perTails}          damage = H*perHeads + T*perTails
//   mystDamage    {values:{Low,Medium,High}}           explicit per-myst damage (no gold mod on top)
//   dice          {sides:6|10|'input', branches}       branches: {even,odd} or {numbers,hit,miss}
//   heal          {target:'self', amount}
//   setLife       {amount}                              resets the user's Life to amount
//   defense       {target:'enemy'|'self', delta, turns?} turns omitted = lasts rest of battle
//   skip          {target:'enemy'|'self', turns}
//   buffAttack    {amount, mode:'attacks'|'turns'|'permanent', left}   on the user
//   debuffEnemyAttack {amount, turns}                   enemy's outgoing damage -amount
//   delayed       {turns, label, steps}                 fires at start of user's Nth turn from now
//   reveal        {}                                    show opponent's hand to the user (one-time)
//   offerReset    {refuseDamage}                        Xinyu: opponent chooses reset-or-take-damage
//
// "Wait 1 turn. Next turn does X" => delayed turns:1. "Wait 2 turns, on the 3rd turn X" => turns:3.

export const MOVE_DEFS = {
  kenjto: {
    1: { color: 'gold', steps: [{ type: 'debuffEnemyAttack', amount: 50, turns: 2 }] },
    2: { color: 'black', steps: [{ type: 'coinDamage', flips: 6, perHeads: 25, perTails: 10 }] },
    3: {
      color: 'gold',
      steps: [
        { type: 'mystDamage', values: { Low: 0, Medium: 100, High: 200 } },
        { type: 'damage', target: 'self', amount: 10, direct: true },
      ],
    },
  },

  skylle: {
    1: { color: 'black', steps: [{ type: 'buffAttack', amount: 50, mode: 'attacks', left: 1 }] },
    2: { color: 'gold', steps: [{ type: 'damage', target: 'enemy', amount: 75 }] },
    3: { color: 'gold', steps: [{ type: 'coinDamage', flips: 6, perHeads: 25, perTails: 0 }] },
  },

  'skylle-lv1-armor': {
    1: { color: 'black', steps: [{ type: 'buffAttack', amount: 60, mode: 'attacks', left: 1 }] },
    2: { color: 'gold', steps: [{ type: 'damage', target: 'enemy', amount: 85, ignoreDefense: true }] },
    3: { color: 'gold', steps: [{ type: 'coinDamage', flips: 6, perHeads: 35, perTails: 0 }] },
  },

  wilhelm: {
    1: {
      color: 'black',
      steps: [
        {
          type: 'delayed',
          turns: 1,
          label: 'Giant War Hammer Smash',
          steps: [
            { type: 'damage', target: 'enemy', amount: 200 },
            { type: 'damage', target: 'self', amount: 100, direct: true },
          ],
        },
      ],
    },
    2: {
      color: 'green',
      input: 'diceChoice',
      steps: [
        {
          type: 'dice',
          sides: 'input',
          branches: {
            even: [{ type: 'damage', target: 'enemy', amount: 100, aoe: true }],
            odd: [{ type: 'damage', target: 'enemy', amount: 150 }],
          },
        },
      ],
    },
    3: {
      color: 'green',
      steps: [
        { type: 'skip', target: 'enemy', turns: 2 },
        { type: 'buffAttack', amount: 100, mode: 'turns', left: 2 },
        {
          type: 'delayed',
          turns: 3,
          label: 'Dodge and Counter finale (+200 attacks this turn)',
          steps: [{ type: 'buffAttack', amount: 200, mode: 'turns', left: 1 }],
        },
      ],
    },
  },

  'independence-dragon': {
    1: {
      color: 'black',
      steps: [{ type: 'delayed', turns: 1, label: 'Dragon Fireworks', steps: [{ type: 'damage', target: 'enemy', amount: 300 }] }],
    },
    2: {
      color: 'green',
      steps: [
        { type: 'delayed', turns: 3, label: 'Red, White and Doom', steps: [{ type: 'damage', target: 'enemy', amount: 500, aoe: true }] },
      ],
    },
    3: {
      color: 'green',
      steps: [
        {
          type: 'delayed',
          turns: 4,
          label: 'Grand Finale',
          steps: [
            { type: 'heal', target: 'self', amount: 200 },
            { type: 'damage', target: 'enemy', amount: 700, aoe: true },
          ],
        },
      ],
    },
  },

  godiva: {
    1: {
      steps: [
        { type: 'skip', target: 'enemy', turns: 1 },
        { type: 'defense', target: 'enemy', delta: -50 },
      ],
    },
    2: { steps: [{ type: 'coinDamage', flips: 9, perHeads: 50, perTails: 25 }] },
    3: {
      color: 'black',
      steps: [
        { type: 'damage', target: 'enemy', amount: 150, aoe: true },
        { type: 'debuffEnemyAttack', amount: 25, turns: 1 },
        { type: 'delayed', turns: 1, label: 'Gold Aurum Discs (2nd wave)', steps: [{ type: 'damage', target: 'enemy', amount: 175, aoe: true }] },
      ],
    },
  },

  pandora: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 25 }] },
    2: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 50, aoe: true },
        {
          type: 'delayed',
          turns: 1,
          label: 'Haute Cutter (2nd wave)',
          steps: [
            { type: 'damage', target: 'enemy', amount: 75, aoe: true },
            { type: 'defense', target: 'self', delta: 5 },
          ],
        },
      ],
    },
    3: { steps: [{ type: 'coinDamage', flips: 5, perHeads: 50, perTails: 20 }] },
  },

  benz: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 100 }] },
    2: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 50, aoe: true },
        {
          type: 'delayed',
          turns: 1,
          label: 'Magma of Might (2nd wave)',
          steps: [
            { type: 'damage', target: 'enemy', amount: 150, aoe: true },
            { type: 'defense', target: 'self', delta: 10 },
          ],
        },
      ],
    },
    3: {
      steps: [
        {
          type: 'delayed',
          turns: 3,
          label: 'Molten Fury Release',
          steps: [
            { type: 'damage', target: 'enemy', amount: 200, aoe: true },
            { type: 'setLife', amount: 300 },
          ],
        },
        {
          type: 'delayed',
          turns: 4,
          label: 'Molten Fury Release (aftershock)',
          steps: [
            { type: 'damage', target: 'enemy', amount: 200, aoe: true },
            { type: 'defense', target: 'self', delta: -25 },
          ],
        },
      ],
    },
  },

  xinyu: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 100, aoe: true, ignoreDefense: true }] },
    2: {
      steps: [
        { type: 'defense', target: 'self', delta: 200, turns: 2 },
        { type: 'delayed', turns: 3, label: 'Assassin Ambush', steps: [{ type: 'damage', target: 'enemy', amount: 200, aoe: true }] },
      ],
    },
    3: { steps: [{ type: 'offerReset', refuseDamage: 400 }] },
  },

  seven: {
    1: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 100 },
        { type: 'skip', target: 'self', turns: 1 },
      ],
    },
    2: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 50, aoe: true },
        { type: 'delayed', turns: 1, label: 'Deadman Strike (echo)', steps: [{ type: 'damage', target: 'enemy', amount: 25 }] },
      ],
    },
    3: { steps: [{ type: 'buffAttack', amount: 25, mode: 'attacks', left: 3 }] },
  },

  may: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 25 }] },
    2: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 25 },
        { type: 'delayed', turns: 1, label: 'Death From Above', steps: [{ type: 'damage', target: 'enemy', amount: 100, aoe: true }] },
      ],
    },
    3: {
      steps: [
        { type: 'reveal' },
        { type: 'skip', target: 'enemy', turns: 1 },
      ],
    },
  },

  makh: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 100, aoe: true }] },
    2: {
      steps: [
        {
          type: 'dice',
          sides: 10,
          branches: {
            numbers: [1, 5, 8],
            hit: [{ type: 'damage', target: 'enemy', amount: 75 }],
            miss: [{ type: 'damage', target: 'enemy', amount: 50, aoe: true }],
          },
        },
      ],
    },
    3: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 50 },
        { type: 'delayed', turns: 1, label: 'Heavy Kinetic Natr (2nd hit)', steps: [{ type: 'damage', target: 'enemy', amount: 75 }] },
        { type: 'delayed', turns: 2, label: 'Heavy Kinetic Natr (3rd hit)', steps: [{ type: 'damage', target: 'enemy', amount: 120, ignoreDefense: true }] },
        { type: 'delayed', turns: 3, label: 'Heavy Kinetic Natr (4th hit)', steps: [{ type: 'damage', target: 'enemy', amount: 225, ignoreDefense: true }] },
      ],
    },
  },

  kio: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 50 }] },
    2: {
      steps: [
        { type: 'damage', target: 'enemy', amount: 10 },
        { type: 'delayed', turns: 1, label: 'Karate & Muay Thai (follow-up)', steps: [{ type: 'damage', target: 'enemy', amount: 75 }] },
      ],
    },
    3: {
      steps: [
        { type: 'skip', target: 'enemy', turns: 1 },
        { type: 'buffAttack', amount: 50, mode: 'attacks', left: 1 },
      ],
    },
  },

  yamabe: {
    1: { steps: [{ type: 'damage', target: 'enemy', amount: 40 }] },
    2: { steps: [{ type: 'defense', target: 'enemy', delta: -20 }] },
    3: { steps: [{ type: 'coinDamage', flips: 6, perHeads: 20, perTails: 10 }] },
  },
};

export function getMoveDef(cardId, slot) {
  return MOVE_DEFS[cardId]?.[slot] || null;
}
