# CI/CD Pipeline Monitoring & Analytics Dashboard

A production-grade, full-stack CI/CD observability platform that provides centralized visibility, step-by-step pipeline visualization, deployment tracking, and real-time webhook telemetry across multiple GitHub repositories.

---

## Architecture Overview

```mermaid
graph TD
    subgraph Browser ["Next.js App Router (Port 3000)"]
        UI["Dashboard & Analytics"]
        Pulse["Live Activity Feed (SSE)"]
        Viz["Step-by-Step Pipeline Viz"]
    end

    subgraph Backend ["Node.js / Express 5 API (Port 4000)"]
        Auth["JWT Auth (httpOnly cookie)"]
        Sync["GitHub API Sync Engine"]
        Webhook["Webhook Ingress (HMAC SHA-256)"]
        Bus["Event Bus (SSE Publisher)"]
    end

    subgraph Storage ["PostgreSQL 16 via Prisma ORM"]
        DB[("Projects / Runs / Jobs / Deployments")]
    end

    subgraph GitHub ["GitHub Infrastructure"]
        GH_API["GitHub Actions REST API"]
        GH_Hook["GitHub Webhooks (workflow_run / workflow_job)"]
        GH_CI["Self-Monitoring CI Pipeline (.github/workflows/ci.yml)"]
    end

    UI -->|REST API with Session Cookie| Auth
    Pulse <-->|SSE Stream text/event-stream| Bus
    Auth --> Sync
    Sync -->|Encrypted PAT (AES-256-GCM)| GH_API
    GH_Hook -->|POST /api/webhooks/github| Webhook
    Webhook --> Bus
    Webhook --> DB
    Sync --> DB
    GH_CI -.->|Telemetry Dogfooding| Webhook
```

```
Browser (Next.js :3000)
    │  ▲  (JWT httpOnly cookie + Server-Sent Events stream)
    ▼  │
Express API (:4000)  ────► GitHub Actions API (Tokens AES-256-GCM encrypted at rest)
    ▲                ◄──── GitHub Webhooks (HMAC SHA-256 verified)
    │
PostgreSQL (Prisma)
```

---

## Phased Implementation Roadmap

- **PHASE 1 — Data Layer + GitHub Integration (Done)**: Prisma models (`User`, `Project`, `PipelineRun`, `PipelineJob`, `PipelineStep`, `Deployment`), AES-256-GCM encrypted token persistence, GitHub REST API client (`/actions/runs`, `/jobs`), and multi-tier sync engine.
- **PHASE 2 — Core Dashboard UI (Done)**: JWT cookie authentication (`/login`), `/dashboard` high-level summary cards + recent runs, project build history (`/projects/[id]`), and step-level pipeline visualization (`/projects/[id]/runs/[runId]`) highlighting exact failure points.
- **PHASE 3 — Deployments + Analytics (Done)**: Automated deployment detection, `GET /api/metrics/:projectId` aggregating 14-day rolling windows, and responsive Recharts visualizations (build volume, duration trend, deployment frequency).
- **PHASE 4 — Webhooks & Real-Time Telemetry (Done)**: GitHub webhook endpoint (`POST /api/webhooks/github`) supporting `workflow_run` and `workflow_job` events with HMAC SHA-256 signature verification, Server-Sent Events (SSE) stream (`GET /api/events`), real-time `ActivityFeed` with live pulse indicators, and instant event simulation.
- **PHASE 5 — Dockerize + Dogfooding (Done)**: Complete 3-tier `docker-compose.yml` (`postgres`, `backend`, `frontend`), production `Dockerfile` for frontend & backend, automated backend test suite (`node:test`), and a complete GitHub Actions CI pipeline (`.github/workflows/ci.yml`) so the dashboard monitors its own repository.
- **PHASE 6 — Polish (Done)**: GitHub API rate-limit tracking and `/rate-limit` inspection, realistic multi-project seed data, glassmorphic dark theme with ambient glow, and comprehensive documentation.

---

## Prerequisites

- **Node.js**: v22+
- **pnpm**: v10+
- **PostgreSQL**: v16+ (local service or Docker)
- *(Optional)* **Docker & Docker Compose** for containerized deployment
- *(Optional)* **ngrok** for local GitHub webhook testing

---

## Local Development Setup

### 1. Clone & Configure Environment

```bash
cp .env.example .env
```

Set `DATABASE_URL` to your local PostgreSQL connection string and create fresh secrets. Do not reuse the placeholders from documentation:

```env
PORT=4000
GITHUB_API_BASE="https://api.github.com"
FRONTEND_ORIGIN="http://localhost:3000"
NODE_ENV="development"
TRUST_PROXY="0"
```

Generate `ENCRYPTION_KEY` with `openssl rand -hex 32`. Generate `JWT_SECRET` and `WEBHOOK_SECRET` with `openssl rand -hex 32` as well; keep all three private. `ENCRYPTION_KEY` must be exactly 64 hexadecimal characters. Set `POSTGRES_PASSWORD` to a URL-safe value and configure `DATABASE_URL` with the same password.

### 2. Install Dependencies & Seed Database

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

### 3. Run Development Server

