# Plan: React + Vite web client for the Express server

- Target folder: `web_and_server/web` (currently empty).
- Server: `web_and_server/server` (Express 5 + SQLite, Immich-compatible `/api`). **Never edited by this project.**
- Reference for **behavior and look only**: `ImmichWeb/web` (SvelteKit). No code is copied from it (see §12).

---

## 1. Goals and ground rules

1. **Every feature of the reference web app is built.** Nothing is skipped because the server cannot do it today (see §3).
2. **Same design**: layout, colors, fonts, spacing, dark mode, navbar + sidebar shell, login card, timeline look, modals.
3. **Fresh code**, written from behavior, not transcribed (§12).
4. **React + Vite + TypeScript**. Every page and every heavy component is loaded with `React.lazy`.
5. **Simple and understandable**: small files, plain hooks, one obvious place for each thing, comments that explain *why*.
6. **The server is not touched.** The web talks to it through one typed API layer (`src/api`). When you extend the server later, the web already calls the standard Immich endpoints, so features switch on without web changes.
7. A generated `docs/server-todo.md` lists every endpoint the web calls that the server does not implement yet, so you have a ready checklist for your server work.

---

## 2. What the server supports today (read from `server/src`)

| Area | Endpoints | State |
|---|---|---|
| Server info | `GET /server/ping, config, features, version, about, storage, statistics, version-history, media-types` | Real |
| Public config | `GET /public/config` | Real |
| Auth | `POST /auth/admin-sign-up, login, logout, change-password, validateToken`, `GET /auth/status` | Real (cookie `immich_access_token` or Bearer) |
| Users | `GET /users/me`, `GET/PUT /users/me/preferences`, `GET/PUT /users/me/onboarding`, `GET /users/me/calendar-heatmap` | Real / static |
| Sessions | `GET/DELETE /sessions`, `DELETE /sessions/:id` | Real |
| Config | `GET /config`, `GET /config/defaults` | Real |
| Admin | `/admin/config` (+`/defaults`, PUT), `/admin/users` CRUD + restore + `/:id/preferences|statistics|sessions|calendar-heatmap`, `/admin/integrity/summary`, `/admin/database-backups` | Real (integrity + backups are placeholders) |
| Error log | `POST /error-logs` (auth optional), admin `GET/DELETE /error-logs` | Real |
| Cluster groups | `GET /cluster-groups/:id/users`, `/requests` | Real / empty |
| Assets | `POST /assets`, `POST /assets/bulk-upload-check`, `GET /assets/statistics`, `GET /assets/:id`, `/:id/thumbnail`, `/:id/original`, `/:id/video/playback`, `/:id/ocr` | Real |
| Chunked upload | `POST /assets/chunked`, `GET/DELETE /:id`, `PUT /:id/chunks/:index`, `POST /:id/complete` | Real |
| Timeline | `GET /timeline/buckets`, `GET /timeline/bucket` (filters `isFavorite, isTrashed, visibility, order`) | Real |
| Realtime | socket.io at `/api/socket.io` (`on_server_version`, `on_upload_success`) | Real |
| Library stubs | `/memories, /notifications, /albums, /search/*, /faces, /people, /partners, /shared-links, /api-keys, /passkeys, /libraries, /workflows*, /plugins/*` | Return empty shapes |
| **Not implemented** | update/favorite/archive asset, trash/delete/restore, download-archive, album CRUD, people CRUD, search results, shared-link CRUD, PIN/locked folder, map markers, asset edits, stacks, tags, activity, OAuth, passkeys, API-key CRUD, workflows CRUD, library CRUD | Missing |

---

## 3. How features the server lacks are handled (replaces "hide it")

The reference's behavior is the spec. For each feature the web has the **complete UI**, wired to the **standard Immich endpoint** for it.

