# Functional description

What the React web app does, how it is built, and what is and is not finished. Written for someone who did
not write the code and wants to understand it, or come back to it later.

- Folder: `web_and_server/web` (React 19 + Vite + TypeScript + Tailwind 4)
- Talks to: `web_and_server/server` (Express + SQLite) over `/api`. **The server was not changed.**
- Looks like and behaves like: `ImmichWeb/web` (SvelteKit). Code was written fresh (see §12).
- Companion files: `../PLAN.md` (the plan), `server-todo.md` (generated list of endpoints the server still needs).

---

## 1. Run it

```
cd web_and_server/server && npm install && npm start      # API on :3000 (also serves web/build)
cd web_and_server/web    && npm install && npm run dev    # dev site on :5173, /api proxied to :3000
cd web_and_server/web    && npm run build                 # writes web/build, which the server serves
cd web_and_server/web    && npm test                      # 22 unit/component tests
cd web_and_server/web    && npm run server-todo           # regenerates docs/server-todo.md
```

First visit to a fresh server: the app sends you to **/auth/register** to create the admin account, then through
a short **onboarding**, then to **/photos**.

---

## 2. The big picture

```
 browser
   |  React Router (every page = React.lazy chunk)
   v
 pages/            one file per screen, thin: they compose components and call hooks
   |
 components/       ui kit, layout shell, timeline, viewer, upload, modals, map
   |
 hooks/ + state/   React Query queries, small contexts (auth, theme, toast, i18n, upload), realtime socket
   |
 api/              ONE place that knows the server: endpoints.ts + client.ts + typed functions
   |
   v  fetch / XHR / socket.io  ->  /api/...  (Express server)
```

### Folder map (`web/src`)

| Folder | What lives there |
|---|---|
| `api/` | `endpoints.ts` (every endpoint, flagged ok/stub/todo), `client.ts` (fetch wrapper), `types.ts`, and one file per area: `core.ts`, `assets.ts`, `library.ts`, `admin.ts`, `uploads.ts` |
| `state/` | `AuthProvider`, `ThemeProvider`, `ToastProvider`, `I18nProvider`, `UploadProvider`, `realtime.ts` (socket) |
| `hooks/` | `useServer` (config/features/storage), `usePreferences`, `useRun`, `useAssetActions`, `useAssetRoute`, `useTimeline`, `useShortcuts`, `useZoomPan`, `useElementWidth` |
| `components/ui/` | Button, Modal, Menu, Fields (inputs/switch/checkbox), Table, Tree, Combobox, Misc (Avatar, Card, Accordion, Tabs, StarRating...), Boundary, Spinner, CalendarHeatmap, Qrcode, Confetti |
| `components/layout/` | `AppShell` (navbar + sidebar), `Navbar`, `Sidebar`, `SearchBar`, `NotificationPanel`, `AuthLayout`, `Guards` (route protection) |
| `components/timeline/` | `Timeline`, `MonthSection`, `AssetGrid`, `Thumbnail`, `Scrubber`, `SelectionBar`, `AssetListView`, selection state |
| `components/viewer/` | `AssetViewer`, `PhotoView`, `VideoView`, `PanoramaView`, `DetailPanel`, `ActivityPanel`, `PhotoEditor`, `FaceEditor`, `Overlays` |
| `components/modals/`, `components/map/`, `components/upload/`, `components/search/`, `components/sharing/`, `components/albums/` | feature dialogs and widgets |
| `pages/` | one folder per area: `auth`, `photos`, `albums`, `people`, `search`, `explore`, `map`, `memories`, `sharing`, `tags`, `utilities`, `workflows`, `settings`, `admin`, `share` |
| `lib/` | pure helpers (no React): `justifiedLayout`, `dates`, `format`, `chunks`, `sha1`, `search`, `tree`, `download`, `slideshow`, `cast`, `webauthn`, `permissions`, `thumbhash` |
| `i18n/` | `t()` helper and `locales/` |

---

## 3. Key ideas (read these first)

