# Nimbus Guard – Cloud Compliance Scanner

Unified security scanning platform for AWS. NestJS backend (appliance-backend), Next.js frontend.

**Scanner coverage:** Native rules (S3, IAM, EC2, RDS, CloudTrail) + **Prowler** (572+ AWS checks, 41 frameworks) + **CloudSploit** (600+ plugins).

## Quick Deploy (Amazon Linux EC2)

### Option A: User Data (fully hands-off)

1. Push this repo to GitHub (or any git host).
2. Edit `deploy/user-data.sh`: set `REPO_URL` to your repo.
3. In EC2 Launch Instance → Advanced → User Data: paste the contents of `deploy/user-data.sh`.
4. Open port 80 in the Security Group (inbound).
5. **Attach IAM role** with policy from `deploy/iam-policy-nimbus-scanner.json` for full AWS coverage.
6. Launch. After ~5–10 min, access `http://<ec2-public-ip>:80`.

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
- appliance-backend (NestJS) on port 8080 — includes Prowler + CloudSploit
- Next.js frontend (via nginx)
- nginx on port 80

**First build** may take 5–10 min (installs Prowler and CloudSploit).

### Database

The appliance-backend uses Prisma. Migrations are run automatically on startup.

### Frontend

Open http://localhost (or http://localhost:80) in your browser.

## Development Notes

- Backend: NestJS + Prisma + PostgreSQL. Scanner runs native rules + Prowler + CloudSploit.
- Frontend: Next.js + TailwindCSS with Recharts.
- API base: `http://localhost:8080/api`

### IAM Policy (EC2)

For full AWS scanning, attach `deploy/iam-policy-nimbus-scanner.json` to the EC2 instance role. Without it, only S3 and IAM findings will appear.

### Sample API usage

```bash
# health
curl http://localhost:8080/api/health/ready

# list findings
curl http://localhost:8080/api/scanner/findings

# compliance score
curl http://localhost:8080/api/dashboard/compliance-score
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PROWLER` | `true` | Run Prowler (572+ checks) during scan |
| `ENABLE_CLOUDSPLOIT` | `true` | Run CloudSploit (600+ plugins) during scan |
| `PROWLER_COMPLIANCE` | — | Optional: `cis`, `pci`, `hipaa` |
| `CLOUDSPLOIT_DIR` | `/opt/cloudsploit` | CloudSploit install path |

## Next Steps

1. Add authentication and RBAC.
2. Add unit tests.
3. Deploy to Kubernetes with CI/CD.