1. `api/client.ts` converts HTTP 404 / 405 / 501 on a feature endpoint into `NotSupportedError`.
2. Mutations show a friendly toast ("This server does not support *Favorite* yet") instead of a raw error.
3. Lists/pages show their normal empty state when the server returns an empty shape or `NotSupportedError`.
4. `api/endpoints.ts` is the single table of every endpoint the web uses, with a flag `serverHas: true|false`. A script (`npm run server-todo`) prints the `false` ones into `docs/server-todo.md`. When you add an endpoint to the server, flip the flag; nothing else changes.
5. Sidebar items follow the same rules as the reference: `/server/features` + user preferences decide what shows (memories, people, folders, tags, shared links, map, trash, locked folder...). Features the server reports as off stay off.
6. No server file is edited, ever. If a feature needs a response shape the server does not give, the web adapts in `api/` (mapper functions), not in the server.

---

## 4. Tech stack (kept small on purpose)

| Need | Choice | Why |
|---|---|---|
| Build | Vite + React 19 + TypeScript | requested |
| Routing | `react-router` data router with `lazy` route modules | code splitting per route |
| Server state | `@tanstack/react-query` | caching, invalidation, no hand-rolled stores |
| Local UI state | `useState` + small contexts (auth, theme, toast, preferences, selection, viewer) | no Redux to learn |
| Styling | Tailwind CSS 4 + CSS variables for theme | same tokens as reference, `.dark` class |
| Icons | `@mdi/js` + a 15-line `<Icon>` | same icon set |
| Realtime | `socket.io-client` (path `/api/socket.io`) | matches server |
| Placeholders | `thumbhash` | server stores thumbhash |
| Upload hashing | `@noble/hashes` SHA-1 in a Web Worker | server dedupes on SHA-1 hex |
| Map (lazy) | `maplibre-gl` + clustering, style URL from `/server/config` / `/map/style.json` | reference uses a vector map |
| 360 viewer (lazy) | `@photo-sphere-viewer/core` | panorama photos/videos |
| QR code (lazy) | `qrcode` | shared links, app download |
| Cast (lazy) | Google Cast sender script, loaded on demand | cast button in viewer |
| Cropping/edit | our own canvas editor | no big dependency |
| i18n | tiny `t()` + lazy-loaded locale files | language selector |
| Tests | Vitest + Testing Library; Playwright smoke tests | |

Not used: the reference's component library, wasm justified-layout (we write a ~40-line function), Svelte stores/managers.

Dev: Vite `:5173`, proxy `/api` (incl. websocket) to `http://localhost:3000`.
Prod: `vite build` with `outDir: 'build'`, so the server's default `WEB_BUILD_DIR` finds it (SPA fallback already exists).

---

## 5. Folder layout

```
web/
  index.html  vite.config.ts  package.json
  src/
    main.tsx            providers + <RouterProvider>
    router.tsx          the whole route table; every page is lazy
    api/                one file per server area, plain fetch + types
      client.ts         fetch wrapper: JSON, ApiError, NotSupportedError, 401 -> logout
      endpoints.ts      table of every endpoint + serverHas flag
      types.ts          DTOs (Asset, Album, Person, SharedLink, Memory, ...)
      auth users sessions server config assets timeline uploads albums people
      search map memories partners sharedLinks tags folders stacks activity
      libraries workflows apiKeys passkeys notifications trash admin errors
    state/              AuthProvider, ThemeProvider, ToastProvider, PreferencesProvider, socket.ts
    hooks/              useServerConfig, useFeatures, useTimeline, useSelection, useUpload, useShortcuts, ...
    components/
      ui/               Button IconButton Card Modal Menu ContextMenu Switch Checkbox Select Combobox
                        TextField DateInput Tabs Table Accordion Tooltip Toast Spinner Skeleton
                        EmptyState ConfirmDialog Avatar TagPill StarRating Breadcrumbs Qrcode
      layout/           AppShell Navbar Sidebar PageHeader AuthLayout AdminLayout BottomInfo
      timeline/         Timeline MonthSection DaySection JustifiedRow Thumbnail Scrubber SelectionBar
      viewer/           AssetViewer PhotoView VideoView PanoramaView DetailPanel Slideshow ... (§8)
      upload/           UploadPanel DropOverlay
      modals/           one small file per modal (album, tag, share, person, library, ...)
      map/              MapView (lazy maplibre)
    pages/              auth/ photos/ albums/ people/ search/ explore/ places/ map/ memories/
                        folders/ tags/ locked/ partners/ sharing/ shared-links/ utilities/ workflows/
                        settings/ admin/ share/ (public) maintenance/ ...
    lib/                justifiedLayout, formatBytes, formatDate, thumbhash, sha1Worker, zipBucket, ...
    i18n/               en.ts, index.ts (t(), lazy locales)
    styles/             index.css (tokens, fonts, tailwind)
  public/               favicons, manifest, logo, sw.js
docs/server-todo.md     generated: endpoints the web needs and the server lacks
```