### 3.1 One table of endpoints (`api/endpoints.ts`)
Every server call is listed once, marked:

| Marker | Meaning |
|---|---|
| `ok` | the server implements it |
| `stub` | the server answers, but with an empty/static result (albums list, people, search...) |
| `todo` | the server does not have it yet |

Current count: **49 ok, 28 stub, 121 todo.** `npm run server-todo` turns this into `docs/server-todo.md`, which is your
checklist for future server work. When you implement an endpoint, change `todo(...)` to `ok(...)`; nothing else in the web changes.

### 3.2 "Built, but the server cannot do it yet"
Every feature of the reference has its screen. If the server lacks the endpoint, the call fails with
`NotSupportedError` (HTTP 404/405/501 on a `todo` endpoint). The app then:
- shows a toast: *"This feature is not supported by the server yet."* for actions (favorite, delete, create album...)
- shows the normal empty/"not available" state for pages (albums list, people, duplicates...)

React Query does not retry `NotSupportedError`. No button is hidden or broken because of it.

### 3.3 `useRun` — doing something and telling the user
```ts
const run = useRun();
const r = await run(() => deleteAlbum(id), { success: 'Album deleted', invalidate: [['albums']] });
if (r.ok) navigate('/albums');
```
One helper gives every action the same behaviour: success toast, error toast (including "not supported"), and refreshing of cached lists.

### 3.4 Server data = React Query
Lists and details are `useQuery` calls with short keys (`['albums']`, `['asset', id]`, `['timeline', ...]`). Pages never call `fetch` directly.
Socket event `on_upload_success` refreshes `['timeline']` so a new upload appears at once.

### 3.5 Preferences
`GET /users/me/preferences` works, but the server ignores `PUT` (it always answers with defaults). So each change is saved
**in this browser** (`localStorage`, per user) and laid over the server's answer, and is also sent to the server. The moment the server
starts saving preferences, both agree. (`hooks/usePreferences.ts`)

### 3.6 Translations
The English text is the key: `t('Photos')`. Other languages are small files in `i18n/locales` mapping English to the translation;
a missing entry falls back to English. Shipped: **es, fr, de, partial (navigation and common words).** Change language in Account settings.
Adding a language = add `locales/xx.ts` and one line in `LANGUAGES` (`i18n/index.ts`).

### 3.7 Lazy loading and low memory
Every route is `React.lazy` (59 routes). Inside pages, heavy parts are lazy too (50 `lazy()` calls): the viewer and its panels, photo editor,
face editor, panorama viewer, slideshow dialog, map, QR code, upload panel, each modal, each settings section, each admin
system-settings section. `<Boundary>` wraps them: spinner while loading, "Try again" button if a chunk fails. The first download after login is about **77 kB gzip** (the logged-in shell, `socket.io` and the map are separate chunks); maplibre (~300 kB gzip) and the 360° viewer (~160 kB gzip) download only when a map or panorama is shown.

**Memory-saving rules (important for a small server and for phones):**
- The **timeline only holds the months near the screen** (about 1 screen above and below, about 5-12 months). Months you scroll away from drop their data, DOM and images and become an empty box of the same height; scrolling back reloads them (cached 45 s).
- A month is loaded only after it stays near the screen for 150 ms, so dragging the scrubber or flinging does not request every month in between (measured: a jump across 49 months made 3 requests). In-flight requests for months that left the window are cancelled.
- Thumbnails use `loading="lazy"` and `decoding="async"`; the viewer preloads only the **next** picture, 0.6 s after the current one shows.
- Uploads run **2 at a time** (large files stream from disk in chunks, nothing is read into memory).
- Unused cached data is dropped after 2 minutes. The login and public pages do not download the app shell.
- Tunables: `NEAR_MARGIN` and `SETTLE_MS` in `components/timeline/MonthSection.tsx`, `MAX_PARALLEL` in `state/UploadProvider.tsx`, `gcTime` in `main.tsx` and `hooks/useTimeline.ts`.

