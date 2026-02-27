"""Dashboard API - metrics and compliance score."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import get_db

router = APIRouter()


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    """Dashboard metrics."""
    total = db.execute(text("SELECT COUNT(*) FROM resources")).scalar() or 0
    violations = db.execute(
        text("SELECT COUNT(*) FROM findings WHERE status = 'open'")
    ).scalar() or 0
    critical = db.execute(
        text("SELECT COUNT(*) FROM findings WHERE status = 'open' AND severity = 'critical'")
    ).scalar() or 0
    rules = db.execute(text("SELECT COUNT(*) FROM compliance_rules WHERE enabled")).scalar() or 0
    return {
        "totalAssets": total,
        "activeViolations": violations,
        "criticalRisks": critical,
        "frameworkCoverage": f"{min(100, rules * 10)}%",
    }


@router.get("/compliance-score")
def compliance_score(db: Session = Depends(get_db)):
    """Overall compliance score."""
    total = db.execute(text("SELECT COUNT(*) FROM resources")).scalar() or 0
    violations = db.execute(
        text("SELECT COUNT(*) FROM findings WHERE status = 'open'")
    ).scalar() or 0
    score = 100 if total == 0 else round((total - violations) / total * 100)
    last = db.execute(
        text("SELECT completed_at FROM scan_history WHERE phase = 'scan' ORDER BY completed_at DESC LIMIT 1")
    ).fetchone()
    return {
        "score": max(0, min(100, score)),
        "lastEvaluated": last[0] if last else None,
        "resourceCount": total,
    }


@router.get("/findings-by-severity")
def findings_by_severity(db: Session = Depends(get_db)):
    """Findings grouped by severity."""
    rows = db.execute(
        text("""
            SELECT severity, COUNT(*) FROM findings
            WHERE status = 'open' GROUP BY severity
        """)
    ).fetchall()
    mapping = {"critical": "#f97373", "high": "#fb923c", "medium": "#eab308", "low": "#22c55e"}
    result = []
    for r in rows:
        result.append({
            "name": r[0].capitalize(),
            "value": r[1],
            "color": mapping.get(r[0], "#6b7280"),
        })
    return result


@router.get("/framework-scores")
def framework_scores(db: Session = Depends(get_db)):
    """Per-framework compliance scores."""
    rows = db.execute(
        text("""
            SELECT compliance_mappings, COUNT(*) FROM findings f
            JOIN compliance_rules cr ON f.rule_id = cr.id
            WHERE f.status = 'open'
            GROUP BY cr.compliance_mappings
        """)
    ).fetchall()
    scores = {"CIS": 100, "SOC2": 100, "ISO27001": 100}
    for mappings, cnt in rows:
        if mappings:
            for k in scores:
                if k in str(mappings):
                    scores[k] = max(0, scores[k] - cnt * 4)
    return [
        {"name": "CIS AWS", "score": scores["CIS"]},
        {"name": "ISO 27001", "score": scores["ISO27001"]},
        {"name": "SOC 2", "score": scores["SOC2"]},
    ]


@router.get("/risk-trend")
def risk_trend(db: Session = Depends(get_db)):
    """Historical trend (last 10 scans)."""
    rows = db.execute(
        text("""
            SELECT resource_count, finding_count, completed_at
            FROM scan_history WHERE phase = 'scan' AND status = 'completed'
            ORDER BY completed_at DESC LIMIT 10
        """)
    ).fetchall()
    rows = list(reversed(rows))
    return [
        {
            "week": f"Scan {i+1}",
            "score": max(0, min(100, round((r[0] - r[1]) / r[0] * 100))) if r[0] else 100,
            "date": str(r[2]),
        }
        for i, r in enumerate(rows)
    ]
