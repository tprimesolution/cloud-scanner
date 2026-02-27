"""Celery tasks - collection and scan."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings
from celery_app import celery_app
from scanner.collection.collection_service import run_collection
from scanner.scan.scan_service import run_scan

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@celery_app.task(bind=True)
def run_collection_task(self):
    """Run collection phase. Uses EC2 IAM role for authentication."""
    db = SessionLocal()
    try:
        result = run_collection(db)
        return result
    finally:
        db.close()


@celery_app.task(bind=True)
def run_scan_task(self):
    """Run compliance scan on collected resources."""
    db = SessionLocal()
    try:
        result = run_scan(db)
        return result
    finally:
        db.close()


@celery_app.task(bind=True)
def run_full_scan_task(self):
    """Run collection then scan (chained)."""
    from celery import chain
    c = chain(run_collection_task.s(), run_scan_task.s())
    r = c.apply_async()
    return {"task_id": r.id, "message": "Scan started (collection -> scan)."}
