"""Database connection and session management."""
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - run schema.sql."""
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()
    with engine.connect() as conn:
        for stmt in (s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")):
            conn.execute(text(stmt))
        conn.commit()