Readability rules:
- One component per file, aim for **under ~150 lines**; split when it does two jobs.
- Feature code lives next to its page; only shared things go in `components/ui`, `hooks`, `lib`.
- Pages never call `fetch`; they use a hook, which calls a function in `api/`.
- Function components, named exports, default export only for lazy pages.
- Comments explain *why* (server quirks), not *what*.

---

## 6. Lazy loading strategy

1. **Route level**: every route uses `lazy: () => import(...)`. Chunk groups: `auth`, `app`, `admin`, `settings`, `public-share`.
2. **Component level** (`React.lazy` + `Suspense`): `AssetViewer`, `DetailPanel`, `Slideshow`, `PhotoEditor`, `FaceEditor`, `PanoramaView`, `MapView`, `UploadPanel`, `Scrubber`, every modal body, each admin settings section, search filter panels, QR code, cast.
3. **Third-party on demand**: maplibre, photo-sphere-viewer, qrcode, Cast SDK are imported only when their component first renders.
4. **Prefetch**: sidebar links and the first thumbnails call `import()` on hover/idle.
5. **Eager shell stays tiny**: Navbar, Sidebar, theme/auth providers.
6. `manualChunks` splits `react`, `router`, `query`, `socket.io`. Target initial JS well under 200 kB gzip (checked at every phase).
7. Each layout has `errorElement` + `Suspense` fallback with a retry button, so a failed chunk is never a white screen.

---

## 7. Design system (same look, our implementation)

- Primary: light `rgb(66 80 175)`, dark `rgb(172 203 250)`. Background light white / dark `rgb(10 10 10)`; foreground black / `rgb(229 231 235)`; dark panels `rgb(33 33 33)`.
- Logo accent colors: red `#fa2921`, pink `#ed79b5`, yellow `#ffb400`, blue `#1e83f7`, green `#18c249`.
- Font via one CSS variable (default free font close to Google Sans; see §13), `letter-spacing: 0.1px`.
- Navbar `4.5rem + 4px` (smaller on mobile); sidebar `16rem`, collapses under 850px; page header `4rem` with bottom border.
- Inputs: rounded-lg, gray-100 fill, 1px ring, primary ring on focus. Modals: centered, rounded-3xl, backdrop blur.
- Dark mode: `.dark` on `<html>`, follows system, toggle in navbar, saved in localStorage.
- Auth pages: centered card (max-w-xl) over a large blurred logo backdrop.
- Thumbnails: 2–4 px gaps, thumbhash blur, select circle top-left, duration badge top-right, favorite bottom-left, hover overlay.
- Skeleton loaders, empty placeholders with icon + text + action, same as the reference.

Parity check: run the reference against this same server and take side-by-side screenshots (login, timeline light/dark, viewer, settings, admin, mobile width) at the end of every phase.

---

## 8. Complete feature inventory (nothing may be skipped)

"Server today" tells you whether it works end-to-end now, or is built but waits for the server (§3).

### 8.1 Shell
| Feature | Server today |
|---|---|
| Navbar: logo, search bar (+advanced filters popup, history), upload button, theme toggle, notifications panel, account menu (avatar, settings, admin link, logout), help/feedback modal, keyboard shortcuts modal | notifications empty |
| Sidebar: Photos, Explore, Map, People, Places, Favorites, Albums (+recent albums), Sharing, Memories, Folders, Tags, Utilities, Archive, Locked folder, Trash, Storage meter, server status, version badge; collapsible; mobile drawer | storage real |
| Version announcement modal, server-restarting modal, about modal, app-download modal (QR), Obtainium config modal | real |
| Maintenance-mode page (`/maintenance`) with restore flow (detect install → select backup → restore) | placeholder |
| Skip link, focus traps, keyboard shortcuts system, drag-and-drop upload overlay, scroll memory per route | – |
| Language selector, light/dark/system theme, service worker (thumbnail/asset cache) | – |

