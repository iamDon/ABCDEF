import crypto from 'node:crypto';
import { getCard, isPlayable } from './cardData.js';
import { getMoveDef } from './moveEffects.js';

export const HAND_SIZE = 5;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const rooms = new Map();

function makeRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => ROOM_CODE_CHARS[crypto.randomInt(ROOM_CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function newPlayer(socketId, name) {
  return {
    id: socketId,
    name,
    connected: true,
    ready: false,
    hand: [],
    cardState: {}, // cardId -> { life, maxLife, defense, maxDefense, zone, mystApplied }
    activeCardId: null,
    skipTurns: 0,
    turnCount: 0,
    actedThisTurn: false,
    attackMods: [], // {amount, mode:'attacks'|'turns'|'permanent', left}
    defenseMods: [], // {amount, left} — temporary, ticks at end of owner's turn
    pending: [], // {turnsLeft, label, steps, sourceCardId}
    movesUsed: {}, // cardId -> {slot: count}
  };
}

export function createRoom(socketId, name) {
  const code = makeRoomCode();
  const room = {
    code,
    players: [newPlayer(socketId, name)],
    phase: 'waiting', // waiting -> card-select -> deploy -> battle -> game-over
    mystLevel: null,
    turnPlayerIndex: null,
    winnerIndex: null,
    pendingOffer: null, // {fromIndex, refuseDamage, moveName}
    log: [],
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(code, socketId, name) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'No game with that code.' };
  if (room.players.length >= 2) return { error: 'That game already has two players.' };
  room.players.push(newPlayer(socketId, name));
  room.phase = 'card-select';
  addLog(room, `${name} joined.`);
  return { room };
}

export function getRoom(code) {
  return rooms.get(code);
}

export function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.id === socketId)) return room;
  }
  return null;
}

function addLog(room, text) {
  room.log.push({ ts: Date.now(), text });
  if (room.log.length > 300) room.log.shift();
}

function otherIndex(i) {
  return i === 0 ? 1 : 0;
}

function playerIndexOf(room, socketId) {
  return room.players.findIndex((p) => p.id === socketId);
}

// ---------- setup phases ----------

export function selectCards(room, socketId, cardIds) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'card-select') return { error: 'Not in card selection phase.' };
  if (!Array.isArray(cardIds) || cardIds.length !== HAND_SIZE) {
    return { error: `Pick exactly ${HAND_SIZE} cards.` };
  }
  if (new Set(cardIds).size !== cardIds.length) return { error: 'Duplicate cards chosen.' };
  if (!cardIds.every(isPlayable)) return { error: 'One or more cards are not playable.' };

  const player = room.players[pIndex];
  player.hand = cardIds;
  player.cardState = {};
  for (const id of cardIds) {
    const card = getCard(id);
    player.cardState[id] = {
      life: card.life,
      maxLife: card.life,
      defense: card.defense,
      maxDefense: card.defense,
      zone: 'hand',
      mystApplied: false,
    };
  }
  player.ready = true;
  addLog(room, `${player.name} chose their hand.`);

  if (room.players.length === 2 && room.players.every((p) => p.ready)) {
    room.phase = 'deploy';
  }
  return { room };
}

export function deployActive(room, socketId, cardId) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'deploy') return { error: 'Not able to deploy right now.' };
  const player = room.players[pIndex];
  const state = player.cardState[cardId];
  if (!state || state.zone !== 'hand') return { error: 'Card is not available in your hand.' };

  state.zone = 'battlefield';
  player.activeCardId = cardId;
  addLog(room, `${player.name} sent out ${getCard(cardId).name}.`);

  if (room.players.length === 2 && room.players.every((p) => p.activeCardId)) {
    startBattle(room);
  }
  return { room };
}

function rollMystLevel() {
  const roll = crypto.randomInt(1, 11); // d10
  if (roll <= 4) return { level: 'Low', roll };
  if (roll <= 9) return { level: 'Medium', roll };
  return { level: 'High', roll };
}