---

## 4. Screens and features

"Works now" = the server supports it today. "Waits" = the screen is complete but the server endpoint is missing (§3.2).

### 4.1 Sign in and first run
| Route | What it does | Server |
|---|---|---|
| `/auth/register` | Create the first admin (only while the server has no admin) | works now |
| `/auth/login` | Email + password. Shows an OAuth button when OAuth is enabled, returns to the page you came from (`?continue=`, local paths only) | password: works now; OAuth: waits |
| `/auth/change-password` | Forced when an admin created the account with "must change password" | works now |
| `/auth/onboarding` | 4 steps for the admin: welcome, theme, language, done. Marks the admin as onboarded | works now |
| `/auth/pin-prompt` | PIN entry (or PIN creation) for the locked folder | waits |
| `/auth/logout` | Ends the session | works now |

Route protection (`components/layout/Guards.tsx`): not logged in → login; must change password → that page; admin not onboarded → onboarding;
`/admin/*` needs admin; `/locked` needs an unlocked session.

### 4.2 The shell
- **Navbar:** logo, search box (with history and an advanced-filter popup), upload button, admin shortcut, theme toggle, notification bell, help menu
  (keyboard shortcuts, download the app QR, about this server, help & feedback), account menu (settings, administration, sign out). On phones the
  secondary icons hide.
- **Sidebar:** Photos, Explore, People, Places, Favorites, Albums (with the 5 newest albums under it), Sharing, Utilities, Archive, Locked folder, Trash, plus
  Map, Memories, Recently added, Folders, Tags when the server feature or your preference says so. Storage meter and server version at the bottom.
  Under 850 px it becomes a slide-in drawer.
- **Everywhere:** drag files anywhere to upload, paste images to upload, `?` shows shortcuts, `/` focuses search, light/dark/system theme, toasts, error boundary.

### 4.3 Photos and the other picture lists
Routes: `/photos`, `/favorites`, `/archive`, `/trash`, `/recently-added`, `/locked`, and with filters: album, person, tag, partner pages.
All use the same **Timeline** (see §5.1).

| Page | Filter sent to server | Special |
|---|---|---|
| Photos | visibility=timeline, newest first | memory lane strip on top; empty state offers Upload |
| Favorites | isFavorite=true | |
| Archive | visibility=archive | |
| Recently added | newest first, `sortBy=createdAt` | |
| Trash | isTrashed=true | "Empty trash", "Restore all", note about retention days; selection offers Restore / Delete permanently |
| Locked folder | visibility=locked | PIN first |

Works now: viewing all of these lists. Actions on pictures (favorite, archive, delete...) wait for the server (§4.5).

### 4.4 Viewer (`/photos/<id>` and `<page>/photos/<id>`)
The viewer is part of the address, so Back closes it and links can be shared.

- Photo: preview first, full size when zoomed; wheel/pinch zoom, drag to pan, double-click toggles zoom.
- Video: native player (seeking works). Live photo: play button over the picture.
- 360° photo: interactive panorama (lazy).
- Next/previous: arrow keys or buttons; neighbours are preloaded; at the end of the loaded months the next month loads.
- Top bar: close, cast (if enabled in settings), "show text in picture" (OCR boxes), slideshow, activity (album), favorite, add to album, share, download, delete/restore, info, more menu.
- **Info panel** (`i`): people (with face boxes on the picture), description (editable), star rating (if enabled), date (editable), file details, camera, location with mini map (editable), tags (editable), albums it appears in.
- **Slideshow** (`s`): dialog for seconds per picture, order (oldest/newest/shuffle), repeat, show details; fullscreen; pause/next/stop bar.
- **Photo editor:** crop (free, original, 1:1, 4:3, 3:2, 16:9), rotate, mirror; saved as an edit list.
- **Face editor:** drag a box on the picture, choose or create the person.
- **Activity panel** (shared albums): comments and likes.
- Keyboard: ←/→ navigate, Esc close (or leave editor/slideshow), `i` info, `s` slideshow, `f` favorite, Delete trash, Shift+A archive.

