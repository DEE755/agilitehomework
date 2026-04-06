# ── Stage 1: compile TypeScript ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all deps (including devDeps needed for tsc)
COPY package*.json ./
RUN npm ci

# Compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from build stage
COPY --from=builder /app/dist ./dist

EXPOSE 5050

CMD ["node", "dist/index.js"]