function startBattle(room) {
  room.phase = 'battle';
  const { level, roll } = rollMystLevel();
  room.mystLevel = level;
  addLog(room, `Myst level rolled: ${level} (d10 = ${roll}).`);
  for (const player of room.players) {
    applyMystToCard(room, player, player.activeCardId);
  }
  const firstIndex = crypto.randomInt(0, 2);
  room.turnPlayerIndex = firstIndex;
  addLog(room, `${room.players[firstIndex].name} won the coin flip and goes first.`);
  beginTurn(room, firstIndex);
}

// Battlefield Myst adjustments, applied once per card as it enters the battlefield.
// Kenjto's ESU ability overrides the general species rules (card text wins).
function applyMystToCard(room, player, cardId) {
  if (!cardId) return;
  const state = player.cardState[cardId];
  if (!state || state.mystApplied) return;
  state.mystApplied = true;
  const card = getCard(cardId);
  const myst = room.mystLevel;

  if (cardId === 'kenjto') {
    if (myst === 'Medium') {
      state.life += 50;
      state.maxLife += 50;
      state.defense += 10;
      state.maxDefense += 10;
      addLog(room, `Kenjto's ESU ability: Medium Myst grants +50 Life and +10 Defense.`);
    } else if (myst === 'High') {
      state.life += 150;
      state.maxLife += 150;
      state.defense = Math.max(0, state.defense - 10);
      addLog(room, `Kenjto's ESU ability: High Myst grants +150 Life, -10 Defense, +25 to Shadow Kick.`);
    }
    return;
  }
  if (cardId === 'independence-dragon') return; // ability: Myst has no effect

  const isHuman = card.species === 'H';
  if (isHuman) return;
  if (myst === 'Low') {
    state.defense = Math.max(0, state.defense - 50);
    addLog(room, `${card.name} suffers Low Myst: -50 Defense.`);
  } else if (myst === 'High') {
    state.life += 100;
    state.maxLife += 100;
    addLog(room, `${card.name} thrives in High Myst: +100 Life.`);
  }
}

// ---------- battle engine ----------

function effectiveDefense(player) {
  const state = player.cardState[player.activeCardId];
  if (!state) return 0;
  const bonus = player.defenseMods.reduce((s, m) => s + m.amount, 0);
  return Math.max(0, state.defense + bonus);
}

function activeAttackBonus(player) {
  return player.attackMods.reduce((s, m) => s + m.amount, 0);
}

function consumeAttackCharges(player) {
  for (const m of player.attackMods) {
    if (m.mode === 'attacks') m.left -= 1;
  }
  player.attackMods = player.attackMods.filter((m) => m.mode !== 'attacks' || m.left > 0);
}

function clearCardEffects(room, player, cardId) {
  player.attackMods = [];
  player.defenseMods = [];
  const dropped = player.pending.filter((p) => p.sourceCardId === cardId);
  player.pending = player.pending.filter((p) => p.sourceCardId !== cardId);
  for (const d of dropped) addLog(room, `${d.label} fizzles — ${getCard(cardId).name} left the battlefield.`);
}

function handleDeath(room, ownerIndex) {
  const owner = room.players[ownerIndex];
  const cardId = owner.activeCardId;
  if (!cardId) return;
  const state = owner.cardState[cardId];
  if (state.life > 0) return;

  state.zone = 'graveyard';
  owner.activeCardId = null;
  addLog(room, `${getCard(cardId).name} is defeated.`);
  clearCardEffects(room, owner, cardId);

  const hasSurvivors = Object.values(owner.cardState).some((s) => s.zone !== 'graveyard');
  if (!hasSurvivors) {
    room.phase = 'game-over';
    room.winnerIndex = otherIndex(ownerIndex);
    addLog(room, `${room.players[room.winnerIndex].name} wins!`);
  }
}

