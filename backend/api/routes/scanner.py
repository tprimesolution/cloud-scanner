"""Scanner API - trigger collection and scan."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import get_db
from scanner.collection.collection_service import run_collection
from scanner.scan.scan_service import run_scan

router = APIRouter()


@router.post("/scan")
def trigger_scan():
    """Trigger full scan (collection + compliance) in background."""
    from celery_tasks import run_full_scan_task
    task = run_full_scan_task.delay()
    return {"triggered": True, "task_id": task.id, "message": "Scan started."}


@router.post("/collection")
def trigger_collection():
    """Trigger collection only."""
    from celery_tasks import run_collection_task
    task = run_collection_task.delay()
    return {"triggered": True, "task_id": task.id}


@router.post("/collection/sync")
def run_collection_sync(db: Session = Depends(get_db)):
    """Run collection synchronously (for testing)."""
    result = run_collection(db)
    return result


@router.get("/status")
def scanner_status():
    """Scanner status."""
    return {"ready": True, "scanInProgress": False, "queueLength": 0}


@router.get("/jobs")
def list_jobs(limit: int = 20, db: Session = Depends(get_db)):
    """List recent scan jobs."""
    rows = db.execute(
        text("""
            SELECT id, scan_type, phase, status, resource_count, finding_count, completed_at
            FROM scan_history ORDER BY started_at DESC LIMIT :limit
        """),
        {"limit": limit},
    ).fetchall()
    return [
        {
            "id": str(r[0]),
            "type": r[1],
            "phase": r[2],
            "status": r[3],
            "resourceCount": r[4],
            "findingCount": r[5],
            "completedAt": str(r[6]) if r[6] else None,
        }
        for r in rows
    ]