```bash
pnpm dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Demo Credentials**: `demo@local.test` / `changeme`

---

## Full-Stack Docker Compose Deployment

Configure `POSTGRES_PASSWORD`, `ENCRYPTION_KEY`, `JWT_SECRET`, `WEBHOOK_SECRET`, `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL`, and `NODE_ENV` in `.env` before starting the stack. Set `NODE_ENV=development` for local HTTP use. For production, use `NODE_ENV=production`, HTTPS origins/API URLs, same-site frontend and API hosts (the session cookie uses `SameSite=Lax`), and terminate TLS at a trusted reverse proxy. Set `TRUST_PROXY=1` only when exactly one trusted proxy sits in front of the backend, and prevent direct public access to the backend port so clients cannot spoof forwarded headers; otherwise leave it at `0`. Secret values are required and are never provided as Compose defaults.

Run the complete 3-service stack (`postgres`, `backend`, `frontend`) with one command:

```bash
docker compose up --build
```

Access the dashboard at `http://localhost:3000`.

---

## Running Automated Backend Tests

The test suite runs with Node's native test runner (`node:test`) and covers authentication, session cookies, dashboard metrics, webhook ingestion, HMAC validation, and live event dispatching:

```bash
pnpm test
```

---

## GitHub Webhook Integration & ngrok Setup

The dashboard ingests live GitHub Actions events without polling.

### 1. Start Local ngrok Tunnel

To expose your local backend to GitHub webhooks:

```bash
ngrok http 4000
```

Copy your HTTPS forwarding URL (e.g., `https://abc-123.ngrok-free.app`).

### 2. Configure Webhook in GitHub

1. Open your repository on GitHub -> **Settings** -> **Webhooks** -> **Add webhook**.
2. **Payload URL**:
   ```
   https://abc-123.ngrok-free.app/api/webhooks/github/<project_id>
   ```
3. **Content type**: `application/json`.
4. **Secret**: Click **Webhook Setup** on your project page in the dashboard to view/generate your HMAC secret, and paste it into GitHub.
5. **Events**: Select **Let me select individual events**, then check:
   - `Workflow runs`
   - `Workflow jobs`
6. Click **Add webhook**. GitHub will immediately ping the backend and real-time events will stream into your dashboard!

> **Quick Testing**: You can also click the **"Test Event"** button on the Live Activity Feed in the dashboard to simulate real-time telemetry instantly.

---

## API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Service health status | No |
| `POST` | `/api/auth/register` | User registration (sets httpOnly cookie) | No |
| `POST` | `/api/auth/login` | User login (sets httpOnly cookie) | No |
| `POST` | `/api/auth/logout` | Clears session cookie | Yes |
| `GET` | `/api/auth/me` | Current authenticated user | Yes |
| `GET` | `/api/dashboard` | Aggregated metrics & recent pipeline runs | Yes |
| `POST` | `/api/projects` | Register new GitHub project (`githubToken` encrypted) | Yes |
| `GET` | `/api/projects` | List owned projects | Yes |
| `GET` | `/api/projects/:id` | Project metadata | Yes |
| `POST` | `/api/projects/:id/sync` | Manual GitHub Actions API sync | Yes |
| `GET` | `/api/projects/:id/runs` | Stored pipeline runs | Yes |
| `GET` | `/api/projects/:id/runs/:runId` | Run details with jobs and steps | Yes |
| `GET` | `/api/projects/:id/deployments` | Recorded deployments | Yes |
| `POST` | `/api/projects/:id/webhook-secret` | Generate / rotate project webhook HMAC secret | Yes |
| `GET` | `/api/projects/:id/rate-limit` | Inspect GitHub API rate limit quota | Yes |
| `GET` | `/api/metrics/:projectId` | 14-day aggregated success rate & durations | Yes |
| `POST` | `/api/webhooks/github` | GitHub webhook ingress (HMAC SHA-256 verified) | No (HMAC) |
| `GET` | `/api/events` | Server-Sent Events (SSE) real-time stream | Yes |
| `GET` | `/api/events/recent` | Recent telemetry events replay | Yes |
| `POST` | `/api/projects/:id/test-event` | Broadcast simulated telemetry event & pipeline run | Yes |

---

## Dogfooding: Self-Monitoring Pipeline

This repository contains its own GitHub Actions CI workflow in `.github/workflows/ci.yml`.

When you connect this repository to the dashboard:
1. Every commit pushed to GitHub triggers tests, build, and Docker image validation. This workflow does not deploy the application.
2. GitHub webhooks stream progress directly into the dashboard.
3. You can watch the dashboard monitor its own workflow in real time!

---

## Railway Production Deployment Guide

