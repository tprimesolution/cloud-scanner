"""Run compliance scan on collected resources."""
import json
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from scanner.scan.rule_engine import load_rules, evaluate_rule


def run_scan(db: Session) -> dict:
    """Run scanning phase on collected resources."""
    started = datetime.utcnow()
    scan_row = db.execute(
        text("""
            INSERT INTO scan_history (scan_type, phase, status, started_at)
            VALUES ('full', 'scan', 'running', :started)
            RETURNING id
        """),
        {"started": started},
    ).fetchone()
    scan_id = scan_row[0]
    db.commit()

    rules = load_rules()
    _ensure_rules_in_db(db, rules)

    resources = db.execute(
        text("SELECT id, resource_id, resource_type, region, raw_metadata FROM resources")
    ).fetchall()

    finding_count = 0
    for row in resources:
        res_id, rid, rtype, region, raw = row
        resource = {
            "id": res_id,
            "resource_id": rid,
            "resource_type": rtype,
            "region": region,
            "raw_metadata": raw or {},
        }
        for rule in rules:
            if rule.get("resource_type") != rtype:
                continue
            passed, message = evaluate_rule(rule, resource)
            if not passed:
                _upsert_finding(db, res_id, rule, message, scan_id)
                finding_count += 1

    db.execute(
        text("""
            UPDATE scan_history
            SET status = 'completed', finding_count = :cnt, completed_at = :completed
            WHERE id = :scan_id
        """),
        {"cnt": finding_count, "completed": datetime.utcnow(), "scan_id": scan_id},
    )
    db.commit()

    return {"scan_id": scan_id, "finding_count": finding_count}


def _ensure_rules_in_db(db: Session, rules: list[dict]) -> None:
    """Insert rules if not exist."""
    for r in rules:
        db.execute(
            text("""
                INSERT INTO compliance_rules (rule_id, description, resource_type, severity, compliance_mappings)
                VALUES (:rid, :desc, :rtype, :sev, CAST(:mappings AS jsonb))
                ON CONFLICT (rule_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    resource_type = EXCLUDED.resource_type,
                    severity = EXCLUDED.severity,
                    compliance_mappings = EXCLUDED.compliance_mappings
            """),
            {
                "rid": r["rule_id"],
                "desc": r["description"],
                "rtype": r["resource_type"],
                "sev": r["severity"],
                "mappings": json.dumps(r.get("compliance_mappings") or {}),
            },
        )
    db.commit()


def _upsert_finding(db: Session, resource_id: int, rule: dict, message: str, scan_id: int) -> None:
    """Insert or update finding."""
    rule_row = db.execute(
        text("SELECT id FROM compliance_rules WHERE rule_id = :rid"),
        {"rid": rule["rule_id"]},
    ).fetchone()
    if not rule_row:
        return
    rule_db_id = rule_row[0]
    db.execute(
        text("""
            INSERT INTO findings (resource_id, rule_id, severity, status, message, scan_id, last_seen_at)
            VALUES (:res_id, :rule_id, :sev, 'open', :msg, :scan_id, NOW())
            ON CONFLICT (resource_id, rule_id) DO UPDATE SET
                message = EXCLUDED.message,
                scan_id = EXCLUDED.scan_id,
                last_seen_at = NOW()
        """),
        {
            "res_id": resource_id,
            "rule_id": rule_db_id,
            "sev": rule["severity"],
            "msg": message,
            "scan_id": scan_id,
        },
    )
