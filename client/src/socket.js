import { io } from 'socket.io-client';

export const socket = io({ autoConnect: true });

export function emitAsync(event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack) => {
      if (ack && ack.ok === false) {
        const err = new Error(ack.error || 'Request failed.');
        if (ack.needsInput) err.needsInput = ack.needsInput;
        reject(err);
      } else resolve(ack);
    });
  });
}
