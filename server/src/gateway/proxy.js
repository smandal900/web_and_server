// Streaming reverse proxy from the gateway to a worker on 127.0.0.1. Nothing is buffered: request and
// response bodies flow through in small pieces, so a 2 GB video costs the gateway a few KB of RAM.
import http from 'node:http';
import { pipeline } from 'node:stream';
import { gatewayLog } from './event-log.js';
import { groupFor } from './routes.js';

// These groups only contain routes behind login. A request with no token at all is answered here with 401, so
// anonymous traffic can never make the gateway start (and pay RAM for) a worker.
const NEEDS_LOGIN = new Set(['timeline', 'media', 'upload', 'admin', 'realtime']);
const hasCredentials = (req) =>
  /^Bearer\s+\S/i.test(req.headers.authorization ?? '') ||
  /\S/.test(req.headers['x-immich-user-token'] ?? '') ||
  /[?&](key|slug)=[^&\s]/.test(req.url ?? '') || // visitors of a shared link carry its key instead of a login
  /(?:^|;\s*)immich_access_token=[^;\s]/.test(req.headers.cookie ?? '');

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer'];

function sendError(res, status, message, req) {
  // 401 is a warning (a client without a login), 502 / 503 mean a worker is not answering
  if (req) gatewayLog({ level: status >= 500 ? 'error' : 'warn', section: 'gateway', message, method: req.method, path: req.url.replace(/([?&](?:key|slug|password|token)=)[^&]*/gi, '$1***').slice(0, 300), status });
  if (res.headersSent) return res.destroy();
  const body = JSON.stringify({ message, statusCode: status });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (status >= 502) headers['Retry-After'] = '2';
  res.writeHead(status, headers);
  res.end(body);
}

/** @param serveWeb (req, res) handler for the web app, used when the gateway serves it itself (no web worker) */
export function createProxy(pool, { serveWeb }) {
  function handleRequest(req, res) {
    const name = groupFor(req.method, req.url);
    const group = pool.get(name);
    if (!group) return serveWeb(req, res); // "web" without a worker
    if (NEEDS_LOGIN.has(name) && !hasCredentials(req)) return sendError(res, 401, 'Authentication required', req);

    // Count the request BEFORE waiting for the worker, so the idle timer cannot stop it under us.
    group.begin();
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        group.end();
      }
    };
    res.on('close', finish);

    group
      .ensure()
      .then((port) => {
        if (res.destroyed) return; // the browser gave up while the worker was starting

        const headers = { ...req.headers };
        for (const h of HOP_BY_HOP) delete headers[h];
        const ip = req.socket.remoteAddress;
        headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${ip}` : ip;
        // Without this header Node sends "Connection: close" (agent: false), and a worker that answers before it has read
        // the whole body (a refused upload chunk) closes its socket with data still unread: Windows then resets the
        // connection and the answer is lost (a 502 instead of the real 409). Kept open, the worker reads and drops the rest.
        headers.connection = 'keep-alive';

        let answered = false;
        // The client's request body: stop forwarding it and just read (discard) what is still coming, so the client can
        // finish sending and then read our answer. Destroying it instead would reset the client's connection.
        const dropBody = () => {
          req.unpipe(upstream);
          if (!req.complete) req.resume();
        };
        const upstream = http.request(
          { host: '127.0.0.1', port, method: req.method, path: req.url, headers, agent: false },
          (up) => {
            answered = true;
            dropBody(); // the worker answered, often before the body was read (a refused upload chunk): no more body needed
            const out = { ...up.headers };
            for (const h of HOP_BY_HOP) delete out[h];
            res.writeHead(up.statusCode, up.statusMessage, out);
            pipeline(up, res, () => {});
          },
        );
        upstream.on('error', () => {
          if (answered) return; // the worker closed its side after it had already answered
          dropBody();
          sendError(res, 502, `Service temporarily unavailable (${group.name} worker did not answer)`, req);
        });
        res.on('close', () => upstream.destroy()); // browser left: stop the worker's work too
        req.pipe(upstream); // not pipeline(): a failing upstream must not destroy the client's request (and its connection)
      })
      .catch((error) => {
        console.warn(`[gateway] ${group.name}: ${error.message}`);
        sendError(res, 503, `Service is starting, please retry (${error.message})`, req);
      });
  }

  /** WebSocket upgrade (socket.io). Only the realtime group accepts one. */
  function handleUpgrade(req, socket, head) {
    const name = groupFor(req.method, req.url);
    const group = pool.get(name);
    if (name !== 'realtime' || !hasCredentials(req)) return socket.destroy();

    group.begin(); // an open socket keeps the realtime worker alive
    socket.on('close', () => group.end());
    socket.on('error', () => socket.destroy());

    group
      .ensure()
      .then((port) => {
        if (socket.destroyed) return;
        const upstream = http.request({ host: '127.0.0.1', port, method: 'GET', path: req.url, headers: req.headers, agent: false });

        upstream.on('upgrade', (up, upSocket, upHead) => {
          const lines = ['HTTP/1.1 101 Switching Protocols'];
          for (let i = 0; i < up.rawHeaders.length; i += 2) lines.push(`${up.rawHeaders[i]}: ${up.rawHeaders[i + 1]}`);
          socket.write(`${lines.join('\r\n')}\r\n\r\n`);
          if (upHead?.length) socket.write(upHead);
          if (head?.length) upSocket.write(head);
          upSocket.on('error', () => socket.destroy());
          socket.on('close', () => upSocket.destroy());
          upSocket.on('close', () => socket.destroy());
          upSocket.pipe(socket);
          socket.pipe(upSocket);
        });
        upstream.on('response', (up) => {
          // the worker refused the upgrade (e.g. 400): pass the status on and close
          socket.end(`HTTP/1.1 ${up.statusCode} ${up.statusMessage}\r\nConnection: close\r\n\r\n`);
          up.resume();
        });
        upstream.on('error', () => socket.destroy());
        socket.on('close', () => upstream.destroy());
        upstream.end();
      })
      .catch(() => socket.destroy());
  }

  return { handleRequest, handleUpgrade };
}
