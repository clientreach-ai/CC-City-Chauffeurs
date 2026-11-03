#!/usr/bin/env bash
# Puts the current master onto the VPS. Run on the host — by CI on every push,
# or by hand when CI is not an option. Secrets live in apps/server/.env.production,
# which is not in this repository.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/cc-city-chauffeurs}"
PORT="${PORT:-3300}"
export PATH="$HOME/.bun/bin:$PATH"

cd "$REPO_DIR"

echo "==> Fetching master"
git fetch --depth 50 origin master
git reset --hard origin/master

echo "==> Installing (the server's subgraph only — the Next apps deploy elsewhere)"
pnpm install --filter server... --frozen-lockfile

echo "==> Building"
pnpm --filter server... run build

# The unit file is installed by hand, not here. Installing it from the
# checkout as root on every deploy meant anything able to write to the
# checkout — the service's own user — could hand itself a root unit. With the
# install gone, the deploy user needs sudo for exactly one command:
#
#   dave ALL=(root) NOPASSWD: /usr/bin/systemctl restart cc-server
#
# When deploy/cc-server.service changes, install it once, by hand, as root:
#
#   install -m 644 deploy/cc-server.service /etc/systemd/system/cc-server.service
#   systemctl daemon-reload && systemctl restart cc-server
echo "==> Restarting cc-server"
sudo -n systemctl restart cc-server

echo "==> Health check"
for _ in $(seq 1 20); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/" >/dev/null; then
    echo "    OK on :${PORT} — $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done

echo "    Never answered on :${PORT}. Last logs:" >&2
sudo -n journalctl -u cc-server -n 40 --no-pager >&2
exit 1
