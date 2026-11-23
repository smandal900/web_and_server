# Low-RAM architecture

`npm start` runs a tiny **gateway** (`src/index.js`, Node built-ins only). It starts one **worker process per
feature group on the first request** and stops it after it has been idle, so RAM is only used by what people do now.

| Group      | Handles                                                          | Idle stop | Heap cap |
|------------|------------------------------------------------------------------|-----------|----------|
| `web`      | the React app (`web/build`); served by the gateway itself, no process (`WEB_MODE=worker` for one) | 120 s | 32 MB |
| `core`     | auth, users, sessions, config, server info, albums, activities, people, tags, stacks, partners, shared links, search, map, memories, trash, stubs | 120 s | 48 MB |
| `timeline` | `/api/timeline/*` (months, one month, and the "select all" list)   | 90 s      | 64 MB    |
| `media`    | `/api/assets/*` (thumbnails, originals, video, edits) and `/api/download/*` (zip) | 90 s | 64 MB |
| `upload`   | `POST /api/assets`, `/api/assets/chunked/*`, bulk-upload-check   | 60 s      | 96 MB    |
| `admin`    | `/api/admin/*`                                                   | 60 s      | 48 MB    |
| `realtime` | socket.io; alive while a tab is connected, 30 s after the last   | 30 s      | 48 MB    |

Routing table: `src/gateway/routes.js`. Worker pool / idle logic: `src/gateway/pool.js`.

## Memory measures

- Workers load only their own routers. `sharp`, `exifr`, `thumbhash` are imported lazily (`src/media.js`), so the
  `media` worker only pays for sharp if a thumbnail is missing.
- V8 heap cap per worker, 1 MB young generation, `UV_THREADPOOL_SIZE`, `MALLOC_ARENA_MAX=2`, periodic `gc()`.
- Image / ffmpeg jobs are gated (`MEDIA_JOBS`, default 1 at a time per process); sharp cache off, 1 thread.
- SQLite: 1 MiB page cache, no mmap, temp tables on disk. Schema migration runs once in the gateway (`migrate.js`).
- Uploads and files stream through the gateway and workers; nothing is buffered in RAM.
- Abandoned chunked uploads are cleaned by a short-lived job (`src/jobs/sweep.js`) every 6 h, not by a timer.
- Places (city / state / country of a photo): `src/geocode.js` looks the GPS position up in `geo/places.bin` (GeoNames, offline,
  nothing is sent out; see `geo/README.md`). The file is read into one Buffer on first use (about 8 MB, outside the V8 heap)
  and dropped after 30 s without a lookup. Uploads get their place in `ingestAsset`; older items get it from the short-lived
  `jobs/places.js` (run by the gateway 60 s after start and every 6 h, 500 items per batch, writes nothing once all are
  named). An item that was looked at has `exif.city` set (null when no place is within 100 km), which is what marks it as
  done; one that has the key but no value is looked up again and written only if a place is found. Web and app Places
  pages, search filters and suggestions read these fields.
- Thumbnails and previews: `<userId>/<name>_thumbnail.webp` and `<userId>/<name>_preview.webp` in `data/thumbs/`. The preview
  format is the admin setting `image.preview.format` (`webp` by default, `jpeg` possible → `_preview.jpg`); new previews
  use it. A preview in the other format (a library from before webp became the default) is served as it is and replaced
  when the photo is edited; `node scripts/convert-previews.js [--dry-run]` converts them all, one photo at a time.
  Deleting a photo removes its previews in every format.
- Videos: the GPS position of a video is the ISO 6709 `location` tag of the container (`+31.0871+077.1406/`, read with
  ffprobe in `readVideo`, `0,0` counts as no fix). Videos stored before this was read have no `exif.latitude` key; the
  places job reads their tag one ffprobe at a time (marks a video without GPS or with a missing file as `latitude: null`).
- Chunked uploads: the pieces wait in `tmp/<uploadId>/<n>.part` (`<n>.part.tmp` while one arrives; a set in memory refuses a
  second request for the same piece with 409). The **device** picks a `timestamp` (ISO 8601) when it starts the upload
  (`POST /assets/chunked`, required) and sends the same value in the `x-chunk-timestamp` header of every chunk. A chunk
  with a missing header is refused (400), one with another timestamp is ignored (409, nothing stored). The server never
  creates the timestamp, it only compares; the upload info returns it so a client that resumes keeps using it.
- The gateway forwards requests to workers with `Connection: keep-alive` and does not destroy the client's request when a
  worker answers early: a worker that answers before reading a big body (a refused chunk) would otherwise reset the connection
  (Windows) and the client would get a 502 instead of the real answer.
- Workers exit if the gateway dies (no orphans). A crashed worker restarts on the next request.

## Measured (Windows, private memory, real session incl. 24 MP uploads)

| Setup | Idle | Browsing | After uploads |
|---|---|---|---|
| web worker + all groups separate | 18.5 MB | 132 MB | 164 MB |
| default (gateway serves web) | 18.4 MB | 115 MB | 146 MB |
| `GROUP_MERGE=core+timeline+media` | 18.7 MB | 69 MB | 107 MB |

Every process costs ~20 MB before it does work, so merging groups that are used together saves the most.
The upload worker peaks at ~75 MB while decoding 24 MP photos, then disappears when idle.
Anonymous requests to login-only groups get 401 from the gateway without starting any worker.

## Measured in a real browser (Playwright, Chrome, private memory)

