# ================================================================
# Dockerfile for Anveek Groundnut Oil Store + Baileys WhatsApp
# ================================================================

FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package.json bun.lock bunfig.toml ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy app source code
COPY . .

# Set environment for node-server build
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server

# Build app
RUN bun run build

# ================================================================
# Production Runner Stage
# ================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built server bundle and public assets
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Persistent storage directory for WhatsApp credentials session
RUN mkdir -p /app/whatsapp-auth
VOLUME ["/app/whatsapp-auth"]

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
