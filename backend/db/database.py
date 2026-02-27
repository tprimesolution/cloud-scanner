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
    # Strip comment-only lines so we don't skip statements that start with -- in the file
    sql = "\n".join(line for line in sql.split("\n") if not line.strip().startswith("--"))
    with engine.connect() as conn:
        for stmt in (s.strip() for s in sql.split(";") if s.strip()):
            conn.execute(text(stmt))
        conn.commit()
