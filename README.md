# ProjectAgilite — Support Portal

A full-stack customer support platform built for a premium tactical gear brand. Agents work a priority ticket queue through a dark internal workspace. Customers open tickets through a separate customer portal. An AI layer handles triage, auto-replies, customer profiling, and cross-sell recommendations.

---

## Table of Contents

1. [Overview](#overview)
2. [Stack](#stack)
3. [Project Structure](#project-structure)
4. [Local Setup](#local-setup)
5. [Environment Variables](#environment-variables)
6. [Admin & Agents](#admin--agents)
7. [AI Integration](#ai-integration)
8. [Marketing Tools](#marketing-tools)
9. [Security](#security)
10. [MongoDB Atlas Setup](#mongodb-atlas-setup)
11. [Render Deployment](#render-deployment)
12. [Docker](#docker)
13. [Deploying on Other Platforms](#deploying-on-other-platforms)
14. [API Reference](#api-reference)
15. [Scripts](#scripts)

---

## Overview

**ProjectAgilite** is a monorepo with two separate apps sharing one API:

- A **customer portal** — browse products, open tickets, reply to threads, track status
- An **agent workspace** (`/admin`) — priority queue, ticket management, AI tools, agent management

Key features:

- Ticket queue with status (`new` / `in_progress` / `resolved`), priority, agent, and tag filters
- Full conversation thread with internal notes (agent-only) and customer replies
- Human-editable priority (High / Medium / Low / Irrelevant) alongside AI triage
- AI auto-triage on ticket creation — summary, priority, tags, suggested next step
- AI-suggested replies with auto-send eligibility scoring
- AI Agent account that auto-replies when assigned, with typing indicator and live polling
- **Customer Intelligence** — AI profiles each customer (archetype, refund/churn risk, sentiment, LTV signal)
- **Product Remarketing** — AI picks a cross-sell product + generates a pitch; manual product selection also supported
- Product catalog linked to tickets (R2-hosted images with signed URLs)
- Agent management with role-based access (`agent` / `admin`), welcome emails via Mailgun
- "Resend invite" per agent (generates new temp password)
- Agent activity panel (assigned tickets, recent replies, stats)
- Fully typed end-to-end (TypeScript on both client and server)

---

## Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | React 18, Vite, TypeScript, Tailwind CSS v3             |
| Routing    | React Router v6                                         |
| Backend    | Node.js, Express 4, TypeScript                          |
| Database   | MongoDB Atlas, Mongoose 8                               |
| Storage    | Cloudflare R2 (S3-compatible, signed URLs)              |
| AI         | Pydantic AI Gateway → AWS Bedrock (Claude Sonnet)       |
| Email      | Mailgun HTTP API                                        |
| Auth       | JWT (HS256, 7-day expiry) + bcrypt (cost 12)            |

---

## Project Structure

```
projectAgilite/
├── client/                          # Vite + React frontend
│   └── src/
│       ├── components/
│       │   ├── admin/
│       │   │   ├── AdminLayout.tsx  # Sticky nav, settings panel
│       │   │   └── SettingsPanel.tsx
│       │   ├── AttachmentGallery.tsx
│       │   ├── PriorityBadge.tsx
│       │   ├── Skeleton.tsx
│       │   ├── StatusBadge.tsx
│       │   └── Toast.tsx
│       ├── pages/
│       │   ├── admin/
│       │   │   ├── AdminDashboardPage.tsx   # Ticket queue + filters
│       │   │   ├── AdminTicketDetailPage.tsx # Ticket detail + AI panel + Marketing Tools
│       │   │   ├── AdminAgentsPage.tsx       # Agent list, create, activity slide-over
│       │   │   └── AdminLoginPage.tsx
│       │   ├── CreateTicketPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── ProductsPage.tsx
│       │   └── TicketDetailPage.tsx
│       ├── services/
│       │   ├── adminApi.ts          # Typed admin API client
│       │   └── api.ts               # Typed customer API client
│       └── types/
│           ├── admin.ts
│           └── ticket.ts
│
└── server/
    └── src/
        ├── controllers/
        │   ├── admin.controller.ts  # Ticket management, agent CRUD, products
        │   ├── aiController.ts      # AI triage, suggest-reply, profile, remarket
        │   ├── auth.controller.ts   # Login
        │   ├── ticket.controller.ts # Customer-facing ticket endpoints
        │   └── upload.controller.ts # S3 presigned upload URLs
        ├── middlewares/
        │   ├── requireAuth.ts       # JWT verification
        │   └── errorHandler.ts
        ├── models/
        │   ├── Product.ts           # Tactical gear product catalog
        │   ├── Setting.ts           # App-wide settings (auto-reply toggle)
        │   ├── Ticket.ts            # Ticket with replies, notes, AI fields
        │   └── User.ts              # Agent accounts (including AI Agent)
        ├── routes/
        │   ├── admin.routes.ts
        │   ├── aiRoutes.ts
        │   ├── auth.routes.ts
        │   ├── product.routes.ts
        │   └── ticket.routes.ts
        ├── services/
        │   ├── aiAgentService.ts    # AI auto-reply pipeline
        │   ├── aiService.ts         # All LLM call functions
        │   ├── emailService.ts      # Mailgun welcome emails
        │   └── storage.ts           # R2 signed URLs
        └── types/
            ├── auth.types.ts
            ├── product.types.ts
            └── ticket.types.ts
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (free M0 cluster is sufficient)
- Pydantic AI Gateway API key (for AI features)
- Mailgun account (for agent welcome emails)
- Cloudflare R2 bucket (for product images)

### 1. Clone and install

```bash
git clone https://github.com/DEE755/agilitehomework.git
cd projectAgilite

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root and fill in your values (see [Environment Variables](#environment-variables)).

### 3. Seed the database

```bash
# Create the first admin account
cd server && npm run seed

# Seed the product catalog (8 items)
npm run seed:products

# Upload product images to R2 (requires S3 env vars)
npm run seed:images
```

### 4. Run in development

```bash
# From the repo root — starts API + frontend together
npm run dev
```

| Service | URL                   |
| ------- | --------------------- |
| Customer portal | http://localhost:3000 |
| Agent workspace | http://localhost:3000/admin |
| API     | http://localhost:5050 |

The Vite dev server proxies all `/api/*` requests to port 5050 — no CORS config needed in development.

---

## Environment Variables

All variables live in a single `.env` file at the project root.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `PORT` | No | Express port. Defaults to `5050`. |
| `MONGODB_URI` | Yes | Full MongoDB Atlas connection string including database name. |
| `JWT_SECRET` | Yes | Long random string used to sign JWT tokens. **Always set in production.** |
| `PYDANTIC_AI_GATEWAY_API_KEY` | For AI features | API key for the Pydantic AI Gateway (proxies to AWS Bedrock). |
| `PYDANTIC_GATEWAY_REGION` | No | Gateway region prefix, e.g. `us`. Defaults to `us`. |
| `PYDANTIC_ANTHROPIC_MODEL` | No | Model ID. Defaults to `claude-sonnet-4-6`. |
| `S3_ENDPOINT` | For images | S3-compatible endpoint. For Cloudflare R2 include the bucket path. |
| `S3_BUCKET` | No | Bucket override if not in `S3_ENDPOINT`. |
| `S3_REGION` | No | S3 region. Use `auto` for Cloudflare R2. |
| `S3_ACCESS_KEY_ID` | For images | R2 / S3 access key. |
| `S3_SECRET_ACCESS_KEY` | For images | R2 / S3 secret key. |
| `S3_PUBLIC_BASE_URL` | No | Public asset base URL if images are publicly served. |
| `MAILGUN_API_KEY` | For email | Mailgun API key (Dashboard → API Keys). |
| `MAILGUN_DOMAIN` | For email | Sending domain — use sandbox for testing, custom domain in production. |
| `MAILGUN_FROM_EMAIL` | No | Sender address. Defaults to `no-reply@{MAILGUN_DOMAIN}`. |
| `SEED_EMAIL` | No | Admin email for the seed script. Defaults to `admin@agilite.com`. |
| `SEED_PASSWORD` | No | Admin password for the seed script. Defaults to `Admin1234!`. |

Example `.env`:

```env
PORT=5050
MONGODB_URI=mongodb+srv://user:password@cluster.xxxxx.mongodb.net/projectagilite?retryWrites=true&w=majority
JWT_SECRET=replace_with_64_random_bytes_hex

PYDANTIC_AI_GATEWAY_API_KEY=pyd-...
PYDANTIC_GATEWAY_REGION=us
PYDANTIC_ANTHROPIC_MODEL=claude-sonnet-4-6

S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com/<bucket>
S3_REGION=auto
S3_ACCESS_KEY_ID=your_r2_access_key
S3_SECRET_ACCESS_KEY=your_r2_secret

MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=sandbox-xxx.mailgun.org
MAILGUN_FROM_EMAIL=Agilite Support <no-reply@mail.agilite.com>
```

---

## Admin & Agents

### Creating the first admin

There is no self-registration. Bootstrap the first admin with the seed script:

```bash
cd server && npm run seed
```

This is idempotent — it skips creation if the email already exists.

### Managing agents

Navigate to `/admin/agents` (admin role required) to:

- View all agents and the built-in AI Agent
- Create new agents — they receive a welcome email with login credentials via Mailgun
- Resend invite — generates a new temporary password and re-sends the welcome email
- Remove agents (cannot remove yourself or the AI Agent)
- Click any agent row to view their activity panel — stats (assigned, resolved, replies, notes), last 20 assigned tickets, and recent replies

### Roles

| Role | Capabilities |
| ---- | ------------ |
| `agent` | View tickets, reply, add notes, assign to self, run AI tools |
| `admin` | All agent capabilities + create/remove agents, update settings |

### JWT rotation

To invalidate all active sessions instantly:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Replace `JWT_SECRET` in `.env` and restart the server. All existing tokens become invalid immediately.

---

## AI Integration

The AI layer routes requests through the **Pydantic AI Gateway** to AWS Bedrock (Claude Sonnet). All calls are server-side — API keys never reach the browser.

### Auto-triage

When a ticket is created, the pipeline (`aiAgentService`) automatically:

1. Sends the ticket title + description through the triage prompt
2. Persists `aiSummary`, `aiPriority`, `aiTags`, `aiSuggestedNextStep`, and `aiTriagedAt` on the ticket
3. If priority is `irrelevant` (spam, gibberish, abusive), auto-closes the ticket with `status: resolved`
4. If `autoReplyEnabled` is true (Settings panel), assigns the AI Agent and triggers the auto-reply pipeline

### AI Agent auto-reply

Assigning the built-in **Agilite Support AI** agent triggers `runAiAgentPipeline`:

- Runs `suggestReply` — assesses eligibility, confidence, and risk
- If `autoReplyEligible: true` and confidence ≥ 0.7 and risk ≠ `high`, posts a reply and sets status `in_progress`
- If not eligible, leaves the ticket unresponded (human review required)

The ticket detail page polls every 2.5 s (up to 90 s) and shows a typing indicator while waiting.

### Suggest Reply (manual)

Agents can click **Suggest Reply** on any ticket. The result is pre-filled into the reply box. If the AI marks it auto-eligible, a **Send AI Reply** shortcut appears.

### AI endpoints

All require `Authorization: Bearer <token>` except `/api/ai/ask`.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/ai/triage-ticket` | Triage a ticket — returns summary, priority, tags, next step |
| `POST` | `/api/ai/suggest-reply` | Generate a suggested reply with eligibility scoring |
| `POST` | `/api/ai/customer-profile` | Analyse customer intent and behaviour (see Marketing Tools) |
| `POST` | `/api/ai/remarket` | Generate a cross-sell product recommendation + pitch |
| `POST` | `/api/ai/ask` | Customer-facing pre-ticket AI assistant (no auth) |

---

## Marketing Tools

The **Marketing Tools** panel sits in the ticket detail sidebar (collapsed by default, toggled with the `📊` button). It is non-invasive — agents activate it only when relevant.

### Customer Intelligence

Click **Analyse** to profile the customer using the ticket content and full conversation history.

| Signal | Values | Description |
| ------ | ------ | ----------- |
| **Archetype** | Early Adopter · Loyal Advocate · Price-Sensitive · Casual Buyer · Frustrated Veteran | Behavioural classification based on tone, language, and context |
| **Refund Intent** | Low / Medium / High | Likelihood the customer wants a refund or escalation |
| **Churn Risk** | Low / Medium / High | Risk of losing the customer after this interaction |
| **Sentiment** | Positive / Neutral / Frustrated / Hostile | Overall emotional tone |
| **LTV Signal** | High / Medium / Low | Lifetime value signal (multiple purchases, team/military use, etc.) |
| **Suggested Approach** | Free text | One actionable recommendation for handling this specific customer |

The profiling result is used automatically as context for remarketing — the AI respects hostile or high-refund-intent customers and suppresses sales pitches for them.

### Product Remarketing

Generate a contextual cross-sell or upsell recommendation from the internal product catalog.

**Auto mode (AI picks):**
- The AI selects the single best complementary product based on the ticket context and customer profile
- Returns a match reason explaining why the product fits this customer
- Generates a 2–3 sentence soft-pitch paragraph to append to the support reply

**Manual mode:**
- Agent selects a product from the dropdown (all active catalog products)
- AI generates a personalised pitch for that specific product

**Result actions:**
- **+ Append to Reply** — injects the pitch paragraph directly into the reply text area
- **Copy** — copies the paragraph to clipboard

**Pitch suppression:** If the customer has `refundIntent: high` or `sentiment: hostile`, the AI sets `shouldPitch: false` and returns a warning instead of a pitch. You will never accidentally upsell an angry customer.

### API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/ai/customer-profile` | Profile a customer from ticket + conversation history |
| `POST` | `/api/ai/remarket` | Generate product recommendation + pitch paragraph |
| `GET`  | `/api/admin/products` | List active catalog products with signed image URLs (for manual selector) |

#### `POST /api/ai/customer-profile` body

```json
{
  "ticketId": "optional — persists result on ticket",
  "subject": "Plate carrier strap fraying",
  "message": "I've bought three of your products and this is the third time...",
  "productTitle": "Agilite Plate Carrier",
  "conversationHistory": "Agent (John): ... \nCustomer: ..."
}
```

#### `POST /api/ai/remarket` body

```json
{
  "subject": "Strap issue on plate carrier",
  "message": "...",
  "productTitle": "Agilite Plate Carrier",
  "customerArchetype": "loyal_advocate",
  "refundIntent": "low",
  "sentiment": "neutral",
  "targetProductId": "optional — omit for auto AI selection"
}
```

---

## Security

### Password hashing

Passwords are hashed with **bcrypt** at cost factor 12. bcrypt embeds a unique random salt per hash — no two hashes are identical even for the same password. Raw passwords are never stored or logged.

```ts
const hash = await bcrypt.hash(password, 12);
await bcrypt.compare(plaintext, hash); // salt extracted automatically
```

### JWT authentication

- Tokens are signed with `HS256` using `JWT_SECRET`, expire after **7 days**
- All `/api/admin/*` routes require `Authorization: Bearer <token>`
- Agent creation / deletion / resend-invite additionally require the `admin` role
- On 401, the client clears the stored token and redirects to `/admin/login`

### NoSQL injection prevention

- The login endpoint validates `typeof email === 'string'` and `typeof password === 'string'` before any database query — prevents MongoDB operator injection (`{ "$gt": "" }` style attacks)
- All `findById` and `findByIdAndUpdate` calls are gated behind `isValidObjectId()` checks
- Mongoose casts query filter values to their declared schema types — operator objects in query strings are coerced to strings and find nothing

### XSS

React escapes all rendered content by default. There is no `dangerouslySetInnerHTML` in the codebase.

### Other

- Passwords must be ≥ 8 characters (enforced client-side and server-side)
- The AI Agent (`ai-agent@agilite.internal`) has a non-loginable password hash and cannot be deleted via the API
- `JWT_SECRET` falls back to `'dev-secret'` if unset — **always override in production**
- API keys for AI, R2, and Mailgun are never exposed to the frontend

---

## MongoDB Atlas Setup

### 1. Create a cluster

1. Sign in at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Build a Database** → **M0 Free**
3. Choose a region close to your users

### 2. Create a database user

1. **Database Access** → **Add New Database User**
2. Choose **Password** auth, assign `readWriteAnyDatabase`

### 3. Allow network access

1. **Network Access** → **Add IP Address**
2. Development: **Allow Access from Anywhere** (`0.0.0.0/0`)
3. Production: add your Render service's outbound IP

### 4. Get the connection string

**Connect** → **Drivers** → Node.js:

```
mongodb+srv://user:password@cluster.xxxxx.mongodb.net/projectagilite?retryWrites=true&w=majority
```

Paste as `MONGODB_URI` in `.env`. Mongoose creates collections automatically on first write.

---

## Render Deployment

> **`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec)** — it is specific to [Render](https://render.com) and will not work on other platforms as-is. If you deploy elsewhere, see [Deploying on Other Platforms](#deploying-on-other-platforms) below.

### Blueprint (recommended) — one-click deploy

The `render.yaml` at the repo root describes both services and all environment variable wiring. Render reads it automatically when you connect the repo.

**Steps:**

1. Push the repo to GitHub or GitLab (the file must be at the root).
2. In the Render dashboard → **New** → **Blueprint** → select this repository.
3. Render detects `render.yaml` and shows a preview of the two services it will create:
   - `agilite-api` — Express API (Node web service)
   - `agilite-client` — React SPA (static site)
4. Fill in every variable marked **"sync: false"** before clicking **Apply**:

| Variable | Where to find it |
| -------- | ---------------- |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `MAILGUN_DOMAIN` | Mailgun → Sending → Domains |
| `MAILGUN_API_KEY` | Mailgun → Account → API Keys |
| `MAILGUN_FROM_EMAIL` | Your verified sender address |
| `S3_ENDPOINT` | Cloudflare R2 → Manage API Tokens |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 → Manage API Tokens |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 → Manage API Tokens |
| `S3_PUBLIC_BASE_URL` | R2 bucket public URL (optional) |
| `PYDANTIC_GATEWAY_BASE_URL` | Your AI gateway URL |
| `PYDANTIC_GATEWAY_API_KEY` | Your AI gateway API key |
| `LOGFIRE_TOKEN` | Logfire dashboard (optional, leave blank to disable) |

5. Click **Apply**. Render deploys both services and automatically:
   - Generates a secure `JWT_SECRET`
   - Wires `VITE_API_URL` to point at the API's URL (appending `/api`) at build time
   - Wires `CLIENT_URL` and `APP_URL` on the API to the static site's URL (for CORS and email links)

**Inter-service URL wiring explained:**

The client build needs the API's public URL so Vite can embed it at compile time. The `render.yaml` handles this via `fromService`:

```yaml
# client buildCommand:
buildCommand: npm install && VITE_API_URL="${VITE_API_BASE_URL}/api" npm run build

# VITE_API_BASE_URL is populated from the API service's RENDER_EXTERNAL_URL:
- key: VITE_API_BASE_URL
  fromService:
    type: web
    name: agilite-api
    envVarKey: RENDER_EXTERNAL_URL
```

Render pre-assigns URLs by service name before deploying, so there is no chicken-and-egg problem.

### Manual deployment (Render dashboard without Blueprint)

If you prefer to configure services by hand in the Render dashboard:

**API — Web Service**

| Setting | Value |
| ------- | ----- |
| Root directory | `server` |
| Runtime | Node |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

Set environment variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (frontend URL), `APP_URL` (frontend URL), and all Mailgun / R2 / AI Gateway vars.

**Frontend — Static Site**

| Setting | Value |
| ------- | ----- |
| Root directory | `client` |
| Build command | `npm install && npm run build` |
| Publish directory | `dist` |

Set `VITE_API_URL=https://your-api-name.onrender.com/api`.

Add a rewrite rule: `/*` → `/index.html` (type: **Rewrite**) for React Router.

---

## Docker

The repo includes Dockerfiles for both services and a `docker-compose.yml` for running the full stack locally in production mode. The setup is platform-agnostic — it runs on any machine with Docker installed and is the recommended way to test a production build before pushing to a host.

### Files added

| File | Purpose |
| ---- | ------- |
| `server/Dockerfile` | Two-stage build: compile TypeScript → minimal Node runtime image |
| `client/Dockerfile` | Two-stage build: Vite bundle → nginx static server |
| `client/nginx.conf` | SPA fallback (`try_files`), asset caching, security headers |
| `docker-compose.yml` | Orchestrates both containers, wires env vars, health-checks the API before starting the client |

### How it differs from `render.yaml`

Both describe the same two services with the same build commands. The key difference is what each platform handles for you:

| | `render.yaml` | Docker / Compose |
| - | ------------- | ---------------- |
| Serving static files | Render built-in | nginx in `client/Dockerfile` |
| SPA routing | `routes:` block | `nginx.conf` `try_files` |
| Cache headers | `headers:` block | `nginx.conf` `add_header` |
| `VITE_API_URL` wiring | `fromService` (automatic) | `--build-arg` (manual) |
| `JWT_SECRET` generation | `generateValue: true` | `openssl rand -hex 32` |
| Inter-service networking | Render manages | Docker network (Compose) |

### Quick start

```bash
# 1. Copy and fill in the root .env (same variables as the server .env.example)
cp server/.env.example .env

# 2. Build and start both containers
docker compose up --build

# 3. Seed the database (first run only — while containers are running)
docker compose exec api node dist/scripts/seed-agent.js
```

| URL | Service |
| --- | ------- |
| `http://localhost:3000` | Customer portal |
| `http://localhost:3000/admin` | Agent workspace |
| `http://localhost:5050` | API |
| `http://localhost:5050/health` | API health check |

### The `VITE_API_URL` build-arg caveat

Vite embeds `VITE_API_URL` into the JavaScript bundle **at build time**. The docker-compose default is `http://localhost:5050/api`, which works because the API port is mapped to the host and the browser can reach it directly.

For a remote server (VPS, Fly.io, etc.), you must pass the public API URL when building the client image:

```bash
# Option A — via docker compose (override in .env or inline)
VITE_API_URL=https://api.yourdomain.com/api docker compose up --build

# Option B — build the client image directly
docker build \
  --build-arg VITE_API_URL=https://api.yourdomain.com/api \
  -t agilite-client \
  ./client
```

If the URL changes (e.g. you move the API to a new host), you must rebuild the client image. This is an inherent property of Vite's static build — not specific to Docker.

### Building images for production

```bash
# API image
docker build -t agilite-api ./server

# Client image (replace with your actual API URL)
docker build \
  --build-arg VITE_API_URL=https://api.yourdomain.com/api \
  -t agilite-client \
  ./client
```

Push to any container registry (Docker Hub, GHCR, ECR) and deploy to any host that runs Docker.

---

## Deploying on Other Platforms

`render.yaml` is **Render-specific**. The concepts map to other platforms as follows:

### What each service becomes

| Service | Type | Equivalent on other platforms |
| ------- | ---- | ----------------------------- |
| `agilite-api` | Node web process | Railway service, Fly.io app, Heroku dyno, EC2/VPS |
| `agilite-client` | Static site | Vercel, Netlify, Cloudflare Pages, S3 + CloudFront |

### Platform-specific notes

**Railway**

Railway has its own `railway.toml` format. Create two services from the same repo, set `rootDirectory` to `server` and `client` respectively, and add the same environment variables manually. Railway does not auto-wire inter-service URLs — copy the API service's public URL and paste it as `VITE_API_URL` on the client service.

**Vercel + Railway (common split)**

Host the static site on Vercel (automatic Vite support, zero config) and the API on Railway. In Vercel set `VITE_API_URL` to your Railway API URL + `/api`. The SPA rewrite (`/*` → `/index.html`) is automatic on Vercel.

**Fly.io**

Each service needs its own `fly.toml`. The API deploys as a standard Node app (`fly launch` from `server/`). The static site can be served via an nginx Dockerfile (`fly launch` from `client/` after building). Secrets are set with `fly secrets set KEY=value`.

**VPS / Docker**

Build both services:

```bash
# API
cd server && npm install && npm run build
NODE_ENV=production node dist/index.js

# Client — build once, serve statically
cd client && npm install && VITE_API_URL=https://your-api/api npm run build
# Serve dist/ with nginx, Caddy, or `npx serve`
```

Any static file server can host `client/dist/`. The only requirement is that it serves `index.html` for all routes that don't match a real file (SPA fallback).

### Environment variables — platform-agnostic list

Regardless of where you deploy, the API needs:

```
NODE_ENV=production
MONGODB_URI=
JWT_SECRET=                   # min 32 random bytes
CLIENT_URL=                   # frontend origin, for CORS
APP_URL=                      # frontend origin, for email links
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM_EMAIL=
MAILGUN_BASE_URL=https://api.mailgun.net/v3
S3_ENDPOINT=
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=           # optional
PYDANTIC_GATEWAY_BASE_URL=
PYDANTIC_GATEWAY_API_KEY=
PYDANTIC_GATEWAY_MODEL=gpt-4o-mini
LOGFIRE_TOKEN=                # optional
```

And the client build needs:

```
VITE_API_URL=https://your-api-host/api
```

---

## API Reference

All endpoints prefixed with `/api`. Admin routes require `Authorization: Bearer <token>`.

### Customer-facing

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/tickets` | List tickets (paginated) |
| `GET` | `/tickets/:id` | Get ticket with reply thread |
| `POST` | `/tickets` | Create ticket |
| `POST` | `/tickets/:id/replies` | Add customer reply |
| `PATCH` | `/tickets/:id/close` | Close ticket |
| `GET` | `/products` | Product catalog (external) |

### Admin — Tickets

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/tickets` | Paginated ticket list with filters |
| `GET` | `/admin/tickets/:id` | Ticket detail with product + notes |
| `PATCH` | `/admin/tickets/:id/status` | Update status (`new` / `in_progress` / `resolved`) |
| `PATCH` | `/admin/tickets/:id/priority` | Update priority (`low` / `medium` / `high` / `irrelevant`) |
| `PATCH` | `/admin/tickets/:id/assign` | Assign to agent (or `null` to unassign) |
| `POST` | `/admin/tickets/:id/notes` | Add internal note |
| `POST` | `/admin/tickets/:id/reply` | Send agent reply |

### Admin — Agents (admin role required for write operations)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/agents` | List all agents |
| `POST` | `/admin/agents` | Create agent (sends welcome email) |
| `DELETE` | `/admin/agents/:id` | Remove agent |
| `POST` | `/admin/agents/:id/resend-invite` | Reset password + resend welcome email |
| `GET` | `/admin/agents/:id/activity` | Agent stats, assigned tickets, recent replies |

### Admin — Other

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/stats` | Ticket counts by status + unassigned count |
| `GET` | `/admin/tags` | Distinct AI-generated tags |
| `GET` | `/admin/products` | Active product catalog with signed image URLs |
| `GET` | `/admin/settings` | App settings (auto-reply toggle) |
| `PATCH` | `/admin/settings` | Update app settings |

### AI

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `POST` | `/api/ai/ask` | None | Customer pre-ticket assistant |
| `POST` | `/api/ai/triage-ticket` | Agent | Triage ticket — summary, priority, tags |
| `POST` | `/api/ai/suggest-reply` | Agent | Suggested reply with eligibility scoring |
| `POST` | `/api/ai/customer-profile` | Agent | Customer archetype, refund risk, churn risk |
| `POST` | `/api/ai/remarket` | Agent | Cross-sell product recommendation + pitch |

---

## Scripts

### Root

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start API + frontend together |
| `npm run dev:server` | Start API only |
| `npm run dev:client` | Start frontend only |
| `npm run build` | Build server + client in sequence |

### Server

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Hot-reload with `ts-node-dev` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled build |
| `npm run seed` | Create first admin account |
| `npm run seed:products` | Seed product catalog to MongoDB |
| `npm run seed:images` | Upload product images to R2 |

### Client

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Vite dev server with HMR on port 3000 |
| `npm run build` | Type-check + bundle to `dist/` |
| `npm run preview` | Serve production build locally |
