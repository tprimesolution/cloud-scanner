"""Compliance API - summary, frameworks, findings for dashboard."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import get_db

router = APIRouter()


def _control_ids(m):
    if not m:
        return []
    ids = []
    for v in (m or {}).values():
        if isinstance(v, list):
            ids.extend(v)
    return ids


@router.get("/summary")
def compliance_summary(db: Session = Depends(get_db)):
    """Aggregated compliance metrics for dashboard."""
    total = db.execute(text("SELECT COUNT(*) FROM resources")).scalar() or 0
    violations = db.execute(
        text("SELECT COUNT(*) FROM findings WHERE status = 'open'")
    ).scalar() or 0
    critical = db.execute(
        text("SELECT COUNT(*) FROM findings WHERE status = 'open' AND severity = 'critical'")
    ).scalar() or 0
    high = db.execute(
        text("SELECT COUNT(*) FROM findings WHERE status = 'open' AND severity = 'high'")
    ).scalar() or 0
    rules_total = db.execute(text("SELECT COUNT(*) FROM compliance_rules WHERE enabled")).scalar() or 0
    score = 100 if total == 0 else max(0, min(100, round((total - violations) / total * 100)))

    last_scan = db.execute(
        text("SELECT completed_at FROM scan_history WHERE phase = 'scan' AND status = 'completed' ORDER BY completed_at DESC LIMIT 1")
    ).fetchone()

    return {
        "totalResources": total,
        "activeViolations": violations,
        "criticalFindings": critical,
        "highFindings": high,
        "complianceScore": score,
        "rulesEvaluated": rules_total,
        "lastEvaluated": str(last_scan[0]) if last_scan and last_scan[0] else None,
    }


@router.get("/findings")
def compliance_findings(
    db: Session = Depends(get_db),
    status: str | None = Query(None),
    severity: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
):
    """List compliance findings (alias for /scanner/findings)."""
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
                   f.message, f.status, f.remediation, f.last_seen_at, cr.compliance_mappings
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
            "remediation": r[7] or "",
            "lastSeenAt": str(r[8]),
            "controlIds": _control_ids(r[9]),
        }
        for r in rows
    ]
    return {"items": items, "total": total}


@router.get("/frameworks/status")
def frameworks_status(db: Session = Depends(get_db)):
    """Per-framework compliance status."""
    rows = db.execute(
        text("""
            SELECT cr.compliance_mappings, COUNT(*) as fail_count
            FROM findings f
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE f.status = 'open'
            GROUP BY cr.compliance_mappings
        """)
    ).fetchall()

    frameworks = {"cis": 100, "soc2": 100, "iso27001": 100, "pci": 100}
    for mappings, cnt in rows:
        if mappings:
            for k in frameworks:
                if k in str(mappings).lower():
                    frameworks[k] = max(0, frameworks[k] - cnt * 5)

    return [
        {"frameworkId": "cis", "name": "CIS AWS Benchmark", "score": frameworks["cis"], "status": "pass" if frameworks["cis"] >= 80 else "fail"},
        {"frameworkId": "soc2", "name": "SOC 2", "score": frameworks["soc2"], "status": "pass" if frameworks["soc2"] >= 80 else "fail"},
        {"frameworkId": "iso27001", "name": "ISO 27001", "score": frameworks["iso27001"], "status": "pass" if frameworks["iso27001"] >= 80 else "fail"},
        {"frameworkId": "pci", "name": "PCI-DSS", "score": frameworks["pci"], "status": "pass" if frameworks["pci"] >= 80 else "fail"},
    ]


@router.get("/frameworks")
def list_frameworks(db: Session = Depends(get_db)):
    """List all 41 compliance frameworks with scores and finding counts."""
    fm_rows = db.execute(
        text("SELECT framework_id, name, description FROM framework_mappings ORDER BY name")
    ).fetchall()

    result = []
    for fid, name, desc in fm_rows:
        # Count findings that map to this framework (compliance_mappings key matches)
        fw_like = f"%{fid}%"
        cnt = db.execute(
            text("""
                SELECT COUNT(*) FROM findings f
                JOIN compliance_rules cr ON f.rule_id = cr.id
                WHERE f.status = 'open'
                AND cr.compliance_mappings::text ILIKE :fw_like
            """),
            {"fw_like": fw_like},
        ).scalar() or 0

        total_rules = db.execute(
            text("""
                SELECT COUNT(*) FROM compliance_rules
                WHERE compliance_mappings::text ILIKE :fw_like
            """),
            {"fw_like": fw_like},
        ).scalar() or 1
        score = max(0, min(100, 100 - (cnt * 100 // max(1, total_rules * 2))))
        result.append({
            "frameworkId": fid,
            "name": name,
            "description": desc or "",
            "findingCount": cnt,
            "score": score,
            "status": "pass" if score >= 80 else "fail",
        })
    return result


@router.get("/frameworks/{framework_id}/findings")
def framework_findings(
    framework_id: str,
    db: Session = Depends(get_db),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Findings for a specific compliance framework."""
    fw_like = f"%{framework_id}%"
    rows = db.execute(
        text("""
            SELECT f.id, r.resource_id, r.resource_type, cr.rule_id, f.severity,
                   f.message, f.status, f.remediation, f.last_seen_at, cr.compliance_mappings
            FROM findings f
            JOIN resources r ON f.resource_id = r.id
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE f.status = 'open'
            AND cr.compliance_mappings::text ILIKE :fw_like
            ORDER BY f.last_seen_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"fw_like": fw_like, "limit": limit, "offset": offset},
    ).fetchall()

    total = db.execute(
        text("""
            SELECT COUNT(*) FROM findings f
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE f.status = 'open'
            AND cr.compliance_mappings::text ILIKE :fw_like
        """),
        {"fw_like": fw_like},
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
            "remediation": r[7] or "",
            "lastSeenAt": str(r[8]),
            "controlIds": _control_ids(r[9]),
        }
        for r in rows
    ]
    return {"items": items, "total": total, "frameworkId": framework_id}


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """List all 17 categories with finding counts."""
    cat_rows = db.execute(
        text("SELECT category_id, name, description FROM categories ORDER BY name")
    ).fetchall()

    result = []
    for cid, name, desc in cat_rows:
        cnt = db.execute(
            text("""
                SELECT COUNT(*) FROM findings f
                JOIN compliance_rules cr ON f.rule_id = cr.id
                WHERE f.status = 'open' AND cr.category = :cid
            """),
            {"cid": cid},
        ).scalar() or 0
        result.append({
            "categoryId": cid,
            "name": name,
            "description": desc or "",
            "findingCount": cnt,
        })
    return result


@router.get("/categories/{category_id}/findings")
def category_findings(
    category_id: str,
    db: Session = Depends(get_db),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Findings for a specific category."""
    rows = db.execute(
        text("""
            SELECT f.id, r.resource_id, r.resource_type, cr.rule_id, f.severity,
                   f.message, f.status, f.remediation, f.last_seen_at, cr.compliance_mappings
            FROM findings f
            JOIN resources r ON f.resource_id = r.id
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE f.status = 'open' AND cr.category = :cid
            ORDER BY f.last_seen_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"cid": category_id, "limit": limit, "offset": offset},
    ).fetchall()

    total = db.execute(
        text("""
            SELECT COUNT(*) FROM findings f
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE f.status = 'open' AND cr.category = :cid
        """),
        {"cid": category_id},
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
            "remediation": r[7] or "",
            "lastSeenAt": str(r[8]),
            "controlIds": _control_ids(r[9]),
        }
        for r in rows
    ]
    return {"items": items, "total": total, "categoryId": category_id}