### 8.2 Timeline (used by Photos, Favorites, Archive, Trash, Recently added, Folders, Locked, Albums, People, Tags, Places, Partners, Search, Map photo list, Memories, Shared-link views)
Month buckets with correct scrollbar, lazy month loading, day groups with sticky headers, justified rows, thumbhash, **scrubber** (year/month, drag, jump to date modal), multi-select with shift-range, select-all, keyboard navigation, `Esc` clears, live refresh on upload, stack badge, live-photo badge, panorama badge, video duration, archive/favorite/trash indicators.
Selection actions: favorite, archive, set visibility (timeline/archive/locked), delete (trash / permanent), restore, download (single → file, many → zip stream), add to album, create album, share (create shared link), change date, change description, change location (map picker), tag, stack / unstack, link live photo, remove from album / shared link, add to partner share. **Server today:** view-only plus download of single originals.

### 8.3 Asset viewer
Photo (preview → full size, wheel/pinch zoom, pan, double-click), video (native + range), live photo play, panorama / 360 photo & video, slideshow (settings modal: delay, order, loop, metadata overlay), OCR text boxes + toggle, prev/next with preloading, keyboard shortcuts, nav arrows, back-button close (URL driven), fullscreen, cast to device, download, favorite, archive, delete/restore, set visibility, add to album (picker modal), add to shared link, share, stack viewer, face overlays + **face editor** (create/assign/delete face), **photo editor** (crop, rotate, mirror, aspect presets, save via asset-edit API), **detail panel** (date + timezone edit, description edit, star rating, location with mini map, people, tags, camera/EXIF, file info, albums containing asset), album **activity** panel (comments, likes). **Server today:** view, info, download.

### 8.4 Upload
Button + drag-drop + paste, extension check against `/server/media-types`, SHA-1 in worker, dedupe check, small multipart, chunked + resumable + gzip chunks, concurrency limit, per-file and total progress, retry/cancel/clear, "already in library", add-to-album-after-upload, upload into album, panel bottom-right. **Server today:** full.

### 8.5 Albums
List with cards/table toggle, sort, group-by, filter (owned/shared), create, album page (timeline + header), edit (name, description, cover), option modal (order, activity toggle, comments toggle), add/remove assets, add users + roles (viewer/editor), shared links for album, album map, slideshow, download album, delete, album picker modal (add to album from anywhere), recent albums in sidebar. **Server today:** empty list.

### 8.6 People & faces
People grid with infinite loading, search by name, show/hide manager (`/people/manage`), person page (timeline + side panels), rename, birthday, favorite, merge (suggestions + manual), set feature photo, assign / reassign faces, create face, hide, delete, **access sharing between users** (person-user service, cluster-group users, bulk share, edit access modal, filter modal by user). **Server today:** empty; `/cluster-groups/:id/users` real.

### 8.7 Search & Explore
Search page with filters: text (smart / metadata / description / OCR), people, location (country/state/city), camera (make/model/lens), date range, media type, ratings, tags, display options (not-in-album, archived, favorites), saved history; results as timeline-like grid with infinite load. Explore: people, places (cities), things tiles. Places page. **Server today:** empty shapes.

### 8.8 Map
Full-page map with clustering, thumbnails in popups, date/people/favorite/archived/relative-time filters (map settings modal), map modal picker (used by change-location and the geolocation utility), album map. **Server today:** none.

### 8.9 Memories
Memory viewer (`/memory`, `/memories/:id`): story-style card with progress bar, auto-advance, next/previous, birthday confetti, delete memory, per-year groups, memory settings modal (enable, duration), memory lane strip on Photos page. **Server today:** empty.

