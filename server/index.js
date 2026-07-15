import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLAYABLE_CARDS, ALL_CARDS } from './cardData.js';
import {
  createRoom,
  joinRoom,
  getRoom,
  selectCards,
  deployActive,
  performRoll,
  applyDamage,
  applyHeal,
  adjustDefense,
  setSkipNextTurn,
  addNote,
  selectNextActive,
  endTurn,
  markDisconnected,
  buildView,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.get('/api/cards', (req, res) => res.json({ playable: PLAYABLE_CARDS, all: ALL_CARDS }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

function broadcastRoom(room) {
  for (const player of room.players) {
    io.to(player.id).emit('state-update', buildView(room, player.id));
  }
}

io.on('connection', (socket) => {
  socket.on('create-room', ({ name }, ack) => {
    const room = createRoom(socket.id, (name || 'Player 1').slice(0, 20));
    socket.join(room.code);
    ack?.({ ok: true, code: room.code });
    broadcastRoom(room);
  });

  socket.on('join-room', ({ code, name }, ack) => {
    const result = joinRoom(String(code || ''), socket.id, (name || 'Player 2').slice(0, 20));
    if (result.error) return ack?.({ ok: false, error: result.error });
    socket.join(result.room.code);
    ack?.({ ok: true, code: result.room.code });
    broadcastRoom(result.room);
  });

  socket.on('select-cards', ({ cardIds }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = selectCards(room, socket.id, cardIds);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('deploy-active', ({ cardId }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = deployActive(room, socket.id, cardId);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('roll', ({ kind, count, sides }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = performRoll(room, socket.id, kind, count, sides);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true, results: result.results });
    broadcastRoom(room);
  });

  socket.on('apply-damage', ({ targetPlayerIndex, targetCardId, amount, ignoreDefense }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = applyDamage(room, socket.id, targetPlayerIndex, targetCardId, amount, !!ignoreDefense);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('apply-heal', ({ targetPlayerIndex, targetCardId, amount }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = applyHeal(room, socket.id, targetPlayerIndex, targetCardId, amount);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('adjust-defense', ({ targetPlayerIndex, targetCardId, delta }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = adjustDefense(room, socket.id, targetPlayerIndex, targetCardId, delta);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('set-skip-next-turn', ({ targetPlayerIndex }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = setSkipNextTurn(room, socket.id, targetPlayerIndex);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('log-note', ({ text }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = addNote(room, socket.id, text);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('select-next-active', ({ cardId }, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = selectNextActive(room, socket.id, cardId);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('end-turn', (_payload, ack) => {
    const room = getRoom(currentRoomCode(socket));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const result = endTurn(room, socket.id);
    if (result.error) return ack?.({ ok: false, error: result.error });
    ack?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const room = markDisconnected(socket.id);
    if (room) broadcastRoom(room);
  });
});

// Socket.IO rooms track raw socket membership; recover our room code from it.
function currentRoomCode(socket) {
  for (const room of socket.rooms) {
    if (room !== socket.id) return room;
  }
  return null;
}

httpServer.listen(PORT, () => {
  console.log(`ABCDEF server listening on :${PORT}`);
});
