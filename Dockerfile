FROM node:20-bullseye AS builder

WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/
RUN cd client && npm ci
RUN cd server && npm ci

COPY . .
RUN cd client && npm run build
RUN cd server && npm run build

FROM node:20-bullseye-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y dumb-init gosu --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/client/dist ./client/dist
COPY ensure-tree-mode.sh /usr/local/bin/ensure-tree-mode.sh
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/ensure-tree-mode.sh /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

VOLUME [ "/app/server/data" ]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dumb-init", "node", "server/dist/index.js"]