Session: sign up, onboarding, photo grid, photo viewer, admin page, upload of three 15 MB / 24 MP photos through the UI.

| State | Default (groups separate) | `GROUP_MERGE=core+timeline+media` |
|---|---|---|
| Nobody on the site | 17 MB | 19 MB |
| Grid just opened | 93 MB | 69 MB |
| Peak while uploading 3 x 24 MP photos | 176 MB | 106 MB |
| Tab left open, idle | ~66 MB (gateway + realtime + core) | ~65 MB |
| Tab closed, 30 s later | 22 MB | 22 MB |

The page polls `/api/notifications` every 60 s, so with a tab open the API worker stays up (core idle is 120 s).
Cold start from zero workers: first API answers after about 0.4 s, grid fully drawn about 1.4 s after navigation.

## Big libraries: how the newer API groups stay inside the heap caps

Albums, shared links, search, map, memories, trash and the bulk actions all live in the existing groups (mostly `core`),
so they add no process. They follow these rules; keep them when adding endpoints (helpers are in `src/util.js`):

- **A list that can grow with the library is never built as one array.** `streamJsonList` writes it in pages of 500
  (`PAGE_SIZE`) and waits for slow clients: album photos (`GET /albums/:id`), shared-link photos (`/shared-links/me`,
  `/shared-links/:id`) and map markers. Lists and the reply to creating a link carry only a 100-photo preview.
- **Ids from a client are used in chunks of 500** (`chunks`) and the body limit is `BODY_LIMIT` (1 MB, ~25,000 ids),
  so "select all" works and the SQL / memory use does not grow with the selection. Bulk writes run in one transaction.
- **Hard caps on everything else:** search `size` <= 1000, "on this day" = 15 years x 50 photos, folder view 5000,
  zip download streams 64 KB at a time. Downloads load only the columns they need.
- No new always-on code: the new routers load lazily with their group; `sharp` is still only loaded to render a thumbnail
  (core and timeline have the same idle memory).

Measured on a synthetic library (30,000 photos, one 10,000-photo album, shared links, tags, stacks), real heap per worker:

| Request | Result | Peak heap (cap) |
|---|---|---|
| `GET /albums/:id` with 10,000 photos (14 MB of JSON) | 0.8 s | 25 MB (core 48) |
| `GET /map/markers`, 30,000 markers | 2.3 s | 20 MB (core 48) |
| shared link with 10,000 photos | 0.8 s | 24 MB (core 48) |
| search / smart search / random, 1000 photos | 0.3 s | 20 MB (core 48) |
| favorite / trash / tag / add to album, 10,000 ids | 0.2 - 1 s | 24 MB (core 48) |
| download-info for 10,000 photos | 0.4 s | 22 MB (media 64) |
| web "Select all" on 30,000 photos (`GET /timeline/selection`, 1.3 MB) | 1.4 s | 14 MB (timeline 64) |
| 8 of the above at the same time (60 MB of JSON) | all 200 | no worker restarted |

The same run with the caps cut to `HEAP_MB_CORE=32`, `HEAP_MB_MEDIA=40`, `HEAP_MB_TIMELINE=40` also passes with no crash,
so there is about a third of headroom. (Before these rules, the album, the shared-link list and 30,000 markers each hit the
48 MB cap and restarted the worker.)

## Error log (what the admin sees under Administration > Error log)

Every failure on the server is written to the `error_logs` table by `src/log.js`; the web page and `GET /api/error-logs` read it.

| Source | Section | What is logged |
|---|---|---|
| `api` | the first part of the URL (`albums`, `auth`, `assets` ...) | every failed request: 4xx as `warn`, 5xx as `error` (with its stack), unknown URLs, bad JSON, bodies over the size limit, refused logins (with the client address), a download or stream that breaks midway |
| `service` / `gateway` | `gateway` | requests the gateway turns away before any worker sees them (no login: 401), and 502 / 503 when a worker does not answer |
| `service` / `worker` | `worker` | a worker that crashed, did not start, or did not become ready in time (exit code 134 is reported as "out of memory", with the setting that raises the limit); an uncaught exception or unhandled rejection inside a worker is `fatal`, with its stack |
| `service` | `upload`, `media`, `jobs` | metadata or thumbnails that could not be created for an upload, a failed clean-up of abandoned uploads |
| `web` | set by the page | errors the browser app reports |

Rules that keep it cheap (important on a small server):
- **No successful requests are logged**, only failures. Nothing is written while nothing goes wrong.
- The same failure repeating within 10 seconds is written once; the table keeps the newest 5,000 rows.
- Secrets in URLs (`key`, `password`, `token`, `slug`) are replaced by `***`; request bodies are never logged.
- The gateway has no database driver. It queues events and hands them to a short-lived helper process
  (`src/jobs/log-events.js`), so its memory does not change.
- A failure that is a normal answer (a user without a profile picture) is thrown as `new HttpError(404, msg, { log: false })`
  so it does not bury real problems. A new endpoint needs nothing else: throw `HttpError` and it is logged.

## Tuning (environment variables, see `.env.example`)

`IDLE_SEC_<GROUP>`, `HEAP_MB_<GROUP>`, `MEDIA_JOBS`, `SQLITE_CACHE_KB`, `STATUS_TOKEN`, `GROUP_MERGE`, `WEB_MODE`.
With `STATUS_TOKEN=abc` set, `GET /api/health?token=abc` lists every worker's state, pid, RSS and heap.

`npm run start:single` runs the old all-in-one process (`src/single.js`) for debugging.
