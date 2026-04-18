# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy all node_modules (hoisted at root level by npm workspaces)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY package.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build the frontend (Vite outputs to frontend/dist/)
ENV VITE_API_BASE_URL=/api
RUN npm run build --workspace=@ap-automation/frontend

# ── Stage 3: Serve with nginx ────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
