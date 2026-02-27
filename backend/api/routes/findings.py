"""Findings API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db

router = APIRouter(prefix="/findings", include_in_schema=True)


class StatusUpdate(BaseModel):
    status: str


def _control_ids(mappings):
    if not mappings:
        return []
    ids = []
    for v in (mappings or {}).values():
        if isinstance(v, list):
            ids.extend(v)
    return ids


@router.get("", include_in_schema=True)
def list_findings(
    db: Session = Depends(get_db),
    status: str | None = Query(None),
    severity: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
):
    """List findings with filters."""
    where = ["1=1"]
    params = {"limit": limit, "offset": offset}
    if status:
        where.append("f.status = :status")
        params["status"] = status
    if severity:
        where.append("f.severity = :severity")
        params["severity"] = severity

    where_clause = " AND ".join(where)
    rows = db.execute(
        text(f"""
            SELECT f.id, r.resource_id, r.resource_type, cr.rule_id, f.severity,
                   f.message, f.status, f.last_seen_at, cr.compliance_mappings
            FROM findings f
            JOIN resources r ON f.resource_id = r.id
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE {where_clause}
            ORDER BY f.last_seen_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()

    total = db.execute(
        text(f"SELECT COUNT(*) FROM findings f WHERE {where_clause}"),
        {k: v for k, v in params.items() if k in ("status", "severity")},
    ).scalar() or 0

    items = [
        {
            "id": str(r[0]),
            "resourceId": r[1],
            "resourceType": r[2],
            "ruleCode": r[3],
            "severity": r[4],
            "message": r[5],
            "status": r[6],
            "lastSeenAt": str(r[7]),
            "controlIds": _control_ids(r[8]),
        }
        for r in rows
    ]
    return {"items": items, "total": total}


@router.post("/{finding_id}/status", include_in_schema=True)
def update_status(finding_id: str, body: StatusUpdate, db: Session = Depends(get_db)):
    """Update finding status."""
    db.execute(
        text("UPDATE findings SET status = :status WHERE id = :id"),
        {"status": body.status, "id": int(finding_id) if finding_id.isdigit() else finding_id},
    )
    db.commit()
    return {"ok": True}
