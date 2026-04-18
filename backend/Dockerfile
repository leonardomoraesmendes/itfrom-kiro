# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --ignore-scripts

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy all node_modules (hoisted at root level by npm workspaces)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY package.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY backend/ ./backend/

EXPOSE 3000

CMD ["npx", "tsx", "backend/src/index.ts"]