### 8.10 Sharing
- Partners list, add/remove partner, partner timeline (`/partners/:userId`), "show on timeline" toggle.
- Shared links manager (`/sharing/sharedlinks`, `/shared-links`, edit page): create modal (expiry, password, allow download, show metadata, allow upload), copy link, QR code, edit, delete.
- **Public pages** (no login): `/s/:slug` and `/share/:key` — individual shared-asset viewer, album viewer, password prompt, expired/error page, download all, upload (if allowed).
- Link-open route `/link`. **Server today:** empty.

### 8.11 Organization
Tags page (tree sidebar + timeline, create/edit/delete/color, tag assets, tag modal), Folders page (tree + timeline), Archive, Favorites, Trash (empty trash, restore all), Recently added, **Locked folder** (PIN prompt `/auth/pin-prompt`, set/change/reset PIN, move assets in/out), Stacks. **Server today:** archive/favorites/trash views real.

### 8.12 Utilities
Menu page, **Duplicates** (review, keep/trash selected, resolve all), **Large files** (list by size, delete), **Geolocation** (list assets without GPS, map picker, bulk update, per-photo page). **Server today:** none.

### 8.13 Workflows
List, create from template picker, editor (trigger picker, steps add/edit/reorder, plugin method picker, schema-driven config fields incl. album and tag pickers), duplicate, enable/disable, run logs modal. **Server today:** empty.

### 8.14 User settings (`/user-settings`, accordion sections)
Account/profile (name, email, avatar upload + crop modal), password change, devices (sessions, log out one/all), app settings (theme, language, locale, sidebar options, default album view…), features (memories, people, folders, tags, shared links, ratings, cast, slideshow), download settings (archive size, include embedded video), sharing (partners, person access), OAuth link/unlink, PIN code, passkeys (WebAuthn register/rename/delete), API keys (create with permission picker, secret modal, update, delete), storage usage + calendar heatmap, supporter/purchase (`/buy`) page. **Server today:** account, password, sessions, usage real; preferences GET real, PUT is a no-op.

### 8.15 Admin (`/admin/...`)
- **Users**: list, create, detail (stats, preferences, sessions, heatmap), edit (quota, admin, password reset), delete (+ permanent), restore, password-reset-success modal. **Real.**
- **System settings** (one lazy section each): FFmpeg, images (thumbnail and preview size, format and quality; previews are WebP by default), auth (password/OAuth), trash, uploads, user, logging, metadata, version check; export/import config JSON, reset to defaults. **Real** (`/admin/config`).
- **Server status**: storage, per-user usage cards, version history, license. **Real.**
- **Error log**: filter, search, paginate, clear. **Real.**
- **Maintenance**: integrity summary, integrity report per type, database backups list/create/restore/delete, restore flow. **Placeholder.**
- **Library management**: list, create, detail, edit, folders and exclusion-pattern modals, scan/rescan. **Empty.**
- **User management** redirect route.

### 8.16 Auth
Login (password; OAuth button when enabled), first-admin register, change password (forced), onboarding steps, logout, PIN prompt, session expiry redirect with return URL, shared-link password prompt. **Real** except OAuth/PIN.

### 8.17 Error and edge pages
404, generic error page, chunk-load retry, `SharedLinkErrorPage`, offline banner, web errors reported to `POST /error-logs` (`source: web`).

---

## 9. Route map

