# Agilate — Tactical Gear Support Platform

A full-stack customer support platform built for a tactical gear store. It includes a public-facing storefront, a ticket support system, and a rich admin workspace with AI-powered tools.

---

## Features

### Storefront
- Product catalog with category filtering and search
- Product detail pages with image gallery
- AI-powered product finder chat widget
- Seasonal themes with animated decorations (Pesach, Purim, Hanukkah, Black Friday, and more)
- Hebrew / English language toggle
- Dark / light mode

### Support Tickets
- Customers can submit tickets linked to a product
- Image attachments (up to 5 per ticket, stored on Cloudflare R2)
- Ticket lookup page — customers can track their ticket status and read replies
- Email notification sent to the customer on ticket creation

### Admin Workspace
- **Ticket queue** — filter by status, priority, agent, and tag; sort by date, priority, product value, and marketing signals
- **Ticket detail** — full reply thread, internal notes, status/priority management, agent assignment
- **AI Triage** — automatic priority detection, summary, and tags on ticket creation
- **AI Reply Suggestions** — suggest a reply with optional goal (apologize, upsell, close, etc.)
- **Customer Profiling** — archetype detection, churn risk, refund intent, lifetime value signal
- **AI Remarketing** — generate targeted product pitches based on customer profile
- **AI Coach** — conversational assistant to help agents handle difficult tickets
- **Agent Messaging** — internal chat between agents, with AI agent support and typing indicators
- **Platform Insights** — AI-generated store-wide analysis with snapshot history and period comparison
- **Agent Management** — create agents, invite by email, manage roles and avatars
- **Settings** — seasonal theme management for the storefront and admin UI independently

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing | React Router v6 |
| Backend | Node.js, Express 4, TypeScript |
| Database | MongoDB with Mongoose |
| AI | AWS Bedrock via Pydantic AI Gateway |
| Storage | Cloudflare R2 (S3-compatible) |
| Email | Mailgun |
| Auth | JWT (Bearer token) |
| Deployment | Render |

---

## Project Structure

```
projectAgilite/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/      # Shared and admin components
│       │   └── admin/
│       │       └── ticket/  # Ticket sub-components (bubbles, panels, modals)
│       ├── pages/           # Route-level pages
│       ├── services/        # API clients (api.ts, adminApi.ts)
│       ├── themes/          # Seasonal theme definitions
│       ├── types/           # TypeScript interfaces
│       ├── utils/           # Shared utilities (formatting, etc.)
│       └── i18n/            # Translations (EN / HE)
│
└── server/                  # Express backend
    └── src/
        ├── controllers/     # Route handlers
        ├── middlewares/     # Auth, error handling
        ├── models/          # Mongoose schemas
        ├── routes/          # Express routers
        ├── services/        # AI, email, storage logic
        └── types/           # Shared TypeScript types
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance (local or Atlas)
- Cloudflare R2 bucket
- Mailgun account
- Pydantic AI Gateway access (for AI features)

### Installation

```bash
# Install all dependencies
npm install
npm --prefix client install
npm --prefix server install
```

### Environment Variables

Create `server/.env`:

```env
# Server
PORT=3001
MONGODB_URI=mongodb://localhost:27017/agilate
JWT_SECRET=your-secret-here

# Cloudflare R2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com/<bucket>
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_PUBLIC_BASE_URL=https://your-public-r2-domain.com

# Mailgun
MAILGUN_API_KEY=your-key
MAILGUN_DOMAIN=mail.yourdomain.com
MAILGUN_FROM_EMAIL=support@yourdomain.com

# AI Gateway
PYDANTIC_AI_GATEWAY_URL=https://your-gateway-url
PYDANTIC_AI_GATEWAY_API_KEY=your-key
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### Running Locally

```bash
# Run both server and client together
npm run dev

# Or separately
npm run dev:server
npm run dev:client
```

The client runs on `http://localhost:5173` and the server on `http://localhost:3001`.

---

## Key Concepts

**Seasonal Themes** — The storefront and admin UI both support seasonal themes. The active theme is stored in the database and can be changed from the admin settings panel. Each theme defines a color palette, banner gradient, and animated particle decorations.

**AI Integration** — All AI features go through the Pydantic AI Gateway, which proxies requests to AWS Bedrock (Claude). Triage runs automatically when a ticket is created. All other AI features — reply suggestions, customer profiling, coach, insights — are triggered manually by the agent.

**Image Storage** — Ticket attachments are uploaded via a server-side proxy to Cloudflare R2, avoiding CORS issues with direct browser uploads. Product images are served through a public base URL configured on the R2 bucket.

**Agent Messaging** — Agents can chat with each other or with the AI agent. The AI agent auto-replies using the ticket and product context. A typing indicator appears while waiting for the AI response.