Deploying this pnpm monorepo to [Railway](https://railway.com/) requires three services inside one Railway Project:
1. **PostgreSQL Database** (managed Railway plugin)
2. **Backend Service** (Express 5 + Prisma ORM)
3. **Frontend Service** (Next.js 15 App Router)

### Monorepo Build Context (Important)

In a pnpm workspace monorepo, Docker builds require access to the root lockfile (`pnpm-lock.yaml`), `pnpm-workspace.yaml`, and `package.json` to properly resolve workspace dependencies.

For **BOTH** backend and frontend services on Railway:
- **Root Directory**: `/` (leave as repository root; do **NOT** set to `apps/backend` or `apps/frontend`)
- **Build Method**: Dockerfile
- **Dockerfile Path**:
  - Backend: `apps/backend/Dockerfile`
  - Frontend: `apps/frontend/Dockerfile`

---

### Deployment Step-by-Step Order

#### Step 1: Create a Railway Project & Add PostgreSQL

1. Open [Railway Dashboard](https://railway.com/dashboard) and click **New Project**.
2. Select **Provision PostgreSQL**.
3. Railway provisions a PostgreSQL 16 database. Once ready, click on the PostgreSQL card, go to the **Connect** tab, and copy the `DATABASE_URL` (or reference `${{Postgres.DATABASE_URL}}` in service variables).

#### Step 2: Deploy the Backend Service

1. In the same project, click **Create** -> **GitHub Repo** -> select your repository.
2. Go to **Settings**:
   - **Service Name**: `cicd-backend` (or similar)
   - **Root Directory**: `/`
   - **Dockerfile Path**: `apps/backend/Dockerfile`
   - **Healthcheck Path**: `/health` (checks DB connectivity with `SELECT 1`)
3. Go to **Variables** and configure all required backend environment variables:

| Variable | Recommended Value / How to Obtain | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables strict secret checks and secure cookies |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway internal database reference or connection string |
| `ENCRYPTION_KEY` | Generate via `openssl rand -hex 32` | 64-character hexadecimal key (AES-256-GCM token encryption) |
| `JWT_SECRET` | Generate via `openssl rand -hex 32` | 64-character hex key (minimum 32 characters, non-placeholder) |
| `WEBHOOK_SECRET` | Generate via `openssl rand -hex 32` | HMAC SHA-256 fallback secret (minimum 32 characters) |
| `TRUST_PROXY` | `1` | Required for Railway reverse proxy IP forwarding and rate limits |
| `COOKIE_SAME_SITE` | `none` | Required for cross-site cookies between Railway subdomains |
| `FRONTEND_ORIGIN` | `https://placeholder.up.railway.app` | Temporarily set to placeholder; update in Step 4 |
| `GITHUB_API_BASE` | `https://api.github.com` | Standard GitHub Actions API endpoint |

4. Go to **Settings** -> **Networking** -> click **Generate Domain** to assign a public URL (e.g. `https://cicd-backend-production.up.railway.app`).
5. The backend container automatically executes `pnpm exec prisma migrate deploy` upon startup before launching `node src/index.js`.
6. Verify startup: Open `https://<backend-url>/health`. It should return `{"ok":true,"service":"cicd-dashboard-backend","database":"connected"}`.

#### Step 3: Deploy the Frontend Service

1. In the same Railway project, click **Create** -> **GitHub Repo** -> select the same repository.
2. Go to **Settings**:
   - **Service Name**: `cicd-frontend` (or similar)
   - **Root Directory**: `/`
   - **Dockerfile Path**: `apps/frontend/Dockerfile`
3. Go to **Variables** and configure:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Production mode |
| `NEXT_PUBLIC_API_URL` | `https://<backend-domain>.up.railway.app` | **Must be your backend public URL without trailing slash** (baked into Next.js bundle) |

4. Go to **Settings** -> **Networking** -> click **Generate Domain** to assign a public URL (e.g. `https://cicd-frontend-production.up.railway.app`).
5. Trigger build and wait for deployment to complete.

#### Step 4: Interconnect Frontend and Backend

1. Return to the **Backend Service** -> **Variables**.
2. Update `FRONTEND_ORIGIN` to the exact public URL of your frontend (e.g. `https://cicd-frontend-production.up.railway.app` with no trailing slash).
3. Railway will automatically redeploy the backend with the updated CORS origin.

---

### Deployment Smoke-Test Checklist

Once all three services are active:

- [ ] **Database Connectivity**: Access `https://<backend-domain>/health` and ensure HTTP 200 with `"database": "connected"`.
- [ ] **Frontend Loading**: Access `https://<frontend-domain>/login` and ensure the styled authentication screen renders cleanly.
- [ ] **Account Creation / Login**: Register a new user account (e.g. `admin@yourdomain.com`). Ensure you are automatically authenticated and redirected to `/dashboard`.
- [ ] **Session Persistence**: Refresh the `/dashboard` page. Verify that session cookies persist across reloads.
- [ ] **Project Registration**: Add a GitHub repository with an encrypted Personal Access Token (PAT with `repo` or `actions:read` scope).
- [ ] **GitHub Sync**: Trigger manual sync on the project details page (`/projects/[id]`). Verify workflow runs and jobs populate the UI.
- [ ] **Live Telemetry & SSE**: Click the **⚡ Test Event** button on the Live Activity Feed. Verify the synthetic run immediately appears with real-time status pulses.
- [ ] **Webhook Ingress**: Copy the project Webhook URL (`https://<backend-domain>/api/webhooks/github/<project_id>`) and HMAC Secret into GitHub Webhooks. Confirm that a ping event returns `200 pong`.