// A modified attack: base + attacker's active bonuses + myst/gold + card specials, then Defense.
function dealAttackDamage(room, attackerIndex, baseAmount, { ignoreDefense = false, aoe = false, moveColor, moveSlot, events }) {
  const attacker = room.players[attackerIndex];
  const defender = room.players[otherIndex(attackerIndex)];
  const attackerCardId = attacker.activeCardId;

  if (!defender.activeCardId) {
    addLog(room, `...but there is no enemy card on the battlefield.`);
    return;
  }

  let total = baseAmount + activeAttackBonus(attacker);

  if (moveColor === 'gold' && attackerCardId && getCard(attackerCardId).species !== 'H') {
    if (room.mystLevel === 'Low') total -= 50;
    if (room.mystLevel === 'High') total += 150;
  }
  if (attackerCardId === 'kenjto' && moveSlot === 2 && room.mystLevel === 'High') total += 25;
  if (attackerCardId === 'makh' && moveSlot === 2 && getCard(defender.activeCardId).species.startsWith('Nu')) total += 20;

  total = Math.max(0, total);

  const defState = defender.cardState[defender.activeCardId];
  const def = ignoreDefense ? 0 : effectiveDefense(defender);
  const final = Math.max(0, total - def);
  defState.life = Math.max(0, defState.life - final);

  const defCardName = getCard(defender.activeCardId).name;
  addLog(
    room,
    `${defCardName} takes ${final} damage${aoe ? ' (hits all enemies)' : ''}${ignoreDefense ? ' — ignores Defense' : ` (${total} - ${def} Defense)`}.`
  );
  events?.push({ kind: 'damage', text: `${final} damage to ${defCardName}` });

  consumeAttackCharges(attacker);

  // Godiva's ability: enemies lose 15 Life whenever they make a damage attack on her.
  if (defender.activeCardId === 'godiva' && total > 0 && attackerCardId) {
    const atkState = attacker.cardState[attackerCardId];
    atkState.life = Math.max(0, atkState.life - 15);
    addLog(room, `Godiva's ability: ${getCard(attackerCardId).name} loses 15 Life (ignores Defense).`);
    handleDeath(room, attackerIndex);
  }

  handleDeath(room, otherIndex(attackerIndex));
}

function dealDirectLife(room, ownerIndex, amount, label, events) {
  const player = room.players[ownerIndex];
  if (!player.activeCardId) return;
  const state = player.cardState[player.activeCardId];
  state.life = Math.max(0, state.life - amount);
  addLog(room, `${getCard(player.activeCardId).name} loses ${amount} Life${label ? ` (${label})` : ''}.`);
  events?.push({ kind: 'damage', text: `${amount} Life cost` });
  handleDeath(room, ownerIndex);
}

function flipCoins(n) {
  return Array.from({ length: n }, () => (crypto.randomInt(0, 2) === 0 ? 'Heads' : 'Tails'));
}

