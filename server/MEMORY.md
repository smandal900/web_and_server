# Low-RAM architecture

`npm start` runs a tiny **gateway** (`src/index.js`, Node built-ins only). It starts one **worker process per
feature group on the first request** and stops it after it has been idle, so RAM is only used by what people do now.

| Group      | Handles                                                          | Idle stop | Heap cap |
|------------|------------------------------------------------------------------|-----------|----------|
| `web`      | the React app (`web/build`); served by the gateway itself, no process (`WEB_MODE=worker` for one) | 120 s | 32 MB |
| `core`     | auth, users, sessions, config, server info, stubs, error-logs    | 120 s     | 48 MB    |
| `timeline` | `/api/timeline/*`                                                | 90 s      | 64 MB    |
| `media`    | `GET /api/assets/*` (thumbnails, originals, video)               | 90 s      | 64 MB    |
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

## Tuning (environment variables, see `.env.example`)

`IDLE_SEC_<GROUP>`, `HEAP_MB_<GROUP>`, `MEDIA_JOBS`, `SQLITE_CACHE_KB`, `STATUS_TOKEN`, `GROUP_MERGE`, `WEB_MODE`.
With `STATUS_TOKEN=abc` set, `GET /api/health?token=abc` lists every worker's state, pid, RSS and heap.

`npm run start:single` runs the old all-in-one process (`src/single.js`) for debugging.
