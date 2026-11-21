# Plan: make `mobile_android` match the official Immich app

Status: PLAN ONLY. No app code has been changed for this plan.
Written: 2026-11-01

## 1. Goal

The native Kotlin/Compose app in `mobile_android/` (package `app.immich.mobile.native`) should look and behave like the official Immich Android app installed on the phone (`app.alextran.immich`, v3.3.4): same design, icon, navigation and features.

## 2. What was tested (evidence, 2026-11-01)

| Check | Result |
|---|---|
| Device | moto g54 5G, Android 15, 1080x2400 @ 400dpi, wireless adb, connected |
| Official app | `app.alextran.immich` v3.3.4 (code 3030499), installed today, **not signed in**: only the server-URL screen could be seen |
| Native app | `app.immich.mobile.native` v1.0.0, signed in, Library screen renders (286 photos, 6 videos) |
| Server | `localhost:2283` answers; version 3.3.0 |
| Codebase | `./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug` -> BUILD SUCCESSFUL. The test/lint tasks were reported UP-TO-DATE, so this confirms the last run was green, not a fresh run. Only one test file exists (`ModelsTest.kt`), so test coverage is thin |
| Reference source | `mobile/` Flutter app is v3.3.0-rc.0, close to but not identical to the installed 3.3.4 |

**Blocker for UI comparison:** the official app must be signed in before its Photos, Search, Albums, Library, viewer and Settings screens can be compared. No credentials are known to me. See section 8.

## 3. Gaps found so far

Confirmed by screenshots or source:

1. **Colours.** Official light primary is `0xFF4150AF` and dark primary is `0xFFACCBFA`, built with `ColorScheme.fromSeed` (the sign-in button on the phone is that light blue). Native uses `0xFF4250AF` / `0xFFBAC3FF` hand-picked values, so dark mode differs. Official also has colour presets (indigo, deep purple, pink, red, orange, ...) and dynamic colour; native has neither.
2. **Fonts.** Official bundles GoogleSans (400/500/...) and GoogleSansCode; native has none, so all text renders in the system font.
3. **App icon.** Official uses the Immich pinwheel logo as an adaptive icon with a real monochrome (themed icon) layer. Native has its own vector, and its monochrome layer just reuses the foreground. Replace with the official assets from `mobile/android/app/src/main/res` and `mobile/assets` (`immich-logo.svg`, `immich-logo-android-adaptive-icon.png`, splash images).
4. **Splash and login branding.** Official login shows the pinwheel logo plus the pale-blue "immich" wordmark, a "Server Endpoint URL" outlined field, a pill "Next" button, a "Settings" link and a "v3.3.4 Logs" footer. Native login screen still needs to be screenshotted and compared.
5. **Bottom navigation.** Official tabs: Photos `photo_library_outlined`, Search `search_rounded`, Albums `photo_album_outlined`, Library `space_dashboard_outlined`. Native uses different icons (seen in the Library screenshot).
6. **Library screen.** Native shows a plain text list (Favorites, Archive, Trash, People, ...). The official layout must be checked in `lib/presentation/pages/library.page.dart` and with the signed-in app.
7. **Features already listed as not done** (from my project notes): Cast, biometric unlock, mTLS client certificates, Wi-Fi based endpoint switching, free-form crop handles.
8. **Official routes not yet audited against native** (the Flutter router has 57 pages): What's New, App logs and log detail, Sync status, Upload detail, Backup asset detail, Asset troubleshoot, Download info, Folder view, Recently taken, Profile picture crop, Map location picker, Cleanup preview, Memory list, Backup options, and others. Each needs a yes/no in the audit.

Not yet checked: translations (the official app ships many locales via `i18n/`), haptics/animations, notification content, widgets, accessibility.

## 4. Approach

The official Flutter source in `mobile/` is the spec for layout, strings, spacing and behaviour. The signed-in official app on the phone is the visual ground truth. Work in phases, each ending with a build and an on-device side-by-side check.