function executeSteps(room, attackerIndex, steps, ctx) {
  const attacker = room.players[attackerIndex];
  const defender = room.players[otherIndex(attackerIndex)];

  for (const step of steps) {
    if (room.phase !== 'battle') return; // game ended mid-move
    switch (step.type) {
      case 'damage': {
        if (step.target === 'self') {
          dealDirectLife(room, attackerIndex, step.amount, 'move cost', ctx.events);
        } else {
          dealAttackDamage(room, attackerIndex, step.amount, {
            ignoreDefense: step.ignoreDefense,
            aoe: step.aoe,
            moveColor: ctx.moveColor,
            moveSlot: ctx.moveSlot,
            events: ctx.events,
          });
        }
        break;
      }
      case 'coinDamage': {
        const results = flipCoins(step.flips);
        const heads = results.filter((r) => r === 'Heads').length;
        const tails = results.length - heads;
        addLog(room, `${attacker.name} flips ${step.flips} coins: ${results.join(', ')} (${heads} Heads / ${tails} Tails).`);
        ctx.events.push({ kind: 'coins', results });
        const dmg = heads * step.perHeads + tails * step.perTails;
        dealAttackDamage(room, attackerIndex, dmg, { moveColor: ctx.moveColor, moveSlot: ctx.moveSlot, events: ctx.events });
        break;
      }
      case 'mystDamage': {
        const dmg = step.values[room.mystLevel] ?? 0;
        addLog(room, `${room.mystLevel} Myst: base damage ${dmg}.`);
        dealAttackDamage(room, attackerIndex, dmg, { moveColor: ctx.moveColor, moveSlot: ctx.moveSlot, events: ctx.events });
        break;
      }
      case 'dice': {
        const sides = step.sides === 'input' ? ctx.inputs?.sides : step.sides;
        const s = sides === 10 ? 10 : 6;
        const roll = crypto.randomInt(1, s + 1);
        addLog(room, `${attacker.name} rolls a d${s}: ${roll}.`);
        ctx.events.push({ kind: 'die', sides: s, roll });
        let branch;
        if (step.branches.numbers) {
          branch = step.branches.numbers.includes(roll) ? step.branches.hit : step.branches.miss;
        } else {
          branch = roll % 2 === 0 ? step.branches.even : step.branches.odd;
        }
        executeSteps(room, attackerIndex, branch, ctx);
        break;
      }
      case 'heal': {
        if (!attacker.activeCardId) break;
        const st = attacker.cardState[attacker.activeCardId];
        st.life = Math.min(st.maxLife, st.life + step.amount);
        addLog(room, `${getCard(attacker.activeCardId).name} heals ${step.amount} Life.`);
        ctx.events.push({ kind: 'heal', text: `Healed ${step.amount}` });
        break;
      }
      case 'setLife': {
        if (!attacker.activeCardId) break;
        const st = attacker.cardState[attacker.activeCardId];
        st.life = Math.min(st.maxLife, step.amount);
        addLog(room, `${getCard(attacker.activeCardId).name}'s Life resets to ${st.life}.`);
        break;
      }
      case 'defense': {
        const targetPlayer = step.target === 'self' ? attacker : defender;
        if (!targetPlayer.activeCardId) break;
        if (step.turns) {
          targetPlayer.defenseMods.push({ amount: step.delta, left: step.turns });
          addLog(room, `${getCard(targetPlayer.activeCardId).name}'s Defense ${step.delta > 0 ? '+' : ''}${step.delta} for ${step.turns} turns.`);
        } else {
          const st = targetPlayer.cardState[targetPlayer.activeCardId];
          st.defense = Math.max(0, st.defense + step.delta);
          addLog(room, `${getCard(targetPlayer.activeCardId).name}'s Defense ${step.delta > 0 ? '+' : ''}${step.delta} (now ${st.defense}).`);
        }
        break;
      }
      case 'skip': {
        const targetPlayer = step.target === 'self' ? attacker : defender;
        targetPlayer.skipTurns += step.turns;
        addLog(room, `${targetPlayer.name} loses ${step.turns === 1 ? 'their next turn' : `${step.turns} turns`}.`);
        break;
      }
      case 'buffAttack': {
        attacker.attackMods.push({ amount: step.amount, mode: step.mode, left: step.left ?? null });
        addLog(
          room,
          `${getCard(attacker.activeCardId)?.name || attacker.name}'s attacks +${step.amount}` +
            (step.mode === 'attacks' ? ` for the next ${step.left} attack${step.left > 1 ? 's' : ''}.` : step.mode === 'turns' ? ` for ${step.left} turns.` : ' for the rest of the battle.')
        );
        break;
      }
      case 'debuffEnemyAttack': {
        defender.attackMods.push({ amount: -step.amount, mode: 'turns', left: step.turns });
        addLog(room, `${defender.name}'s attacks -${step.amount} for their next ${step.turns} turn${step.turns > 1 ? 's' : ''}.`);
        break;
      }
      case 'delayed': {
        attacker.pending.push({
          turnsLeft: step.turns,
          label: step.label,
          steps: step.steps,
          sourceCardId: attacker.activeCardId,
        });
        addLog(room, `${step.label} is charging — resolves in ${step.turns} of ${attacker.name}'s turns.`);
        break;
      }
      case 'reveal': {
        const handIds = Object.entries(defender.cardState)
          .filter(([, s]) => s.zone === 'hand')
          .map(([cardId]) => cardId);
        ctx.events.push({ kind: 'reveal', cards: handIds });
        addLog(room, `${attacker.name} scouts ahead — ${defender.name}'s hand is revealed to them!`);
        break;
      }
      case 'offerReset': {
        room.pendingOffer = {
          fromIndex: attackerIndex,
          refuseDamage: step.refuseDamage,
          moveName: ctx.moveName,
        };
        addLog(room, `${attacker.name} offers peace: return all battlefield cards to hand, or refuse and take the blast!`);
        break;
      }
      default:
        break;
    }
  }
}

