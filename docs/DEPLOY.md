# Bitecodes — Deployment Guide (P15-06)

## Local development (one command)

```bash
git clone https://github.com/your-org/bitecodes.git
cd bitecodes
cp .env.example .env    # Fill POSTGRES_PASSWORD, AUTH_SECRET, ENCRYPTION_KEY

# Start infra
docker compose up postgres redis minio inngest litellm -d

# Install deps (requires pnpm 9 + Node 22)
pnpm install

# Start dev servers
pnpm --filter @bitecodes/api dev   # → http://localhost:4000 (/docs for Swagger)
pnpm --filter @bitecodes/web dev   # → http://localhost:3000
```

---

## Production: single VPS (Hetzner / DigitalOcean / Contabo)

### Recommended specs
| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### 1. Server setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Install pnpm + Node 22
curl -fsSL https://get.pnpm.io/install.sh | sh
pnpm env use --global 22
```

### 2. Clone and configure

```bash
git clone https://github.com/your-org/bitecodes.git
cd bitecodes
cp .env.example .env
nano .env   # Fill in all required values
```

### 3. Build images

```bash
docker compose --profile full build
```

### 4. Run database migrations

```bash
docker compose up postgres -d
pnpm db:push    # Apply Drizzle schema
pnpm db:seed    # Seed demo data (optional)
```

### 5. Start full stack

```bash
docker compose -f docker-compose.yml \
               -f infra/compose/docker-compose.prod.yml \
               --profile full up -d
```

### 6. Configure domain (Caddy auto-TLS)

Edit `infra/caddy/Caddyfile` — replace `yourdomain.com` with your domain.

Make sure ports 80 and 443 are open in your firewall:
```bash
ufw allow 80 && ufw allow 443
```

Caddy will automatically obtain a Let's Encrypt certificate on first request.

---

## Production: Fly.io (managed, zero-ops)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Create apps
fly apps create bitecodes-api
fly apps create bitecodes-web

# Set secrets
fly secrets set AUTH_SECRET="..." ENCRYPTION_KEY="..." -a bitecodes-api

# Deploy
fly deploy --dockerfile infra/docker/Dockerfile.api -a bitecodes-api
fly deploy --dockerfile infra/docker/Dockerfile.web -a bitecodes-web
```

### Managed services for Fly.io
- **Postgres**: Neon.tech or Supabase (pgvector supported)
- **Redis**: Upstash
- **Object storage**: Cloudflare R2 (S3-compatible)
- **Inngest**: Inngest Cloud (free tier)

---

## Production: Railway (one-click)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/bitecodes)

1. Click the button above
2. Fill in the required environment variables
3. Railway provisions Postgres (pgvector), Redis, and deploys both apps

---

## Production: Hetzner + Coolify

```bash
# On a fresh Hetzner CX21 (€4.15/month):
# 1. Install Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 2. Open Coolify UI at http://your-server-ip:8000
# 3. Add this repository as a new project
# 4. Set environment variables in the Coolify UI
# 5. Deploy — Coolify builds and runs the Docker containers
```

---

## Environment variables checklist (minimum for production)

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | ✅ | Use a strong random password |
| `DATABASE_URL` | ✅ | Full connection string |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | ✅ | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `LITELLM_MASTER_KEY` | ✅ | Generate a random key |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | ✅ | At least one model provider |
| `APP_URL` | ✅ | Your domain e.g. `https://yourdomain.com` |
| `API_URL` | ✅ | e.g. `https://api.yourdomain.com` |
| `RESEND_API_KEY` | Recommended | For transactional email |
| `STRIPE_SECRET_KEY` | Optional | For billing (managed cloud only) |
| `LANGFUSE_PUBLIC_KEY` | Optional | For LLM tracing |

---

## Backup strategy

```bash
# Daily Postgres backup to S3
0 2 * * * pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://your-bucket/backups/$(date +\%Y-\%m-\%d).sql.gz

# Test restore
gunzip -c backup.sql.gz | psql $DATABASE_URL
```

---

## Health monitoring

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness probe (always 200 if process is up) |
| `GET /ready` | Readiness probe (checks DB + Redis) |
| `GET /docs` | Swagger API documentation |

Configure your uptime monitor (Uptime Robot, Better Uptime, etc.) to alert on `/health`.
