# Nimbus Guard – Cloud Compliance Scanner

Unified security scanning platform for AWS (Prowler/CloudSploit-style). NestJS backend, Next.js frontend.

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
/backend
  /api
  /scanner
  /policy_engine
  /compliance_mapping
  /recommendation
  /db
  /core
/frontend
  /components
  /pages
  /services
```

## Getting Started (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend)

### Initial Setup
1. Clone the repository.
2. Copy `.env.example` to `.env` and adjust settings (DATABASE_URL, SECRET_KEY, etc.).

### Running Services

```bash
# build and start everything
docker-compose up --build
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379
- FastAPI backend on port 8000
- Celery worker
- Next.js frontend on port 3000

### Database
The project includes Alembic for schema migrations. After setting `DATABASE_URL` in `.env`, initialize and create the first revision:

```bash
cd backend
alembic upgrade head             # applies existing migrations
alembic revision --autogenerate -m "initial"  # create new migration
alembic upgrade head
```

Alternatively, the `db/schema.sql` file can be applied directly during development.

### Scanning
Use `docker-compose exec backend python -c "from scanner.tasks import run_scan; run_scan.delay('<ROLE_ARN>');"` to trigger a scan against an AWS account with a role.

### Frontend
Open http://localhost:3000 in your browser.

## Development Notes
- Backend is built with FastAPI, Celery, SQLAlchemy.
- Policy rules live in `backend/policy_engine/rules` as YAML.
- Framework mappings in `backend/compliance_mapping/frameworks.yaml`.
- Frontend uses Next.js + TailwindCSS with Recharts.
### Sample API usage
```bash
# list resources
curl http://localhost:8000/resources

# list findings
curl http://localhost:8000/findings

# remediate a finding
curl -X POST http://localhost:8000/findings/1/remediate
```
## Next Steps
1. Implement full CRUD and DB migrations.
2. Add authentication and RBAC.
3. Expand scanner to IAM/RDS/SecurityGroups.
4. Add unit tests for policy engine and API.
5. Deploy to Kubernetes with CI/CD.