Works now: view, next/previous, info panel, download of one file, OCR toggle (the server returns no boxes). Zoom, video playback and the slideshow are written against the real server endpoints but were not clicked through. Waits: favorite, archive, delete, edit, face tagging, activity, description/date/location/tag changes.

### 4.5 Selecting pictures and bulk actions
Click the circle (hover) on a picture, shift-click for a range, circle on a day header selects the day, `Ctrl+A` selects all loaded.
The bar replaces the top of the page: clear, count, select all, and the actions of that page:

favorite/unfavorite · archive/unarchive · move to / remove from locked folder · delete (trash) · delete permanently · restore · download · add to album · share link ·
change date · change description · change location (map or coordinates) · tag · stack/unstack · link live photo · remove from album · remove from shared link.
Pages can add their own (album: "use as album cover"; person: "use as person photo").
Shortcuts: Esc, Delete, `f`, Shift+A, `d`.

Works now: **download** (one file directly; several → zip if the server supports it, otherwise files one by one with a notice). Everything else waits.

### 4.6 Upload
Button, drag-and-drop, or paste. Only file types listed by `GET /server/media-types` are accepted. For each file:
1. SHA-1 in a Web Worker (works for huge files, block by block)
2. `POST /assets/bulk-upload-check` → duplicates are skipped and shown as "Already in library"
3. under 25 MiB: one multipart request with progress; larger: resumable chunks (`POST /assets/chunked`, `PUT .../chunks/n`, `POST .../complete`). A failed large upload keeps its session, so **Retry** sends only the missing chunks.
4. up to 3 files at once; per-file progress, retry, cancel, "Clear finished"; uploads can target an album (`albumId`); public shared links can allow uploads.

Works now: all of it (tested with small files, a 34 MiB file in 4 chunks, and a duplicate).

### 4.7 Albums
- `/albums`: card or table view (remembered), filter (all/mine/shared), sort (modified, created, name, count), group by year, "Create album".
- `/albums/:id`: editable title/description, member avatars, add photos (pick from library), upload into the album, share link, download all, album map, options (order, comments & likes, members and roles, add people from your cluster group), leave/delete, timeline of the album with the viewer and activity.
Server: waits (list answers empty).

### 4.8 People, search, explore, places, map, memories
| Route | What it does | Server |
|---|---|---|
| `/people` | grid of faces, search, "load more", "Show & hide people", "Share people" (cluster-group sharing) | waits (empty) |
| `/people/manage` | click faces to hide/unhide, save | waits |
| `/people/:id` | rename, birthday, favorite, hide, merge others in, delete, "use as person photo", all their pictures | waits |
| `/search` | results grid with "load more", albums row; filters live in the URL | waits (answers empty) |
| navbar filter popup | text mode (smart/file name/description/text in picture), people, country/state/city, camera make/model/lens, date range, photo/video, rating, tags, not-in-album, archived, favorites; remembers recent searches | waits |
| `/explore` | people, places and "things" strips | waits |
| `/places` | one tile per city | waits |
| `/map` | clustered map, popup thumbnail opens the viewer, settings (favorites, archived, shared, time range) remembered | waits (needs `GET /map/markers` and a map style) |
| `/memories`, `/memories/:id`, `/memory` | story view: progress bars, auto-advance (seconds from your preferences), previous/next, show all, delete, birthday confetti | waits (empty) |

Text search: if the server has no smart search, plain text matches the file name.

### 4.9 Sharing
| Route | What it does | Server |
|---|---|---|
| `/sharing` | partners (add/remove, show in my timeline), shared albums | waits |
| `/partners/:userId` | a partner's pictures (read only) | waits |
| `/sharing/sharedlinks`, `/shared-links` | list links with expiry and options, copy, QR code, edit, delete | waits |
| `/shared-links/:id/edit` | change description, password, custom name, expiry, metadata/download/upload switches | waits |
| `/s/<slug>`, `/share/<key>` | **public page, no login**: password prompt, error page, single picture opens straight in the viewer, album grid with download-all and (if allowed) upload | waits |
| `/link?target=view_album&id=...` | forwards mobile-app style links to the right page | works now |

