# Build & Launch Guide — Agilate

This guide covers everything needed to install, configure, and run the project locally from scratch.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 or higher |
| npm | bundled with Node |
| MongoDB | Atlas cluster or local instance |
| Cloudflare R2 | bucket + API keys |
| Pydantic AI Gateway | account + API key (AI features only) |
| Mailgun | domain + API key (email notifications only) |

---

## 1. Install Dependencies

Run from the **project root**:

```bash
npm install                   # root (concurrently)
npm --prefix server install   # Express backend
npm --prefix client install   # React frontend
```

---

## 2. Environment Variables

### Server — `server/.env`

Copy the example and fill in your values:

```bash
cp server/.env.example server/.env
```

```env
PORT=5050
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/?appName=MyApp
JWT_SECRET=change_me_to_a_long_random_string

# Cloudflare R2
S3_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com/<bucket>
S3_REGION=auto
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev

# Pydantic AI Gateway (required for all AI features)
PYDANTIC_GATEWAY_BASE_URL=https://your-gateway-url
PYDANTIC_GATEWAY_API_KEY=your-api-key
PYDANTIC_ANTHROPIC_MODEL=claude-sonnet-4-6

# Mailgun (required for ticket email notifications)
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=mail.yourdomain.com
MAILGUN_FROM_EMAIL=Agilate Support <no-reply@yourdomain.com>

# Optional: Pydantic Logfire tracing
LOGFIRE_TOKEN=your-logfire-token
```

### Client — `client/.env`

```bash
cp client/.env.example client/.env
```

```env
VITE_API_URL=http://localhost:5050/api
```

> Make sure `VITE_API_URL` port matches `PORT` in `server/.env`.

---

## 3. Seed the First Admin Agent

Before logging in for the first time, create the initial admin account:

```bash
npm --prefix server run seed
```

This creates an admin with default credentials:

| Field | Default |
|---|---|
| Email | `admin@agilate.com` |
| Password | `Admin1234!` |
| Name | `Admin` |

Override defaults by setting these in `server/.env` before running:

```env
SEED_EMAIL=you@yourdomain.com
SEED_PASSWORD=YourStrongPassword
SEED_NAME=Your Name
```

---

## 4. Run Locally

### Both server and client together (recommended)

```bash
npm run dev
```

Output is color-coded: **yellow** = server, **cyan** = client.

### Separately

```bash
npm run dev:server   # Express API on http://localhost:5050
npm run dev:client   # Vite UI on http://localhost:5173
```

---

## 5. Key URLs

| URL | Description |
|---|---|
| `http://localhost:5173` | Storefront & customer-facing pages |
| `http://localhost:5173/admin` | Admin workspace (requires login) |
| `http://localhost:5050/api` | REST API base |

---

## 6. What Requires External Services

| Feature | Required service |
|---|---|
| Ticket image attachments | Cloudflare R2 |
| Product images | Cloudflare R2 |
| Email on ticket creation | Mailgun |
| All AI features (triage, coach, remarketing, insights…) | Pydantic AI Gateway |

The app starts and is usable without these — missing config causes those specific features to fail gracefully.