| Route | Page | Group |
|---|---|---|
| `/auth/login`, `/auth/register`, `/auth/change-password`, `/auth/onboarding`, `/auth/logout`, `/auth/pin-prompt` | auth pages | auth |
| `/photos[/:assetId]` | main timeline | app |
| `/favorites`, `/archive`, `/recently-added`, `/trash`, `/locked`, `/folders`, `/tags` (each `[/photos][/:assetId]`) | timeline variants | app |
| `/albums`, `/albums/:albumId[/photos][/:assetId]` | albums | app |
| `/people`, `/people/manage`, `/people/:personId[/photos][/:assetId]` | people | app |
| `/explore`, `/places`, `/search[/photos][/:assetId]` | explore / search | app |
| `/map[/photos][/:assetId]` | map | app |
| `/memories`, `/memories/:id[/photos][/:assetId]`, `/memory[/photos][/:assetId]` | memories | app |
| `/sharing`, `/sharing/sharedlinks`, `/shared-links`, `/shared-links/:id/edit`, `/partners/:userId[/photos][/:assetId]` | sharing | app |
| `/utilities`, `/utilities/duplicates`, `/utilities/large-files`, `/utilities/geolocation`, `/utilities/geolocation/photos/:photoId` | utilities | app |
| `/workflows`, `/workflows/:workflowId` | workflows | app |
| `/user-settings`, `/buy` | settings | settings |
| `/s/:slug[...]`, `/share/:key[...]`, `/link` | public share | public-share (no auth) |
| `/admin/users`, `/admin/users/new`, `/admin/users/:id`, `/admin/users/:id/edit`, `/admin/user-management` | users | admin |
| `/admin/system-settings`, `/admin/server-status`, `/admin/error-log` | admin | admin |
| `/admin/maintenance`, `/admin/maintenance/integrity-report/:type`, `/maintenance` | maintenance | admin / public |
| `/admin/library-management`, `/new`, `/:id`, `/:id/edit` | libraries | admin |
| `*` | not found / error | – |

---

## 10. Core designs

### 10.1 Timeline
1. `GET /timeline/buckets` → one placeholder block per month with estimated height so the scrollbar is right immediately.
2. `IntersectionObserver` (margin ≈ 1 viewport) loads `GET /timeline/bucket?timeBucket=…`; React Query caches per month.
3. `zipBucket()` turns the column-per-field arrays into `Asset[]`; group by day using `fileCreatedAt` + `localOffsetHours`.
4. `justifiedLayout(ratios, width, rowHeight)` → rows; recomputed with `ResizeObserver`.
5. `<Thumbnail>`: thumbhash blur → `<img loading="lazy" src="/api/assets/:id/thumbnail?size=thumbnail">`.
6. Scrubber, selection and shortcuts live in small hooks (`useSelection`, `useTimelineKeys`).
7. The same `<Timeline filters={...}/>` serves every page in §8.2 by passing different query params (`albumId`, `personId`, `tagId`, `isFavorite`, `visibility`, …). Params the server ignores simply return the unfiltered set, so the web additionally filters client-side only where harmless and otherwise shows the not-supported notice.
8. Socket `on_upload_success` invalidates the affected month.

### 10.2 Viewer
URL-driven overlay (`/photos/:assetId`), ordered id list from the timeline for prev/next, `PreloadManager` hook preloads neighbors, all panels lazy. Zoom/pan in one `useZoomPan` hook. Editor works on a canvas and sends an edit list to the asset-edit endpoint.

### 10.3 Upload
Worker hash → bulk check → small multipart or chunked/resumable → progress store → live refresh. Concurrency 2–3, retry, cancel.

### 10.4 Auth and guards
Boot: `GET /server/config` → not initialized → `/auth/register`; else `GET /users/me`; 401 → `/auth/login?continue=`. Forced password change, onboarding, admin guard, locked-folder PIN guard. Cookie auth (same origin).

### 10.5 Settings forms
Generic `SettingSwitch / SettingNumber / SettingSelect / SettingText / SettingAccordion` + a section schema per admin config key, so each section file is mostly a field list. Save = `PUT /admin/config`.

### 10.6 Preferences
`PreferencesProvider` loads `GET /users/me/preferences`, sends `PUT` on change and keeps the response (or the local value when the server echoes nothing). Controls sidebar items, memories, ratings, default views.

---

## 11. Phases and acceptance checks

Each phase ends runnable and checked against the real server. Features the server lacks are checked against a small mock (MSW in tests) so the UI is verified without touching the server.