Creating a link: Share in the selection bar or album page → options → link with copy button and QR code.

### 4.10 Organizing
- `/tags`: tree of tags (use `/` to nest), pictures of the chosen tag, create, colour, delete. Waits.
- `/folders`: folder tree and the pictures of the chosen folder. Waits.
- `/utilities`: menu of tools.
  - `/utilities/duplicates`: groups side by side, choose what to keep, "keep largest of each", "not duplicates". Waits.
  - `/utilities/large-files`: files above a chosen size, tick and delete. Waits.
  - `/utilities/geolocation`: pictures without a place; select and set location; "one by one" page with map. Waits.
- `/workflows`, `/workflows/:id`: list with enable switch, logs, duplicate, delete, create from template or blank; editor with trigger, ordered steps (move, remove), plugin-driven fields (text, number, switch, select, album or tag picker). Waits (list answers empty).

### 4.11 Account settings (`/user-settings`, accordion; each section is its own chunk)
Account (name, email, profile picture with crop) · Password · Devices (sessions, sign out one/all) · App settings (theme, language, default album order, sidebar)
· Features (memories + duration, people, folders, tags, shared links, ratings, Chromecast; each with sidebar toggle) · Download (archive size, embedded videos)
· Sharing (doorway to sharing pages) · OAuth (when enabled) · PIN code · Passkeys · API keys (permission picker, secret shown once) · Usage (counts, storage, quota, year heatmap) · Support (`/buy`).

Works now: password change, devices (sessions list/sign out), theme, language, usage (counts and disk), preferences (stored in browser, §3.5).
Waits: profile edit/picture, OAuth, PIN, passkeys, API keys.

### 4.12 Administration (`/admin/...`, own sidebar)
| Page | What it does | Server |
|---|---|---|
| Users | table, create, edit (email, name, password, admin, quota, must change password), remove (restorable), restore, delete now, show/hide removed | works now |
| User detail | account facts, usage, sessions, preferences, activity heatmap | works now / partly stubs |
| System settings | 9 lazy sections (video transcoding, images (thumbnail and preview size, format and quality; previews are WebP by default), authentication, trash, uploads, user, logging, metadata, version check). Unsaved fields are marked •. Save, reset to defaults, export/import JSON | works now (`/admin/config`); some previews wait |
| Server status | server info, disk, library totals, per-user usage table, version history | works now |
| Error log | filter by level/source/section/search, pages, stack traces, clear. **This web app reports its own crashes here** | works now |
| Maintenance | integrity summary and report pages, database backups (create/restore/delete), restart | summary works (zeros); rest waits |
| Libraries | list, create, edit (folders and exclusion patterns), scan, delete | waits |
| `/maintenance` (public) | restore-from-backup flow (check, choose backup, restore) | waits |

### 4.13 Other
- Notifications panel (bell): list, mark read, dismiss. Waits (list answers empty).
- Errors: 404 page, route error page, per-section error boundary with retry, shared-link error page.
- Web errors (uncaught errors, failed chunks) are sent to `POST /error-logs` (`source: web`).

---

## 5. How the important parts work

### 5.1 Timeline
1. `GET /timeline/buckets` returns one entry per month with a count. One placeholder block per month is drawn with an *estimated* height, so the scrollbar is right immediately.
2. When a month stays within about one screen of the viewport (`IntersectionObserver`, 150 ms), `GET /timeline/bucket?timeBucket=YYYY-MM-01` loads it; when it leaves, its data and pictures are released (see §3.7). The server sends one array per field; `zipBucket()` turns it into a list of pictures.
3. Pictures are grouped by day (using `fileCreatedAt` + `localOffsetHours`) under sticky headers.
4. `justifiedLayout()` fills each row to the full width at a target height (120/180/235 px by screen width); the last row is not stretched. Re-run when the width changes.
5. Each thumbnail shows a blurred **thumbhash** instantly, then the lazy `<img>`; badges: select circle, video duration, favorite, archived, locked, live photo, panorama, stack count.
6. The **scrubber** on the right: months sized by picture count, year labels, click/drag to jump, highlights where you are.
7. Changing filters remounts the timeline (fresh state). Pages that return a plain array (search, memory, shared links, folder, duplicates) use `AssetListView`, which has the same selection bar and viewer.

