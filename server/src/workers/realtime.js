// "realtime" group: socket.io. Stays alive while at least one browser tab is connected.
import http from 'node:http';
import { listen } from './_boot.js';
import { closeDb } from '../db.js';
import { attachSocket, emitLocal } from '../socket.js';

const server = http.createServer((_req, res) => {
  res.statusCode = 404;
  res.end();
});
const io = attachSocket(server);

// Events produced by other workers (e.g. upload finished) arrive here through the gateway.
process.on('message', (m) => {
  if (m?.type === 'emit') emitLocal(m.userId, m.event, ...(m.args ?? []));
});

listen(server, {
  onClose: async () => {
    await io.close();
    closeDb();
  },
});
