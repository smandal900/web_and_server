// emitToUser(userId, 'on_upload_success', asset) from ANY worker.
// The realtime worker (socket.io) may not even be running, so the event goes to the gateway over IPC;
// the gateway hands it on only if that worker is up (if nobody is connected there is nobody to tell).
let local; // set by single.js, where socket.io lives in the same process

export const setLocalEmitter = (fn) => {
  local = fn;
};

export const emitToUser = (userId, event, ...args) => {
  if (local) return local(userId, event, ...args);
  process.send?.({ type: 'emit', userId, event, args });
};
