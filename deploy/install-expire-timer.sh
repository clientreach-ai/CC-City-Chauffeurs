#!/usr/bin/env bash
#
# Turns on the hourly enquiry sweep, on the VPS, as root. Once.
#
# Nothing in deploy.sh touches this: a deploy must never turn the sweep on by
# itself, and the deploy user holds sudo for exactly one command (restarting
# cc-server), so it cannot. Hence this, run by a person who has root.
#
#   sudo ./deploy/install-expire-timer.sh
#
# It dry-runs the sweep first and stops to show what the first real run would
# close, because the sweep closes enquiries the office can still see in the
# admin. Nothing is installed until that is agreed to. Re-running it is safe.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/cc-city-chauffeurs}"
RUN_AS="${RUN_AS:-dave}"
BUN="${BUN:-/home/$RUN_AS/.bun/bin/bun}"
SERVER_DIR="$REPO_DIR/apps/server"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root: installing a unit needs it. sudo $0" >&2
  exit 1
fi

for path in "$SERVER_DIR/scripts/expire-enquiries.ts" "$SERVER_DIR/.env.production" "$BUN"; do
  [ -e "$path" ] || { echo "Not where expected: $path" >&2; exit 1; }
done

UNIT_DIR="$(cd "$(dirname "$0")" && pwd)"
for unit in cc-expire-enquiries.service cc-expire-enquiries.timer; do
  [ -f "$UNIT_DIR/$unit" ] || { echo "Missing unit file: $UNIT_DIR/$unit" >&2; exit 1; }
done

echo "==> What the first run would close (nothing is written)"
cd "$SERVER_DIR"
sudo -u "$RUN_AS" "$BUN" run --env-file .env.production scripts/expire-enquiries.ts --dry-run

cat <<'NOTE'

That is what the first real run will close. Each of those enquiries moves to
Expired and gets one line on its trail; none is deleted, and the office can
reopen any of them. An enquiry is only eligible if its journey date has gone
by, it has no booking, and nobody has won it.

NOTE
read -r -p "Install the units and start the hourly timer? [y/N] " answer
case "$answer" in
  [yY] | [yY][eE][sS]) ;;
  *) echo "Nothing installed."; exit 0 ;;
esac

echo "==> Installing the units"
install -m 644 "$UNIT_DIR/cc-expire-enquiries.service" /etc/systemd/system/cc-expire-enquiries.service
install -m 644 "$UNIT_DIR/cc-expire-enquiries.timer" /etc/systemd/system/cc-expire-enquiries.timer
systemctl daemon-reload

echo "==> Running it once, watching it"
systemctl start cc-expire-enquiries.service
journalctl -u cc-expire-enquiries -n 30 --no-pager

if ! systemctl is-failed --quiet cc-expire-enquiries.service; then
  echo "==> Enabling the hourly timer"
  systemctl enable --now cc-expire-enquiries.timer
  systemctl list-timers cc-expire-enquiries --no-pager
  echo
  echo "On. The timer is what makes it hourly; the service on its own runs once."
else
  echo "The single run failed — the timer is NOT enabled. Read the log above." >&2
  exit 1
fi
