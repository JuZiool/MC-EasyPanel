#!/bin/sh
set -eu

mkdir -p /app/server/data /app/servers

chmod -R 777 /app/servers

chown -R node:node /app/server/data
find /app/server/data -type d -print0 | xargs -0 -r chmod 750
find /app/server/data -type f -print0 | xargs -0 -r chmod 640
if [ -f /app/server/data/users.json ]; then
  chmod 600 /app/server/data/users.json
fi

exec gosu node "$@"
