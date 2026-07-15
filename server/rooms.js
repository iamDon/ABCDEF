import crypto from 'node:crypto';
import { getCard, isPlayable } from './cardData.js';

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
    hand: [], // chosen card ids, order fixed
    cardState: {}, // cardId -> { life, maxLife, defense, maxDefense, zone }
    activeCardId: null,
    skipNextTurn: false,
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
  if (room.log.length > 200) room.log.shift();
}

function otherIndex(i) {
  return i === 0 ? 1 : 0;
}

export function selectCards(room, socketId, cardIds) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
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
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'deploy' && room.phase !== 'battle') return { error: 'Not able to deploy right now.' };
  const player = room.players[pIndex];
  const state = player.cardState[cardId];
  if (!state || state.zone !== 'hand') return { error: 'Card is not available in your hand.' };

  state.zone = 'battlefield';
  player.activeCardId = cardId;
  addLog(room, `${player.name} sent out ${getCard(cardId).name}.`);

  if (room.phase === 'deploy' && room.players.length === 2 && room.players.every((p) => p.activeCardId)) {
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
  const firstIndex = crypto.randomInt(0, 2);
  room.turnPlayerIndex = firstIndex;
  addLog(room, `Myst level rolled: ${level} (d10 = ${roll}).`);
  addLog(room, `${room.players[firstIndex].name} won the coin flip and goes first.`);
}

export function performRoll(room, socketId, kind, count, sides) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };

  let results;
  if (kind === 'coin') {
    const n = Math.min(Math.max(Number(count) || 1, 1), 20);
    results = Array.from({ length: n }, () => (crypto.randomInt(0, 2) === 0 ? 'Heads' : 'Tails'));
  } else if (kind === 'dice') {
    const n = Math.min(Math.max(Number(count) || 1, 1), 10);
    const s = sides === 10 ? 10 : 6;
    results = Array.from({ length: n }, () => crypto.randomInt(1, s + 1));
  } else {
    return { error: 'Unknown roll kind.' };
  }
  const player = room.players[pIndex];
  addLog(room, `${player.name} rolled ${kind === 'coin' ? results.length + ' coin(s)' : results.length + ' d' + sides}: ${results.join(', ')}`);
  return { room, results };
}

export function applyDamage(room, socketId, targetPlayerIndex, targetCardId, amount, ignoreDefense) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };
  if (![0, 1].includes(targetPlayerIndex)) return { error: 'Invalid target.' };

  const target = room.players[targetPlayerIndex];
  const state = target.cardState[targetCardId];
  if (!state || state.zone !== 'battlefield') return { error: 'Target is not on the battlefield.' };

  const dmg = Math.max(0, Number(amount) || 0);
  const final = ignoreDefense ? dmg : Math.max(0, dmg - state.defense);
  state.life = Math.max(0, state.life - final);
  addLog(
    room,
    `${getCard(targetCardId).name} takes ${final} damage${ignoreDefense ? ' (ignores Defense)' : ` (${dmg} - ${state.defense} Defense)`}.`
  );

  if (state.life === 0) {
    state.zone = 'graveyard';
    target.activeCardId = null;
    addLog(room, `${getCard(targetCardId).name} is defeated.`);

    const hasSurvivors = Object.values(target.cardState).some((s) => s.zone !== 'graveyard');
    if (!hasSurvivors) {
      room.phase = 'game-over';
      room.winnerIndex = otherIndex(targetPlayerIndex);
      addLog(room, `${room.players[room.winnerIndex].name} wins!`);
    }
  }
  return { room };
}

export function applyHeal(room, socketId, targetPlayerIndex, targetCardId, amount) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };
  if (![0, 1].includes(targetPlayerIndex)) return { error: 'Invalid target.' };

  const target = room.players[targetPlayerIndex];
  const state = target.cardState[targetCardId];
  if (!state || state.zone !== 'battlefield') return { error: 'Target is not on the battlefield.' };

  const heal = Math.max(0, Number(amount) || 0);
  state.life = Math.min(state.maxLife, state.life + heal);
  addLog(room, `${getCard(targetCardId).name} heals ${heal} Life.`);
  return { room };
}

