# ── Stage 1: build Vite bundle ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# VITE_API_URL is baked into the JS bundle at build time.
# Pass it as a build argument:
#   docker build --build-arg VITE_API_URL=https://your-api/api .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Replace default nginx config with our SPA-aware config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled bundle from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
