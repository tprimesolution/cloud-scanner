"""FastAPI main application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import scanner, dashboard, findings, resources, rules
from db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB and load rules."""
    init_db()
    from scanner.scan.rule_engine import load_rules
    from scanner.scan.scan_service import _ensure_rules_in_db
    from db.database import SessionLocal
    db = SessionLocal()
    try:
        _ensure_rules_in_db(db, load_rules())
    finally:
        db.close()
    yield
    # Shutdown


app = FastAPI(
    title="Cloud Compliance Scanner",
    description="Single-account AWS compliance scanner. Uses EC2 IAM role.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scanner.router, prefix="/api/scanner", tags=["scanner"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(findings.router, prefix="/api/scanner", tags=["findings"])  # /api/scanner/findings
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(rules.router, prefix="/api", tags=["rules"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/health/ready")
def ready():
    return {"status": "ready"}