export function adjustDefense(room, socketId, targetPlayerIndex, targetCardId, delta) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };
  if (![0, 1].includes(targetPlayerIndex)) return { error: 'Invalid target.' };

  const target = room.players[targetPlayerIndex];
  const state = target.cardState[targetCardId];
  if (!state || state.zone !== 'battlefield') return { error: 'Target is not on the battlefield.' };

  const d = Number(delta) || 0;
  state.defense = Math.max(0, state.defense + d);
  addLog(room, `${getCard(targetCardId).name}'s Defense ${d >= 0 ? '+' : ''}${d} (now ${state.defense}).`);
  return { room };
}

export function setSkipNextTurn(room, socketId, targetPlayerIndex) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };
  if (![0, 1].includes(targetPlayerIndex)) return { error: 'Invalid target.' };

  room.players[targetPlayerIndex].skipNextTurn = true;
  addLog(room, `${room.players[targetPlayerIndex].name} will lose their next turn.`);
  return { room };
}

export function addNote(room, socketId, text) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  const clean = String(text || '').slice(0, 200).trim();
  if (!clean) return { error: 'Empty note.' };
  addLog(room, `${room.players[pIndex].name}: ${clean}`);
  return { room };
}

export function selectNextActive(room, socketId, cardId) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  const player = room.players[pIndex];
  if (player.activeCardId) return { error: 'You already have an active card.' };
  const state = player.cardState[cardId];
  if (!state || state.zone !== 'hand') return { error: 'Card is not available in your hand.' };

  state.zone = 'battlefield';
  player.activeCardId = cardId;
  addLog(room, `${player.name} sends out ${getCard(cardId).name}.`);
  return { room };
}

export function endTurn(room, socketId) {
  const pIndex = room.players.findIndex((p) => p.id === socketId);
  if (pIndex === -1) return { error: 'Not in this room.' };
  if (room.phase !== 'battle') return { error: 'Not in battle.' };
  if (pIndex !== room.turnPlayerIndex) return { error: 'Not your turn.' };

  addLog(room, `${room.players[pIndex].name} ended their turn.`);
  let next = otherIndex(pIndex);
  if (room.players[next].skipNextTurn) {
    room.players[next].skipNextTurn = false;
    addLog(room, `${room.players[next].name} loses this turn.`);
    next = pIndex;
  }
  room.turnPlayerIndex = next;
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

export function buildView(room, forSocketId) {
  const youIndex = room.players.findIndex((p) => p.id === forSocketId);
  const opponentIndex = youIndex === -1 ? -1 : otherIndex(youIndex);

  function publicCardState(player) {
    return Object.entries(player.cardState)
      .filter(([, s]) => s.zone !== 'hand')
      .map(([cardId, s]) => ({ cardId, ...s }));
  }

  function ownCardState(player) {
    return Object.entries(player.cardState).map(([cardId, s]) => ({ cardId, ...s }));
  }

  const view = {
    code: room.code,
    phase: room.phase,
    mystLevel: room.mystLevel,
    turnPlayerIndex: room.turnPlayerIndex,
    winnerIndex: room.winnerIndex,
    log: room.log.slice(-40),
    you: null,
    opponent: null,
  };

  if (youIndex !== -1) {
    const you = room.players[youIndex];
    view.you = {
      index: youIndex,
      name: you.name,
      ready: you.ready,
      activeCardId: you.activeCardId,
      skipNextTurn: you.skipNextTurn,
      cards: ownCardState(you),
    };
  }
  if (opponentIndex !== -1 && room.players[opponentIndex]) {
    const opp = room.players[opponentIndex];
    view.opponent = {
      index: opponentIndex,
      name: opp.name,
      connected: opp.connected,
      ready: opp.ready,
      activeCardId: opp.activeCardId,
      skipNextTurn: opp.skipNextTurn,
      handCount: opp.hand.length ? Object.values(opp.cardState).filter((s) => s.zone === 'hand').length : 0,
      cards: publicCardState(opp),
    };
  }
  return view;
}
