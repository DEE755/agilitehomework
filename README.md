# ProjectAgilite — Support Portal

A full-stack customer support ticketing platform built for a tactical gear brand. Customers can browse products, open support tickets, reply to threads, and track resolution status through a polished dark UI.

---

## Table of Contents

1. [Overview](#overview)
2. [Stack](#stack)
3. [Project Structure](#project-structure)
4. [Local Setup](#local-setup)
5. [Environment Variables](#environment-variables)
6. [Admin & Agents](#admin--agents)
7. [Security](#security)
8. [MongoDB Atlas Setup](#mongodb-atlas-setup)
9. [Render Deployment](#render-deployment)
10. [API Reference](#api-reference)
11. [Scripts](#scripts)

---

## Overview

**ProjectAgilite** is a monorepo containing:

- A **React + Vite** frontend with a dark tactical design system (olive / sand / graphite palette)
- An **Express + TypeScript** REST API with request validation and structured error handling
- A **MongoDB Atlas** database via Mongoose with an embedded reply sub-document model

Key features:

- Browse a product catalog and open pre-filled support tickets
- Searchable product picker modal
- Ticket dashboard with status and priority filtering, pagination, and skeleton loading
- Full ticket thread view with timestamped replies and avatar initials
- Close ticket action with conflict guards (no replies on closed tickets)
- Toast notifications for all async actions
- Fully typed end-to-end (TypeScript on both client and server)

---

## Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v3     |
| Routing  | React Router v6                                 |
| Backend  | Node.js, Express 4, TypeScript                  |
| Database | MongoDB Atlas, Mongoose 8                       |
| Dev tool | ts-node-dev (server hot-reload)                 |

---

## Project Structure

```
projectAgilite/
├── client/                        # Vite + React frontend
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── Layout.tsx         # Outlet wrapper + Navbar
│       │   ├── Navbar.tsx         # Sticky header with mobile menu
│       │   ├── TicketCard.tsx     # Dashboard list row
│       │   ├── StatusBadge.tsx    # Open / Closed pill
│       │   ├── PriorityBadge.tsx  # High / Medium / Low pill
│       │   ├── Spinner.tsx        # Animated loading ring
│       │   ├── Skeleton.tsx       # TicketCard + Detail skeletons
│       │   ├── Toast.tsx          # Context-based toast system
│       │   └── ProductPickerModal.tsx  # Searchable product modal
│       ├── data/
│       │   └── products.ts        # Static product catalog
│       ├── pages/
│       │   ├── DashboardPage.tsx  # Ticket list with filters
│       │   ├── CreateTicketPage.tsx
│       │   ├── TicketDetailPage.tsx
│       │   └── ProductsPage.tsx
│       ├── services/
│       │   └── api.ts             # Typed fetch client
│       └── types/
│           └── ticket.ts          # Shared frontend types
│
└── server/                        # Express API
    └── src/
        ├── config/
        │   └── db.ts              # Mongoose connection
        ├── controllers/
        │   └── ticket.controller.ts
        ├── middlewares/
        │   ├── validate.ts        # Schema-based request validation
        │   └── errorHandler.ts    # Global error handler
        ├── models/
        │   └── Ticket.ts          # Mongoose schema + model
        ├── routes/
        │   └── ticket.routes.ts
        └── types/
            └── ticket.types.ts
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- A MongoDB Atlas account (free M0 cluster is sufficient)

### 1. Clone and install

```bash
git clone https://github.com/your-org/projectAgilite.git
cd projectAgilite

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit both files with your values (see [Environment Variables](#environment-variables) below).

### 3. Run in development

From the project root:

```bash
npm install
npm run dev
```

This launches both services together. If you prefer running them separately:

```bash
# API server (port 5050, hot-reload)
cd server && npm run dev

# Vite dev server (port 3000, HMR)
cd client && npm run dev
```

| Service | URL                   |
| ------- | --------------------- |
| UI      | http://localhost:3000 |
| API     | http://localhost:5050 |

The Vite dev server proxies all `/api/*` requests to `localhost:5050`, so no CORS config is needed during development.

---

## Environment Variables

### `server/.env`

| Variable      | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `PORT`        | No       | Port the Express server listens on. Defaults to `5050`.        |
| `MONGODB_URI` | Yes      | Full MongoDB Atlas connection string including database name.   |
| `JWT_SECRET`  | Yes      | Secret used to sign and verify JWT tokens. Must be a long random string in production. |
| `S3_ENDPOINT` | For image uploads | S3-compatible endpoint. Can include the bucket path, e.g. Cloudflare R2. |
| `S3_BUCKET`   | No       | Optional bucket override if not embedded in `S3_ENDPOINT`.     |
| `S3_REGION`   | No       | S3 region. Use `auto` for Cloudflare R2.                       |
| `S3_ACCESS_KEY_ID` | For image uploads | Access key used to sign upload/read URLs.           |
| `S3_SECRET_ACCESS_KEY` | For image uploads | Secret key used to sign upload/read URLs.     |
| `S3_PUBLIC_BASE_URL` | No | Public asset base URL if you serve images publicly instead of signed reads. |
| `MAILGUN_API_KEY` | For email | Mailgun API key (find it in Mailgun dashboard → API Keys). |
| `MAILGUN_DOMAIN` | For email | Sending domain — use sandbox domain for testing, custom subdomain for production. |
| `MAILGUN_FROM_EMAIL` | No | Sender address, e.g. `Agilite Support <no-reply@mail.agilite.com>`. Defaults to `no-reply@{domain}`. |

Example:

```env
PORT=5050
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/projectagilite?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_string
S3_ENDPOINT=https://dea83c0cf76addca198e38a0f93bd8b0.r2.cloudflarestorage.com/agiliteproject
S3_REGION=auto
S3_ACCESS_KEY_ID=replace_with_your_r2_access_key
S3_SECRET_ACCESS_KEY=replace_with_your_r2_secret
```

### `client/.env`

| Variable       | Required | Description                                                     |
| -------------- | -------- | --------------------------------------------------------------- |
| `VITE_API_URL` | No       | Base URL for API calls. Omit in dev (Vite proxy handles it).   |

Example (production only):

```env
VITE_API_URL=https://your-api.onrender.com/api
```

---

## Admin & Agents

### Creating the first admin

There is no self-registration endpoint. Use the seed script to bootstrap the first admin account:

```bash
cd server && npm run seed
```

It reads credentials from `server/.env` (falls back to defaults if unset):

| Variable        | Default           |
| --------------- | ----------------- |
| `SEED_EMAIL`    | `admin@agilite.com` |
| `SEED_PASSWORD` | `Admin1234!`      |
| `SEED_NAME`     | `Admin`           |

The script is idempotent — it skips creation if the email already exists.

### Managing agents

Once logged in as an admin, go to `/admin/agents` to:

- View all agents (including the built-in AI Agent)
- Create new agents with a name, email, password, and role (`agent` or `admin`)
- Remove agents (cannot remove yourself or the AI Agent)

Agents with the `agent` role can view and respond to tickets but cannot create or remove other accounts. Only `admin` role users can manage agents.

### JWT rotation

To invalidate all active sessions (e.g. after a suspected token leak):

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Replace `JWT_SECRET` in your environment
3. Restart the server

All existing JWTs become invalid immediately. Users are redirected to the login page on their next request.

---

## Security

### Password hashing

All passwords are hashed with **bcrypt** at cost factor 12 before being stored. bcrypt automatically generates and embeds a unique random salt per password — no two hashes are the same even for identical passwords. The raw password is never persisted.

```ts
const passwordHash = await bcrypt.hash(password, 12);  // stores salt + hash together
await bcrypt.compare(plaintext, passwordHash);          // salt is extracted automatically
```

### JWT authentication

- Tokens are signed with `HS256` using `JWT_SECRET` and expire after **7 days**
- All `/api/admin/*` routes require a valid `Authorization: Bearer <token>` header
- Agent creation and deletion additionally require the `admin` role (`requireRole('admin')`)
- On 401, the client clears the stored token and redirects to the login page

### NoSQL injection

- The login endpoint validates that `email` and `password` are plain strings before any database query, preventing MongoDB operator injection (`{ "$gt": "" }` style attacks)
- Admin ticket filters receive Mongoose-typed values — Mongoose casts query params to the schema's declared type, so operator objects in query strings are coerced to strings and silently find nothing
- All `findById` / `findByIdAndUpdate` calls are guarded with `isValidObjectId()` before touching the database

### XSS

React escapes all rendered output by default. There is no use of `dangerouslySetInnerHTML` in the codebase.

### Other

- Passwords must be at least 8 characters (enforced on both client and server)
- The AI Agent account (`ai-agent@agilite.internal`) has a non-loginable password hash and cannot be deleted via the API
- `JWT_SECRET` falls back to `'dev-secret'` if unset — **always set a real secret in production**

---

## MongoDB Atlas Setup

### 1. Create a cluster

1. Sign in at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a new project → **Build a Database** → select **M0 Free**
3. Choose a cloud provider and region closest to your users
4. Name your cluster (e.g. `projectagilite`)

### 2. Create a database user

1. In the left sidebar go to **Database Access** → **Add New Database User**
2. Choose **Password** authentication
3. Set a username (e.g. `agiliteuser`) and generate a secure password — copy it now
4. Assign the role **Atlas admin** (or `readWriteAnyDatabase` for tighter scope)
5. Click **Add User**

### 3. Allow network access

1. In the left sidebar go to **Network Access** → **Add IP Address**
2. For development: click **Allow Access from Anywhere** (`0.0.0.0/0`)
3. For production on Render: add your Render service's static outbound IP, or use `0.0.0.0/0` with a strong password

### 4. Get the connection string

1. On your cluster dashboard click **Connect** → **Drivers**
2. Select **Node.js**, version **5.5 or later**
3. Copy the URI — it looks like:

```
mongodb+srv://agiliteuser:<password>@projectagilite.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

4. Replace `<password>` with your actual password
5. Insert the database name before the `?`:

```
mongodb+srv://agiliteuser:yourpassword@projectagilite.xxxxx.mongodb.net/projectagilite?retryWrites=true&w=majority
```

Paste this as `MONGODB_URI` in `server/.env`.

Mongoose will automatically create the `tickets` collection on the first write — no manual schema migration needed.

---

## Render Deployment

Both the API and the frontend are deployed separately on [Render](https://render.com). The free tier is sufficient for both.

### Deploy the API (Web Service)

1. Push your code to GitHub
2. In the Render dashboard → **New** → **Web Service**
3. Connect your GitHub repo
4. Configure the service:

   | Setting          | Value                        |
   | ---------------- | ---------------------------- |
   | **Root directory** | `server`                   |
   | **Runtime**      | Node                         |
   | **Build command** | `npm install && npm run build` |
   | **Start command** | `npm start`                 |

5. Under **Environment Variables**, add:

   ```
   MONGODB_URI   = <your Atlas connection string>
   JWT_SECRET    = <your secret>
   NODE_ENV      = production
   ```

6. Click **Create Web Service**. Render will assign a URL like `https://projectagilite-api.onrender.com`.

### Deploy the Frontend (Static Site)

1. In the Render dashboard → **New** → **Static Site**
2. Connect the same GitHub repo
3. Configure the site:

   | Setting           | Value              |
   | ----------------- | ------------------ |
   | **Root directory** | `client`          |
   | **Build command** | `npm install && npm run build` |
   | **Publish directory** | `dist`        |

4. Under **Environment Variables**, add:

   ```
   VITE_API_URL = https://projectagilite-api.onrender.com/api
   ```

5. Click **Create Static Site**

6. Under **Redirects/Rewrites**, add a rewrite rule so React Router works on hard refresh:

   | Source  | Destination | Action  |
   | ------- | ----------- | ------- |
   | `/*`    | `/index.html` | Rewrite |

### CORS in production

When the frontend and API are on different domains, update the CORS config in `server/src/index.ts` to restrict the allowed origin:

```typescript
app.use(cors({
  origin: process.env.CLIENT_URL ?? '*',
}));
```

Add `CLIENT_URL=https://your-frontend.onrender.com` to the API service's environment variables on Render.

---

## API Reference

All endpoints are prefixed with `/api`.

### Tickets

| Method  | Path                            | Description                               |
| ------- | ------------------------------- | ----------------------------------------- |
| `GET`   | `/tickets`                      | List tickets (paginated, filterable)       |
| `GET`   | `/tickets/:ticketId`            | Get a single ticket with full reply thread |
| `POST`  | `/tickets`                      | Create a new ticket                       |
| `POST`  | `/tickets/:ticketId/replies`    | Add a reply to an open ticket             |
| `PATCH` | `/tickets/:ticketId/close`      | Close a ticket                            |

### Query parameters for `GET /tickets`

| Param      | Type                         | Description                     |
| ---------- | ---------------------------- | ------------------------------- |
| `status`   | `open` \| `closed`           | Filter by ticket status         |
| `priority` | `low` \| `medium` \| `high`  | Filter by priority level        |
| `page`     | number (default `1`)         | Page number                     |
| `limit`    | number (default `20`, max `100`) | Results per page            |

### `POST /tickets` body

```json
{
  "title": "Plate carrier strap fraying after 3 months",
  "description": "The left shoulder strap started fraying at the buckle...",
  "priority": "high",
  "authorName": "John Recon",
  "authorEmail": "john@unit.mil"
}
```

### Error format

```json
{ "error": "Ticket not found" }
{ "errors": ["\"authorEmail\" must be a valid email"] }
```

---

## Scripts

### Root

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start backend and frontend together           |
| `npm run dev:server` | Start only the Express API from the repo root |
| `npm run dev:client` | Start only the Vite frontend from the repo root |
| `npm run build`    | Build server and client in sequence           |

### Server

| Command           | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Start with `ts-node-dev` — hot-reload on file change |
| `npm run build`   | Compile TypeScript to `dist/`                        |
| `npm start`       | Run compiled output (`node dist/index.js`)           |

### Client

| Command           | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Start Vite dev server with HMR on port 3000          |
| `npm run build`   | Type-check and bundle to `dist/`                     |
| `npm run preview` | Serve the production build locally for final checks  |

---

## Potential Improvements

### Notifications
- Email notifications on new reply or status change (Resend or Nodemailer)
- In-app notification bell with unread count

### Dashboard & analytics
- Average response time and first-response SLA tracking
- Agent workload view
- Priority heatmap by product category

### Developer experience
- End-to-end tests with Playwright
- Unit tests for controllers
- GitHub Actions CI pipeline (type-check + test on push)
- Docker Compose for one-command local setup (API + MongoDB)