### Phase 0: Audit (no code changes)
- Sign in to the official app (section 8), keeping its backup OFF.
- Capture paired screenshots (official vs native) at 1080x2400 for every screen in the matrix below, light and dark.
- Produce a parity matrix: screen / feature -> official behaviour, native status, gap, effort.
- Diff `mobile/lib/presentation/pages/*` and the router against native screens.
- Update this file with the results before any implementation.

### Phase 1: Design system
- Port `color_scheme.dart` (seed-based schemes, presets, dynamic colour) into `ui/theme/Theme.kt`.
- Bundle GoogleSans and GoogleSansCode; map to the Material 3 typography scale the official app uses.
- Match shapes, elevations, dialog and bottom-sheet styles, and the navigation bar style.
- Replace the app icon (adaptive + monochrome), splash screen and in-app logo with official assets.

**Phase 1 status (2026-11-01): code written and built; NOT yet verified on the phone** (phone was locked when installing).
Done in code: Immich indigo color scheme generated from the official seeds via `material-kolor` (replaces the Android dynamic-color scheme; dark primary `#ACCBFA`, light `#4150AF`), GoogleSans / GoogleSansCode bundled, official title sizes, official launcher icon (foreground + themed monochrome, white background), app name "MyImmich" (chosen by the user so it differs from the official "Immich"), Photos tab uses the photo-library icon and Library the dashboard icon.
Expected dark values taken from the official screenshots: surface `#111318`, navigation bar `#1d2024`, indicator `#3d4758`, primary `#accbfa`. To check after install: these on the native app, font rendering, the home-screen icon.
Not done yet in Phase 1: colour presets and the Theme / Primary colour / Colorful interface settings, shapes and dialog/sheet styles, splash screen, the in-app logo and wordmark.

### Phase 2: Core screens to pixel parity
Login (incl. OAuth, server settings), Photos timeline (header, scrubber, grouping, selection bar), Search (filters, chips), Albums, Library, Asset viewer (gestures, bottom sheet, actions), Settings (all groups).

**Phase 2 status (2026-11-01): first batch built, not yet installed or verified on the phone** (the phone dropped off wireless adb and the server is down).
Done in code (compiles): official logo + wordmark as vector drawables (from mobile/assets SVGs); shared top bar with logo, tab actions and profile avatar; account card opened from the avatar (storage, app/server version, server URL, Free Up Space, Settings, Sign Out, Documentation/GitHub); Photos and Albums use the new bar (Albums: + moved into the bar, floating button removed); Library rebuilt like the official one (Favorites / Archived / Shared links / Trash pills, People / Places / On this device / Memories cards, Locked Folder + Partners list).
Known gaps in this batch: Library Folders row (no Folder view in the app yet), Logs and Licenses entries in the account card, Albums search box / filter chips / sort, Photos day headers with select circles and 4 per row, Search filters, Settings sections, login screen with the rotating logo.
Left in the Library list on purpose so they stay reachable: Map and Recently added (the official app reaches them from Places and Search).

### Phase 3: Feature gaps
Work through the audit's list: missing routes, Cast, biometric unlock, mTLS certificates, endpoint switching, full crop editor, notifications, background backup behaviour.

### Phase 4: Quality
- Unit tests for models, API parsing, backup logic; Compose UI tests for key screens.
- Lint clean, release build check, install and re-verify on the phone.

## 5. Screen matrix for the audit

Login · Server settings · Photos timeline · Selection mode + action bar · Asset viewer (photo, video, live photo) · Info/details sheet · Edit/crop · Search (text, filters, people, places) · Albums list · Album detail · Create/edit album · Album sharing/activity · Library · Favorites · Archive · Trash · Locked folder (PIN) · People list/detail · Places · Map · Memories (list + player) · Recently added/taken · Shared links · Partners · Backup (settings, album selection, status) · On this device / Free up space · Share-to-upload intent · Settings (every group) · Profile · Change password · About/logs/what's new.

