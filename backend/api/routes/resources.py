"""Resources API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import get_db

router = APIRouter(prefix="/assets", include_in_schema=True)


@router.get("")
def list_resources(
    db: Session = Depends(get_db),
    resource_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, le=100),
):
    """List collected resources."""
    limit = pageSize
    offset = (page - 1) * pageSize
    where = ["1=1"]
    params = {"limit": limit, "offset": offset}
    if resource_type:
        where.append("resource_type = :rtype")
        params["rtype"] = resource_type

    where_clause = " AND ".join(where)
    rows = db.execute(
        text(f"""
            SELECT id, resource_id, resource_type, region, collected_at
            FROM resources WHERE {where_clause}
            ORDER BY collected_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()

    total = db.execute(
        text(f"SELECT COUNT(*) FROM resources WHERE {where_clause}"),
        {k: v for k, v in params.items() if k == "rtype"},
    ).scalar() or 0

    items = [
        {
            "id": str(r[0]),
            "name": r[1],
            "type": r[2],
            "riskLevel": "low",
            "createdAt": str(r[4]),
        }
        for r in rows
    ]
    return {"items": items, "page": page, "pageSize": pageSize, "total": total}
