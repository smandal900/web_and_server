// Shared start-up for every worker process. A worker is started by the gateway when its first request
// arrives, listens on a random localhost port, tells the gateway the port, and exits when told to.
export function listen(server, { onClose } = {}) {
  server.requestTimeout = 0; // big uploads / videos may take long; the gateway already guards headers
  server.keepAliveTimeout = 1000; // the gateway opens a connection per request; do not hold idle sockets

  server.listen(0, '127.0.0.1', () => process.send({ type: 'ready', port: server.address().port }));

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    setTimeout(() => process.exit(0), 4000).unref(); // never hang: the gateway will SIGKILL anyway
    try {
      await onClose?.();
    } catch {
      // exiting anyway
    }
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
  };

  process.on('message', (m) => {
    if (m?.type === 'shutdown') shutdown();
    else if (m?.type === 'stats') {
      process.send({ type: 'stats', rss: process.memoryUsage.rss(), heap: process.memoryUsage().heapUsed });
    }
  });
  process.on('disconnect', () => process.exit(0)); // the gateway died: do not stay behind as an orphan

  // A bug that nothing caught ends this process. Write it to the error log (with its stack) first; the gateway
  // starts a fresh worker on the next request. The log code is loaded only now, so a healthy worker never pays for it.
  const dies = (title) => async (error) => {
    try {
      const { logEvent } = await import('../log.js');
      logEvent({
        level: 'fatal',
        source: 'service',
        section: 'worker',
        message: `${title}: ${error?.message ?? error}`,
        stack: error?.stack,
      });
    } catch {
      // the log is unavailable; the console line below still shows it
    }
    console.error(`[worker] ${title}:`, error);
    process.exit(1);
  };
  process.on('uncaughtException', dies('Uncaught exception'));
  process.on('unhandledRejection', dies('Unhandled promise rejection'));

  // Give memory back to the OS between bursts of traffic (flag --expose-gc is set by the gateway).
  if (global.gc) setInterval(() => global.gc(), 20_000).unref();
}
