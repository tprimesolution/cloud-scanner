# Nimbus Guard – Cloud Compliance Scanner

Unified security scanning platform for AWS. NestJS backend (appliance-backend), Next.js frontend.

## Quick Deploy (Amazon Linux EC2)

### Option A: User Data (fully hands-off)

1. Push this repo to GitHub (or any git host).
2. Edit `deploy/user-data.sh`: set `REPO_URL` to your repo.
3. In EC2 Launch Instance → Advanced → User Data: paste the contents of `deploy/user-data.sh`.
4. Open port 80 in the Security Group (inbound).
5. Launch. After ~5–10 min, access `http://<ec2-public-ip>:80`.

### Option B: Manual run

```bash
# SSH into EC2, clone the repo, then:
./install.sh
```

The script installs Docker, Docker Compose, and starts all services. Access the UI at `http://<host>:80`.

## Project Structure

```
/appliance-backend   NestJS API (Prisma, port 8080)
/frontend            Next.js app
/deploy              Docker Compose, nginx config
```

## Getting Started (Local Development)

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for frontend)

### Running Services

```bash
cd deploy
docker compose up -d --build
```

This will start:

- PostgreSQL on port 5432
- appliance-backend (NestJS) on port 8080
- Next.js frontend (via nginx)
- nginx on port 80

### Database

The appliance-backend uses Prisma. Migrations are run automatically on startup.

### Frontend

Open http://localhost (or http://localhost:80) in your browser.

## Development Notes

- Backend: NestJS + Prisma + PostgreSQL.
- Frontend: Next.js + TailwindCSS with Recharts.
- API base: `http://localhost:8080/api`

### Sample API usage

```bash
# health
curl http://localhost:8080/api/health/ready

# list findings
curl http://localhost:8080/api/scanner/findings

# compliance score
curl http://localhost:8080/api/dashboard/compliance-score
```

## Next Steps

1. Add authentication and RBAC.
2. Expand scanner coverage.
3. Add unit tests.
4. Deploy to Kubernetes with CI/CD.
