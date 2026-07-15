#!/bin/sh
set -eu

mkdir -p /app/server/data /app/servers

servers_mode_marker=/app/server/data/.servers-mode-777-v1
chmod 777 /app/servers
if [ -f "$servers_mode_marker" ]; then
  ensure-tree-mode.sh /app/servers 777 &
else
  ensure-tree-mode.sh /app/servers 777
  touch "$servers_mode_marker"
fi

chown -R node:node /app/server/data
find /app/server/data -type d ! -perm 750 -print0 | xargs -0 -r chmod 750
find /app/server/data -type f ! -perm 640 -print0 | xargs -0 -r chmod 640
if [ -f /app/server/data/users.json ]; then
  chmod 600 /app/server/data/users.json
fi

exec gosu node "$@"
