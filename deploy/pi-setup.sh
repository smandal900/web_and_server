#!/usr/bin/env bash
# Run ON the Raspberry Pi:  bash pi-setup.sh   (expects immich-web.tar.gz next to it)
set -euo pipefail
APP="$HOME/immich-web"
cd "$(dirname "$0")"

echo "== Pi: $(tr -d '\0' </proc/device-tree/model 2>/dev/null || echo unknown) | $(uname -m) | $(free -m | awk '/Mem:/{print $2" MB RAM"}')"

# Node >= 22.13 (needed for the built-in node:sqlite)
need_node=1
if command -v node >/dev/null; then
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' && need_node=0
fi
if [ $need_node = 1 ]; then
  echo "== installing Node 22 (NodeSource) + ffmpeg (needs sudo)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v ffmpeg >/dev/null || { echo "== installing ffmpeg (needs sudo)"; sudo apt-get install -y ffmpeg; }
echo "node $(node -v) | $(ffmpeg -version | head -1)"

mkdir -p "$APP"
tar -xzf immich-web.tar.gz -C "$APP"
cd "$APP/server"
npm install --omit=dev
[ -f .env ] || cat > .env <<'ENV'
PORT=3000
GROUP_MERGE=core+timeline+media
MEDIA_JOBS=1
STATUS_TOKEN=pi-test
ENV
echo "== installed in $APP"
echo "start:  cd $APP/server && set -a && . ./.env && set +a && npm start"