export function useMove(room, socketId, slot, inputs) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };
  if (room.pendingOffer) return { error: 'Waiting on the opponent to respond.' };

  const player = room.players[pIndex];
  if (player.actedThisTurn) return { error: 'You already used a move this turn.' };
  if (!player.activeCardId) return { error: 'You have no active card. Send one out first.' };

  const cardId = player.activeCardId;
  const card = getCard(cardId);
  const move = card.moves.find((m) => m.slot === slot);
  const def = getMoveDef(cardId, slot);
  if (!move || !def) return { error: 'That move is not available.' };

  if (move.usesLimit) {
    const used = player.movesUsed[cardId]?.[slot] || 0;
    if (used >= move.usesLimit) return { error: `${move.name} has no uses left.` };
  }
  if (def.input === 'diceChoice' && ![6, 10].includes(inputs?.sides)) {
    return { error: 'Choose a d6 or d10 for this move.', needsInput: 'diceChoice' };
  }

  player.movesUsed[cardId] = player.movesUsed[cardId] || {};
  player.movesUsed[cardId][slot] = (player.movesUsed[cardId][slot] || 0) + 1;
  player.actedThisTurn = true;

  addLog(room, `${player.name}'s ${card.displayName || card.name} uses ${move.name}!`);
  const events = [];
  executeSteps(room, pIndex, def.steps, {
    moveColor: def.color || move.color,
    moveSlot: slot,
    moveName: move.name,
    inputs,
    events,
  });

  // Xinyu's offer pauses the turn until the opponent responds; everything else auto-ends.
  if (room.phase === 'battle' && !room.pendingOffer) {
    advanceTurn(room, pIndex);
  }
  return { room, events };
}

export function respondOffer(room, socketId, accept) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (!room.pendingOffer) return { error: 'No offer to respond to.' };
  if (pIndex === room.pendingOffer.fromIndex) return { error: 'The offer is for your opponent.' };

  const offer = room.pendingOffer;
  room.pendingOffer = null;
  const offerer = room.players[offer.fromIndex];
  const responder = room.players[pIndex];

  if (accept) {
    addLog(room, `${responder.name} accepts — all battlefield cards return to hand!`);
    for (const player of room.players) {
      if (player.activeCardId) {
        const cardId = player.activeCardId;
        player.cardState[cardId].zone = 'hand';
        player.activeCardId = null;
        clearCardEffects(room, player, cardId);
        addLog(room, `${getCard(cardId).name} returns to ${player.name}'s hand.`);
      }
      player.pending = [];
    }
  } else {
    addLog(room, `${responder.name} refuses the offer!`);
    dealAttackDamage(room, offer.fromIndex, offer.refuseDamage, { aoe: true, moveSlot: 3, events: [] });
  }
  if (room.phase === 'battle') advanceTurn(room, offer.fromIndex);
  return { room };
}

function advanceTurn(room, fromIndex) {
  const current = room.players[fromIndex];
  // End-of-turn ticks for the player whose turn is ending.
  for (const m of current.attackMods) {
    if (m.mode === 'turns') m.left -= 1;
  }
  current.attackMods = current.attackMods.filter((m) => m.mode !== 'turns' || m.left > 0);
  for (const m of current.defenseMods) m.left -= 1;
  current.defenseMods = current.defenseMods.filter((m) => m.left > 0);

  let next = otherIndex(fromIndex);
  let guard = 0;
  while (room.players[next].skipTurns > 0 && guard < 10) {
    room.players[next].skipTurns -= 1;
    addLog(room, `${room.players[next].name} loses this turn.`);
    next = otherIndex(next);
    guard += 1;
  }
  room.turnPlayerIndex = next;
  beginTurn(room, next);
}

