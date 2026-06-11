# GRVT Grid Notifier — sidecar Telegram worker.
# Reads the bot's SQLite file via a shared bind mount (read-only).

FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY package.json package-lock.json ./
COPY packages/notifier/package.json packages/notifier/
COPY packages/notifier/tsconfig.json packages/notifier/

RUN npm ci --workspace=@grvt-grid/notifier --include-workspace-root

# Recompile native sqlite3 from source against this image's glibc (2.36),
# not a prebuilt binary that may require a newer glibc and fail at runtime.
RUN npm rebuild sqlite3 --build-from-source

COPY packages/notifier/src packages/notifier/src
RUN npm run build --workspace=@grvt-grid/notifier

# ── Runtime ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 10001 notifier && \
    useradd -u 10001 -g notifier -m -s /usr/sbin/nologin notifier

WORKDIR /app

COPY --from=builder --chown=notifier:notifier /build/packages/notifier/dist ./dist
COPY --from=builder --chown=notifier:notifier /build/node_modules ./node_modules
# npm workspaces nests version-conflicted deps (e.g. dotenv@16, since the bot
# owns dotenv@17 at the hoisted root) under the package dir. The root copy
# above misses them, so overlay the nested set on top.
COPY --from=builder --chown=notifier:notifier /build/packages/notifier/node_modules ./node_modules
COPY --chown=notifier:notifier packages/notifier/package.json ./package.json

# Cursor state directory — separate from the bot's data dir
RUN mkdir -p /var/lib/grvt-grid-notifier && \
    chown notifier:notifier /var/lib/grvt-grid-notifier
VOLUME /var/lib/grvt-grid-notifier

USER notifier

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
