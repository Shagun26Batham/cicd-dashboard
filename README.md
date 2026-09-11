# CI/CD Pipeline Monitoring Dashboard

Centralized visibility into GitHub Actions across multiple repositories.

**Phase 1 (current):** data layer + GitHub fetch-and-store. No dashboard UI yet.

## Architecture

```
GitHub Actions API  →  Express backend  →  PostgreSQL (Prisma)
                         (tokens stay on the server)
```

## Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16+ (local service or Docker)

## Setup

```bash
cp .env.example .env
# edit DATABASE_URL if your Postgres user/password differ
pnpm install
pnpm --filter @cicd/backend db:generate
pnpm --filter @cicd/backend exec prisma migrate dev --name init
pnpm dev:backend
```

Create the database first if needed:

```sql
CREATE DATABASE cicd_dashboard;
```

Docker Postgres only (when Docker is available):

```bash
docker compose up -d postgres
```

## Phase 1 API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `POST` | `/api/users` | `{ email, password }` |
| `POST` | `/api/projects` | `{ userId, owner, repo, githubToken, name? }` — token is encrypted at rest and never returned |
| `GET` | `/api/projects` | Lists projects without token fields |
| `GET` | `/api/projects/:id` | Project metadata (no token) |
| `POST` | `/api/projects/:id/sync` | Fetches GitHub Actions runs + jobs/steps and stores them |
| `GET` | `/api/projects/:id/runs` | Stored pipeline runs |
| `GET` | `/api/projects/:id/runs/:runId` | Run with jobs and steps |

Example:

```bash
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"demo@local.test\",\"password\":\"changeme\"}"

curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"USER_ID\",\"owner\":\"OWNER\",\"repo\":\"REPO\",\"githubToken\":\"ghp_...\"}"

curl -X POST http://localhost:4000/api/projects/PROJECT_ID/sync \
  -H "Content-Type: application/json" \
  -d "{\"includeJobs\":true,\"maxRuns\":10}"
```

GitHub PAT needs `repo` (private) or `public_repo` plus `actions:read`.