function beginTurn(room, pIndex) {
  const player = room.players[pIndex];
  player.turnCount += 1;
  player.actedThisTurn = false;
  addLog(room, `— ${player.name}'s turn —`);

  // Resolve delayed effects owned by this player.
  const due = [];
  for (const p of player.pending) {
    p.turnsLeft -= 1;
    if (p.turnsLeft <= 0) due.push(p);
  }
  player.pending = player.pending.filter((p) => p.turnsLeft > 0);
  for (const p of due) {
    if (room.phase !== 'battle') break;
    if (!player.activeCardId || player.activeCardId !== p.sourceCardId) continue; // safety; normally cleared on death
    addLog(room, `${p.label} resolves!`);
    const card = getCard(p.sourceCardId);
    const slot = card.moves.find((m) => p.label.startsWith(m.name))?.slot;
    executeSteps(room, pIndex, p.steps, { moveColor: undefined, moveSlot: slot, moveName: p.label, events: [] });
  }

  // Benz's ability: every 2nd of her turns, flip a coin; Heads = +20 to all moves, permanently.
  if (room.phase === 'battle' && player.activeCardId === 'benz' && player.turnCount % 2 === 0) {
    const flip = flipCoins(1)[0];
    addLog(room, `Benz's ability coin flip: ${flip}.`);
    if (flip === 'Heads') {
      player.attackMods.push({ amount: 20, mode: 'permanent', left: null });
      addLog(room, `Benz's attacks gain +20 for the rest of the battle.`);
    }
  }
}

export function endTurn(room, socketId) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };
  if (room.pendingOffer) return { error: 'Waiting on the opponent to respond.' };

  addLog(room, `${room.players[pIndex].name} passes.`);
  advanceTurn(room, pIndex);
  return { room };
}

// ---------- misc in-battle actions ----------

export function performRoll(room, socketId, kind, count, sides) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };

  let results;
  if (kind === 'coin') {
    const n = Math.min(Math.max(Number(count) || 1, 1), 20);
    results = flipCoins(n);
  } else if (kind === 'dice') {
    const n = Math.min(Math.max(Number(count) || 1, 1), 10);
    const s = sides === 10 ? 10 : 6;
    results = Array.from({ length: n }, () => crypto.randomInt(1, s + 1));
    addLog(room, `${room.players[pIndex].name} rolled a d${s}: ${results.join(', ')}`);
    return { room, results };
  } else {
    return { error: 'Unknown roll kind.' };
  }
  addLog(room, `${room.players[pIndex].name} flipped ${results.length} coin(s): ${results.join(', ')}`);
  return { room, results };
}

export function addNote(room, socketId, text) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  const clean = String(text || '').slice(0, 200).trim();
  if (!clean) return { error: 'Empty note.' };
  addLog(room, `${room.players[pIndex].name}: ${clean}`);
  return { room };
}