## 5b. Completeness audit (second pass, 2026-11-01)

Question asked: does this plan cover every part of the official app? **The first version did not.** It missed whole areas. This section lists what the official source contains (from `mobile/lib`, `mobile/android`) and how the native app compares.

Method and limits: native status below comes from keyword searches of `mobile_android/app/src/main`, not from running each feature, so "present" means "something with that name exists", not "matches the official behaviour". Anything marked "check" must be confirmed on the device in Phase 0.

### A. Settings: official has 10 sections plus extras; native has one flat page
Official sections (`SettingSection`): Advanced, Asset viewer, Backup, Free up space, Language, Networking, Notifications, Preferences, Timeline, Sync status; plus What's new and a user/server header card.
Native: a single page with Account, Backup, Device, Storage and About rows, with hard-coded English text. Missing items (official setting -> native):
- Advanced: troubleshooting toggle, manage-media access (MANAGE_MEDIA), read-only mode, prefer remote images, sync remote deletions, log level, proxy headers (native has headers), clear image cache (native has it) -> mostly MISSING
- Asset viewer: original-image quality, tap-to-navigate, video auto-play / loop / original video, slideshow settings (direction, duration, repeat, shuffle, blurred background, contain/cover) -> MISSING (native has a slideshow, no settings)
- Backup: network requirements for photos/videos, charging requirement, background delay, organize into albums, sync albums -> check
- Free up space: cutoff date, keep favorites / keep albums, move to device trash, preview, rescan -> check (native has a cleanup screen)
- Language: in-app language picker over ~89 locales -> MISSING (native has a single `strings.xml` with 1 string; about 200 hard-coded `Text("...")` literals, zero `stringResource` uses)
- Networking: automatic endpoint switching by Wi-Fi name, external endpoints list, local endpoint, location permission flow -> MISSING
- Notifications: permission and enabled tiles -> check
- Preferences: theme mode, primary colour presets, colourful interface, haptic feedback, default share quality -> MISSING (haptic, share quality), colour presets need check
- Timeline: tiles per row, group by (day/month), smooth scrubbing, storage indicator -> check
- Sync status: entity counts, jobs, hash assets, export database, reset database, clear file cache -> MISSING (different architecture, see D)
- SSL client certificate import (mTLS) -> MISSING (already known)
- What's new, App logs, log detail -> MISSING

### B. Screens (official router has 57 pages)
Confirmed present in native: Photos, Search, Albums, Library, Favorites, Archive, Trash, People, Person, Places, Place detail, Map, Recently added, Memory, Shared links, Locked folder, Partners, Partner detail, Backup, On this device, Cleanup, Album detail, Settings, Headers.
To check on device: Create album, Album options, User selection, Activities, Slideshow, Edit image, Profile picture crop, Map location picker, Backup album selection, Backup options, Local/remote media summary, Folder view, Recently taken, Memory list, Asset selection timeline, Video page, Shared-link edit, PIN auth, Change password, Share intent.
Confirmed missing: What's new, App log, App log detail, Sync status, Upload detail, Backup asset detail, Asset troubleshoot, Download info, Folder view (`/view/folder` is not called anywhere in native; the earlier keyword hit on "folder" was a false positive from "Locked folder").
Unclear: the official `duplicate` hits may be a route guard against opening the same page twice, not a duplicate-photos page. Confirm in Phase 0.

### C. Viewer and timeline details
Official has: OCR overlay + toggle, rating bar, kebab menu, top/bottom app bars, stack widget, motion-photo button, like/activity button, download-status floating button, timeline drag-to-select, pinch-to-zoom grid, fixed header, scrubber, multi-select status button, quick date picker in search.
Native keyword scan: OCR overlay MISSING, tap-to-navigate MISSING, drag-to-select MISSING, download progress button MISSING; rating, stacks, motion photo, scrubber, slideshow, activities appear present (check parity).