### 5.2 Viewer ↔ list
The list passes its ordered ids to the viewer; the viewer asks the list to load more months near the end, and tells the list which month a deep-linked picture belongs to.

### 5.3 Auth
Session = HttpOnly cookie set by the server, so JavaScript never sees a token. `GET /users/me` decides logged-in or not; any 401 anywhere clears the user and the guards send you to login.

### 5.4 System settings forms
`SchemaFields` draws a section from a plain list of fields (`{ path: 'ffmpeg.crf', type: 'number', label, help, when }`). Every section file is just such a list. Saving sends the whole config to `PUT /admin/config`.

---

## 6. Design
Same look as the reference: primary `rgb(66 80 175)` (dark: `rgb(172 203 250)`), white/near-black backgrounds, 4.5 rem navbar, 16 rem sidebar,
4 rem page headers, rounded inputs and modals, centred login card over a blurred logo, tight 2 px photo grid. Colours are CSS variables in
`styles/index.css`; dark mode is the `.dark` class and follows the system unless chosen.
**Placeholders:** the logo/favicon is a neutral five-petal flower (`public/favicon.svg`) and the font is Inter. See §10.

---

## 7. What was verified, and how

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm test` | 22 tests pass (layout, dates, chunks, bucket zip, search URL state, tree, URL building, endpoint table, Switch/TextField/Modal/ConfirmDialog/Menu) |
| `npm run build` | succeeds; main chunk 77 kB gzip; shell, socket.io, map each separate |
| Real browser against the real server code (scratch copy, fresh DB) | register → onboarding → photos; **24 uploads** (hash, dedupe, upload); timeline renders with scrubber; viewer with next/previous, info panel and URL changes; **34 MiB chunked upload** (4 chunks) and a duplicate skipped; favorite shows the "not supported yet" toast; **all 49 routes load without crashing**; **memory windowing** with 49 months of photos (never more than 11 months / 20 images loaded while scrolling top to bottom; fast jump = 3 requests); dark mode; admin system settings section opens; mobile width |

Not verified (no server support to test against): see §9.

---

## 8. Assumptions about endpoints the server does not have yet
The server cannot tell us their exact shape, so these follow the standard Immich API. Check them when you implement the server side
(`docs/server-todo.md` lists every one with its path):
- Asset changes: `PUT /assets` (bulk: `ids` + `isFavorite`/`visibility`/`dateTimeOriginal`/`latitude`/`longitude`/`description`/`rating`/`livePhotoVideoId`), `DELETE /assets` (`ids`, `force`), `PUT /assets/{id}` (single), edits `PUT /assets/{id}/edits` (`edits: [{action: crop|rotate|mirror, parameters}]`).
- `POST /download/archive` (`assetIds`, response is a zip blob), trash: `POST /trash/empty|restore|restore/assets`.
- Albums, activities, people/faces, memories, partners, shared links, tags, folders (`/view/folder...`), stacks, libraries, API keys, passkeys, notifications, workflows/plugins: Immich paths and bodies.
- Timeline filters the server currently ignores: `albumId`, `personId`, `tagId`, `userId`, `withPartners`, `withStacked`, `sortBy=createdAt`. (Today the server answers an empty list for album/person/tag.)
- This server's own **cluster-group** feature: `GET /cluster-groups/{id}/users` works; sharing people with those users uses a guessed `GET/PUT /people/{id}/users`.
- Public shared-link pages call `GET /shared-links/me?key=|slug=`, `POST /shared-links/login`, and add `?key=` to asset URLs and uploads.
- `GET /users/{id}/profile-image`, `GET /people/{id}/thumbnail` are used as `<img>` sources.

---

## 9. Known gaps (honest list)

**Behaviour not implemented**
- 360° **videos** (only 360° photos).
- Stack **viewing** (stack badge and stack/unstack action exist; opening the stack's members does not).
- Service worker / offline caching; "offline" banner; per-route scroll memory.
- Version-announcement and "server restarting" dialogs (the socket receives the version, nothing shows it yet).
- Scrubber "jump to date" dialog; arrow-key focus movement between thumbnails; download progress manager.
- Library exclusion-pattern/folder **dialogs** are replaced by an inline editable list.
- Memory settings are in Account settings → Features, not a separate dialog.

**Pages that read real server data load, but their create/save flows were not clicked through:** admin users (create, edit, remove, restore), system settings save, password change, sessions sign-out, error log filters/clear.

**Written but not exercised with real data** (the server cannot answer yet): albums and activity, people/faces/merge, search results and filters, map markers and clustering, memories, partners, shared links and public pages,
photo editor, face editor, slideshow dialog flow, tags/folders, duplicates/large files/geolocation, workflows, API keys, passkeys, OAuth, PIN, avatar crop, maintenance restore, library management, Chromecast
(needs a device that can open the picture URL), zip download. They compile, render their empty/not-supported states, and follow the standard API shapes, but expect small fixes when each one meets its real server endpoint.
The map also needs internet access to the tile style the admin configured.

**Quality items from the plan not done:** Lighthouse/accessibility audit, committed Playwright smoke test files, Prettier run over the code,
and "most files under about 150 lines" — a few are longer (`AssetViewer` ≈ 300, `AlbumPage`/`PhotoEditor` ≈ 205; `types.ts` and `endpoints.ts` are data tables).

---

## 10. Things you may want to swap
- **Logo and favicon:** `public/favicon.svg` (used by `components/ui/Misc.tsx` → `Logo`). Drop in your own.
- **Font:** `@fontsource-variable/inter`, set once in `styles/index.css` (`--font-sans`).
- **More languages:** §3.6.
- **Colours:** variables at the top of `styles/index.css`.

---

## 11. How to extend

| I want to... | Do this |
|---|---|
| Turn a feature on after adding a server endpoint | In `api/endpoints.ts` change `todo(...)` to `ok(...)`; run `npm run server-todo`. If the response shape differs, adjust the mapping in the matching `api/*.ts` function. |
| Add a new endpoint | Add it to `endpoints.ts`, write a one-line typed function in `api/*.ts`, use it from a page with `useQuery`/`useRun`. |
| Add a page | Create `pages/<area>/<Name>.tsx` (default export), add one line to `router.tsx` using `page(() => import(...))`. Add a sidebar entry in `components/layout/navItems.ts` if needed. |
| Add a picture page | `<TimelinePage title base query empty actions />` — about ten lines (see `pages/photos/Favorites.tsx`). |
| Add a bulk action | Add an id to `ActionId` and an entry in `hooks/useAssetActions.tsx`, then list it in `components/timeline/presets.ts`. |
| Add an admin settings field | Add a line to the field list of the matching file in `pages/admin/settings/sections/`. A new group = new file + one entry in `SystemSettings.tsx`. |
| Add a user setting | Add a switch in `pages/settings/sections/Features.tsx` (or a new section file + one line in `UserSettings.tsx`). |

---

## 12. About "no copied code"
The reference's component source was not opened or transcribed. The feature list came from the reference's route and file **names**, the server's code,
and the standard Immich API. Colours, sizes and route paths are matched because "same design" requires it. Algorithms (justified layout, month loading,
upload pipeline, zoom/pan, editors) were written from scratch in a different architecture (hooks + React Query + lazy routes). The reference is AGPL licensed
and carries the Immich name and logo; this project uses neutral placeholders for those (§10). This is not legal advice.