export function selectNextActive(room, socketId, cardId) {
  const pIndex = playerIndexOf(room, socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  const player = room.players[pIndex];
  if (player.activeCardId) return { error: 'You already have an active card.' };
  const state = player.cardState[cardId];
  if (!state || state.zone !== 'hand') return { error: 'Card is not available in your hand.' };

  state.zone = 'battlefield';
  player.activeCardId = cardId;
  addLog(room, `${player.name} sends out ${getCard(cardId).name}.`);
  applyMystToCard(room, player, cardId);
  return { room };
}

export function markDisconnected(socketId) {
  const room = findRoomBySocket(socketId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === socketId);
  if (player) {
    player.connected = false;
    addLog(room, `${player.name} disconnected.`);
  }
  return room;
}

// ---------- per-player view ----------

function describeStatuses(player) {
  const chips = [];
  for (const m of player.attackMods) {
    if (m.mode === 'attacks') chips.push(`${m.amount > 0 ? '+' : ''}${m.amount} next ${m.left > 1 ? m.left + ' attacks' : 'attack'}`);
    else if (m.mode === 'turns') chips.push(`${m.amount > 0 ? '+' : ''}${m.amount} attacks (${m.left} turn${m.left > 1 ? 's' : ''})`);
    else chips.push(`${m.amount > 0 ? '+' : ''}${m.amount} attacks (battle)`);
  }
  for (const m of player.defenseMods) {
    chips.push(`${m.amount > 0 ? '+' : ''}${m.amount} Defense (${m.left} turn${m.left > 1 ? 's' : ''})`);
  }
  if (player.skipTurns > 0) chips.push(`loses next ${player.skipTurns > 1 ? player.skipTurns + ' turns' : 'turn'}`);
  return chips;
}

function describePending(player) {
  return player.pending.map((p) => ({ label: p.label, turnsLeft: p.turnsLeft }));
}

export function buildView(room, forSocketId) {
  const youIndex = room.players.findIndex((p) => p.id === forSocketId);
  const opponentIndex = youIndex === -1 ? -1 : otherIndex(youIndex);

  function publicCardState(player) {
    return Object.entries(player.cardState)
      .filter(([, s]) => s.zone !== 'hand')
      .map(([cardId, s]) => ({ cardId, life: s.life, maxLife: s.maxLife, defense: s.defense, maxDefense: s.maxDefense, zone: s.zone }));
  }

  function ownCardState(player) {
    return Object.entries(player.cardState).map(([cardId, s]) => ({
      cardId,
      life: s.life,
      maxLife: s.maxLife,
      defense: s.defense,
      maxDefense: s.maxDefense,
      zone: s.zone,
    }));
  }

  function movesRemaining(player) {
    if (!player.activeCardId) return null;
    const card = getCard(player.activeCardId);
    const out = {};
    for (const m of card.moves) {
      if (m.usesLimit) {
        out[m.slot] = m.usesLimit - (player.movesUsed[player.activeCardId]?.[m.slot] || 0);
      } else {
        out[m.slot] = null; // unlimited
      }
    }
    return out;
  }

  const view = {
    code: room.code,
    phase: room.phase,
    mystLevel: room.mystLevel,
    turnPlayerIndex: room.turnPlayerIndex,
    winnerIndex: room.winnerIndex,
    log: room.log.slice(-60),
    you: null,
    opponent: null,
    offer: null,
  };

  if (youIndex !== -1) {
    const you = room.players[youIndex];
    view.you = {
      index: youIndex,
      name: you.name,
      ready: you.ready,
      activeCardId: you.activeCardId,
      effectiveDefense: you.activeCardId ? effectiveDefense(you) : null,
      statuses: describeStatuses(you),
      pending: describePending(you),
      movesRemaining: movesRemaining(you),
      actedThisTurn: you.actedThisTurn,
      cards: ownCardState(you),
    };
    if (room.pendingOffer && room.pendingOffer.fromIndex !== youIndex) {
      view.offer = {
        moveName: room.pendingOffer.moveName,
        refuseDamage: room.pendingOffer.refuseDamage,
        fromName: room.players[room.pendingOffer.fromIndex].name,
      };
    }
  }
  if (opponentIndex !== -1 && room.players[opponentIndex]) {
    const opp = room.players[opponentIndex];
    view.opponent = {
      index: opponentIndex,
      name: opp.name,
      connected: opp.connected,
      ready: opp.ready,
      activeCardId: opp.activeCardId,
      effectiveDefense: opp.activeCardId ? effectiveDefense(opp) : null,
      statuses: describeStatuses(opp),
      pending: describePending(opp),
      handCount: opp.hand.length ? Object.values(opp.cardState).filter((s) => s.zone === 'hand').length : 0,
      cards: publicCardState(opp),
    };
  }
  return view;
}