### D. Android-native layer the first plan did not mention at all
Official `mobile/android` has Kotlin for: **home-screen widgets** (random photo, memory; with a configure activity), **background workers** (`BackgroundWorker`, `PeriodicWorker`, `MediaObserver`), **connectivity/network plugin**, **HTTP client manager** (client certs, headers), **permission delegates** (MANAGE_MEDIA), **media trash delegate**, **view-intent plugin**, **Glide module + local/remote image loaders + thumbhash**, **foreground service**, **biometric** permission, **https share-link verified deep link and `immich://` scheme**, **location permissions** (needed for Wi-Fi name).
Native: manifest has a launcher activity, `app.immich` OAuth scheme, SEND/SEND_MULTIPLE, VIEW content intents, a provider and one service. Missing: home-screen widgets, biometric, `immich://` scheme, verified https share-link deep links, location/Wi-Fi permissions, MANAGE_MEDIA permission entry, notification channels per feature (check).

### E. Architecture differences that limit exact parity
The official app syncs through a server sync stream into a local drift/SQLite database and works offline; native calls the REST API directly, so offline browsing, sync status, "prefer remote", "read-only mode" and database export/reset have no equivalent. Decide in Phase 0 whether to add a local database (large) or accept the difference.

### F. Tests
Native: 1 test file (157 lines). Official: 119 Dart test files. No UI tests in native.

### G. What I could not inspect
Screens behind the sign-in on the official app, animations, haptics, exact spacing, notification text, and translated strings. These need the official app signed in (section 8).

Phase 3 above must therefore include: settings restructure (A), localisation of all strings, widgets and background workers (D), the missing pages (B), viewer/timeline gestures (C), and the sync-architecture decision (E).

## 5c. Server API coverage audit (third pass)

Measure: every endpoint in `open-api/immich-openapi-specs.json` (292 operations) against the path strings in `mobile_android` source. Raw match is 84/292, but that undercounts: asset thumbnail/original/video URLs, login, OAuth and chunked upload are built from templates and do exist. About 60 of the 292 are admin-only (users admin, maintenance, queues, jobs, libraries, workflows, system config, database backups) and do not belong in a phone app, so they are excluded below.

**Corrected in the fourth pass.** The earlier list here was wrong: it treated class names in `mobile/lib` as proof that specific endpoints were called. The check now matches each spec `operationId` against method calls in hand-written Dart, plus raw URLs. It finds 66 of 292 operations called by name, 54 of them also matched in native.

Called by the official app, not matched in native:
- `/sync/stream` (raw URL in `sync_api.repository.dart`), `POST` + `DELETE /sync/ack` (sync engine, see E)
- `/view/folder`, `/view/folder/unique-paths` (Folder view)
- `/search/explore`
- `/server/storage`, `/server/version`
- `POST /sessions`
- `GET /users/me/preferences`
- `PUT /assets/metadata`, `PUT /assets/{id}/metadata`

Likely false positive: `POST /libraries/{id}/validate` (the name `validate` is generic).

Not called by name in the official app, so NOT parity requirements unless Phase 0 shows otherwise: `/download/*`, `/assets/{id}/ocr`, `/faces*`, `/tags/{id}`, `/memories/{id}*`, `/shared-links/{id}/assets`, `GET /sessions`, `PUT /users/me/preferences`, `/notifications*`, `/duplicates*`, `/map/reverse-geocode`, `/search/places`, `/search/random`, `/search/person`.
OCR is still a real gap: the official viewer has an OCR overlay, but where it gets its data was not traced. It may come through the sync stream.

## 5d. Asset actions and remaining screens (fourth pass)

