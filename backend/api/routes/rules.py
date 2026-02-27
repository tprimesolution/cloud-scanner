"""Compliance rules API."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import get_db

router = APIRouter(prefix="/rules")


@router.get("")
def list_rules(db: Session = Depends(get_db)):
    """List compliance rules."""
    rows = db.execute(
        text("""
            SELECT id, rule_id, description, resource_type, severity, compliance_mappings
            FROM compliance_rules WHERE enabled = true
        """)
    ).fetchall()

    def _control_ids(m):
        if not m:
            return []
        ids = []
        for v in (m or {}).values():
            if isinstance(v, list):
                ids.extend(v)
        return ids

    return [
        {
            "id": str(r[0]),
            "code": r[1],
            "name": r[1],
            "description": r[2],
            "resourceType": r[3],
            "severity": r[4],
            "controlIds": _control_ids(r[5]),
        }
        for r in rows
    ]
