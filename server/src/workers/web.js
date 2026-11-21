// Optional "web" worker (WEB_MODE=worker): the static app in its own process. By default the gateway
// serves the app itself, which needs no extra process at all.
import http from 'node:http';
import { listen } from './_boot.js';
import { serveWeb } from '../static-handler.js';

listen(http.createServer(serveWeb));