Official actions are in `mobile/lib/presentation/actions` (25 files). No native match by keyword: similar photos, open in browser, cast. Keyword matches that still need behaviour checks: archive, delete, download, edit date, edit location, favorite, lock, remove from album, album cover, profile picture, share, share link, slideshow, stack, tag, upload.
Not yet compared: `asset_debug`, `partner` and `restore` actions; the 10 context-specific bottom sheets in `presentation/widgets/bottom_sheet`.
No native keyword match: Memory list, Recently taken, Asset selection timeline. Backup album selection also had no match, but earlier notes say the album list worked on the device, so this search was probably too narrow.
Keyword matches only: Create album, album options, user selection, activities, slideshow, editor, location picker, shared-link edit, PIN.
Profile picture crop is unconfirmed: the upload endpoint matches, but a crop screen was not found or ruled out.

Correction to an earlier note: native does implement chunked upload (found in `Uploader.kt` and `BackupManager.kt`).

This audit is by path string only. It says nothing about whether an endpoint that IS used behaves like the official app.

## 5e. Fifth pass: items closed from source

- **Spec baseline changed.** Tag `v3.3.4` (`69e0cb860`) is in the local repo and matches the installed app. Use that tag as the spec, not the working tree in `mobile/`, which is 3.3.0-rc.0 plus fork changes. 83 files under `mobile/lib` and `mobile/android/app/src/main` differ between the fork's parent commit and the tag. The file list and commit titles were read, not the file contents; review them in Phase 0.
- **OCR source traced.** The official app receives OCR through the sync stream (`updateAssetOcrV1`) and stores it locally. Without a local database, native could call `GET /assets/{id}/ocr` directly instead.
- **Selection bottom sheets.** Official action sets, from source:
  - general: archive, debug, cleanup local, delete, download, edit date, edit location, favorite, lock, share, share link, stack, tag, upload
  - favorite and archive: general set minus tag and upload
  - remote album: favorite set plus remove from album and set album cover
  - local album: debug, cleanup local, delete, share, upload
  - locked folder: debug, delete, download, lock, share
  - partner: debug, download, share
  - trash: debug, delete, restore
  - map and base sheets: no action names found by this search; read the source in Phase 0
  Native must offer the same set in each context. This per-context check has not been done.