| # | Phase | Deliverable | Done when |
|---|---|---|---|
| 0 | Scaffold | Vite+React+TS, Tailwind, router, query, proxy, build to `web/build`, lint/format, Vitest, `endpoints.ts`, `server-todo` script | `npm run dev` page; `npm run build` served by server |
| 1 | Design system + shell | tokens, fonts, theme, `components/ui`, Navbar, Sidebar, layouts, error/404, shortcuts, i18n skeleton | light/dark shell matches reference screenshots |
| 2 | API layer + auth | `api/*`, providers, guards, login, register, change password, logout, onboarding, PIN prompt | fresh DB → register → onboarding → login → logout |
| 3 | Timeline core | buckets, lazy months, justified rows, thumbhash, scrubber, selection, all timeline pages | thousands of assets scroll smoothly; only visible months fetched |
| 4 | Viewer | overlay, zoom, video, live photo, panorama, slideshow, OCR, detail panel, shortcuts, download | open/close/next/prev by URL + keyboard |
| 5 | Upload | worker, dedupe, small+chunked+resume, panel, drag-drop, live refresh | photo, large video, duplicate, interrupted upload |
| 6 | Asset actions | favorite, archive, visibility, trash/restore/delete, change date/description/location, tag, stack, download zip, editor, face editor | each action works against mock; shows "not supported" toast on real server |
| 7 | Albums + sharing | albums, activity, partners, shared links, public share pages, QR | album/share flows pass against mock |
| 8 | People, search, explore, map, memories | all of §8.6–8.9 | pages render real empty states + mock data |
| 9 | Organization + utilities | tags, folders, locked folder + PIN, duplicates, large files, geolocation | pass against mock |
| 10 | User settings | every accordion in §8.14, sessions, API keys, passkeys, PIN, avatar crop | sessions/password/usage work on real server |
| 11 | Admin | users, all system-settings sections, server status, error log, maintenance + restore flow, libraries | every real admin form round-trips with the server |
| 12 | Workflows, notifications, cast, polish | workflows, notification panel, cast, service worker, mobile pass, a11y, bundle review, tests, README, final `server-todo.md` | Lighthouse a11y ≥ 90, no console errors, tests green |

Testing: unit tests for `justifiedLayout`, `zipBucket`, date grouping, chunk planner, SHA-1 worker; component tests for forms/modals; Playwright smoke (login → upload → timeline → viewer → admin users).

---

## 12. Avoiding copied code (clean-room approach)

- Requirements come from **behavior**: the server code, endpoint shapes, a feature inventory (file/route names only), and screenshots/interaction of the running reference.
- I will **not open or transcribe the reference's component source** while writing ours. Algorithms (justified layout, lazy month loading, upload flow, editor) are designed from this plan.
- Only values (colors, sizes, route paths, standard Immich API paths) are matched, because "same design" and server compatibility require it.
- Different framework and architecture (hooks + React Query + router lazy modules instead of Svelte stores/managers) makes line-level similarity unlikely.
- Not legal advice: the reference is AGPL-licensed and carries the Immich name/logo. Independently written code is separate; **logo, favicons, fonts and translation files** are assets, not our code (see §13).

---

## 13. Open decisions (defaults in bold)

1. **Brand assets**: **neutral placeholder logo/favicons now**, drop in originals later. Alternative: copy the reference's `static/` icons and logo into `public/` for an identical look.
2. **Font**: **free look-alike behind one CSS variable**. Google Sans has its own license.
3. **Languages**: **English written fresh in `i18n/en.ts`, language selector + lazy locale loading built in**. Other languages work when you supply locale files (or approve reusing `ImmichWeb/i18n/*.json`).
4. **Features the server lacks** (§3): **fully built UI + friendly "not supported yet" handling**. No server edits; `docs/server-todo.md` tells you what to add.
5. **Map tiles**: **style URL taken from the server (`/server/config` / `/map/style.json`)**; if the server gives none, the map page shows a notice.
6. **Package manager**: **npm** (matches the server).

---

## 14. Commands (once scaffolded)

```
cd web_and_server/server && npm install && npm start       # API on :3000
cd web_and_server/web    && npm install && npm run dev     # web on :5173, proxies /api
cd web_and_server/web    && npm run build                  # -> web/build, served by the server
cd web_and_server/web    && npm run server-todo            # regenerates docs/server-todo.md
```
