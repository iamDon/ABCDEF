import { io } from 'socket.io-client';

export const socket = io({ autoConnect: true });

export function emitAsync(event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack) => {
      if (ack && ack.ok === false) reject(new Error(ack.error || 'Request failed.'));
      else resolve(ack);
    });
  });
}