- **New gaps.** Asset debug / troubleshoot has no native match. Birthday memories (added in official #32165) have no match in `ui/memories`.
- **Design detail found.** The login logo rotates continuously, one turn every 60 seconds (`login_form.dart:73`).

## 5f. Device check, official v3.3.4 signed in (2026-11-01)

Read on the phone with the screen reader and screenshots. No Immich data was changed.

Differences seen. Selection and viewer rows compare a server photo (official) with a device-only photo (port), so they need rechecking on the same kind of photo.

| Area | Official | Port (`mobile_android`) |
|---|---|---|
| Photos header | Logo + wordmark, backup icon, profile avatar | "Photos" title, backup icon, no avatar |
| Grouping | Month title + day headers with select circles; 4 per row | Month only; 3 per row |
| Timeline start (backup off) | Server photos, starts Oct 29 | Device-only photos first, plus a "Checking device photos" line and a memories row |
| Search | People, Location, Camera, Date, Media Type chips; Recently taken/added, Videos, Favorites links; search by context, file name, description, OCR | Smart search, Photos, Videos, Favorites chips |
| Albums | + in top bar, search box, All / Shared with me / My albums, sort, grid toggle | Floating "New album" button, empty text |
| Library | Pills, large People/Places/On this device/Memories cards, Folders/Locked Folder/Partners list | Plain list |
| Profile | Sheet: storage, versions, URL, Logs, Free Up Space, Settings, Sign Out, Documentation/GitHub/Licenses | No avatar or sheet seen |
| Selection | Share, Share Link, Download, Trash, Favorite, Archive, Edit Date & Time, Add to album, Create new album (more may be off-screen) | Device photo: Share, Back up, Delete from device |
| Viewer | Top: favorite, menu. Bottom: Share, Edit, Add to, Trash. Menu: Info, Share Link, Cast, View similar photos, Set as profile picture, Slideshow, Download, Open in browser. Add to: Album, Archive, Locked folder | Device photo: Back, Share, Back up, Delete from device |
| Editor | Free, Original, 1:1, 16:9, 3:2, 7:5, 4:3, Reset (more tools may exist) | Rotate, mirror, centered crop per earlier notes; not opened on device |
| Settings | 10 sections + What's new (9 of 11 rows opened) | One flat page per source; not opened on device |

To investigate: official Folders was empty and its log says "Failed to fetch unique original links", which may be a server problem. Official Sync Status showed 8823 local assets while the port was checking 5670 device photos; unexplained.

### Still not verified on the device
- Official, not opened by agreement: Trash screen, Free Up Space, Sync Status actions, locked folder contents (needs a PIN to be created).
- Official, nothing to open on this account: album detail/options, person detail, shared-link edit, partner detail.
- Official, not reached: video player, Media Type filter, Create album, Backup album selection and options, What's new, map controls, multi-photo selection, share sheet, Cast, light theme and colour presets, gestures, animations, background backup, notifications, home-screen widgets, OAuth, other languages.
- Port: Library sub-screens, Settings, server-photo viewer, editor, and everything else that needs a side-by-side.

## 5g. Device test of MyImmich (the port), 2026-11-01, server DOWN

The API server stopped during testing (`localhost:2283` refused, `localhost:3000` returned 502; the port is configured for `http://192.168.1.105:2283`). So only offline-capable screens could be exercised. No crashes in the crash log during the run.

Worked: Phase 1 colors/font/icon on the phone (surface `#111318`, nav bar `#1d2024` match the official app); all four tabs open; Library entries open (Favorites, Archive, People, Places, Map, Recently added, Shared links, Locked folder, Partners, On this device, Backup); Settings page lists every row; a device-only photo opens in the viewer with Share / Back up / Delete from device.

Defects found:
1. **Endless spinner when the server is unreachable**: People shows a spinner with no error text, no retry and no timeout. Other server-backed screens need the same check.
2. Map opened with only a Back button (no map, no message) with the server down.
3. Locked folder printed no readable content in the dump when opened; needs a re-test with a PIN set.
4. The phone flipped between portrait and landscape during testing; the Library list is clipped in landscape (5 rows visible). Landscape layouts need checking.
5. The Backup screen reported "Last run 01/11/26 7:27 pm" after install; automatic backup is on in the port. Nothing new was uploaded (it said everything in the selected albums is backed up), but this means the port can back up on its own while being tested.

Not tested because the server was down: timeline with server photos, search results, albums, people/places data, memories, shared links, viewer for server photos, editing actions, uploads, sign-in.

## 6. Verification method

- Build: `export JAVA_HOME=/c/Users/sudip/.gradle/jdks/eclipse_adoptium-25-amd64-windows.2` then `./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug` from `mobile_android/`.
- Device: adb at `C:\Users\sudip\AppData\Local\Android\Sdk\platform-tools\adb.exe`; install the debug APK, drive with `adb shell input`, capture with `adb exec-out screencap -p`.
- Server for the native app: PC LAN IP `192.168.1.105:2283` (not localhost).
- Each phase is "done" only when its screens match in side-by-side screenshots and the build is green.

## 7. Risks and rules

- Official and native apps must not both back up the same photos to the server at once (duplicates). Keep official backup off during comparison.
- Testing must not change real data: no uploads, deletes, trash, archive or favorite changes on the user's library without asking first.
- Smart search on the dev server returns HTTP 500 because the machine-learning service is not running; this is a server issue, not an app bug.
- Official source (3.3.0-rc.0) trails the installed app (3.3.4); where they differ, the device wins.
- Official Immich assets are AGPL-licensed; fine for a personal fork, check before distributing.

## 8. What I need from you to continue

1. Sign in on the official Immich app on the phone (same server), or give me a test account, so I can compare the logged-in screens. I will only browse.
2. Confirm scope: full parity with every feature in section 5, or core screens (Phases 1-2) first.
3. Approve this plan before I change any code.
