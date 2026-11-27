# Photos — phone app (PWA)

An installable app for phones that looks like the Android app. The server serves it at **`/app/`**, with the same
login as the web app.

```bash
cd pwa
npm install
npm run build      # writes pwa/build, which the server serves at /app/
npm run dev        # development at http://localhost:5174/app/ (API proxied to :3000)
```

## Installing on a phone

Browsers install an app, and run its service worker, only over **https** (or `localhost`). Over plain
`http://192.168.x.x:3000/app/` it works as a web page but cannot be installed or receive shared photos.

One way to get https inside your own network is Tailscale (it needs HTTPS certificates enabled for the tailnet):

```bash
tailscale serve --bg 3000
```

Then open `https://<machine>.<tailnet>.ts.net/app/` on the phone and choose **Install app**.

## What it does

Photos by month and day, similar photos on one tile, viewer with swipe and zoom, select by long press, favorite,
archive, albums, bin, search, upload (resumable, same code as the web), share to the app, light and dark.

## What a web app cannot do

Back up the phone's gallery by itself, show photos that are only on the phone, or free up space. Use the Android app
for those. People, places, map, sharing and administration are in the full web app (`/photos`).

## Code

Screens are in `src/`. API calls, sign-in, upload, timeline loading, zoom and grouping are imported from
`../web/src` (alias `@web`), so a change there affects both apps.
