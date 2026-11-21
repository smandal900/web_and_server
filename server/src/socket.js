import { Server } from 'socket.io';
import { authenticate } from './auth.js';
import { VERSION } from './version.js';

let io;

/** Attach the socket.io endpoint the web client connects to at /api/socket.io. */
export function attachSocket(httpServer) {
  io = new Server(httpServer, { path: '/api/socket.io', transports: ['websocket'], serveClient: false });

  io.use((socket, next) => {
    const session = authenticate(socket.request);
    if (!session) return next(new Error('Authentication required'));
    socket.data.userId = session.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(socket.data.userId);
    socket.emit('on_server_version', VERSION);
  });

  return io;
}

/** Push an event to every open tab of a user that is connected to THIS process. */
export const emitLocal = (userId, event, ...args) => io?.to(userId).emit(event, ...args);
