"""Run compliance scan on collected resources.
Native YAML rules + Prowler (572+ checks) + CloudSploit (600+ plugins)."""
import json
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from scanner.scan.rule_engine import load_rules, evaluate_rule


def run_scan(db: Session) -> dict:
    """Run scanning phase. Plugin-based compliance rule engine."""
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
        if "-error" in str(rid) or "_error" in str(raw or {}):
            continue
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

    # Phase 2: Prowler (572+ AWS checks, 41 frameworks)
    if getattr(settings, "enable_prowler", True):
        try:
            from scanner.prowler_runner import run_prowler, ingest_prowler_findings
            prowler_findings = run_prowler(compliance=settings.prowler_compliance)
            finding_count += ingest_prowler_findings(db, prowler_findings, scan_id)
        except Exception:
            pass

    # Phase 3: CloudSploit (600+ AWS plugins)
    if getattr(settings, "enable_cloudsploit", True):
        try:
            from scanner.cloudsploit_runner import run_cloudsploit, ingest_cloudsploit_findings
            cloudsploit_findings = run_cloudsploit()
            finding_count += ingest_cloudsploit_findings(db, cloudsploit_findings, scan_id)
        except Exception:
            pass

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


def _category_from_resource_type(rtype: str) -> str:
    """Map resource_type to category_id."""
    m = {"s3_bucket": "aws-s3", "ec2_instance": "aws-ec2", "iam_role": "aws-iam", "iam_policy": "aws-iam",
         "iam_account": "aws-iam", "rds_instance": "aws-rds", "vpc": "aws-networking", "security_group": "aws-networking",
         "cloudtrail": "aws-cloudtrail", "lambda_function": "aws-lambda", "kms_key": "aws-kms",
         "secretsmanager_secret": "aws-secrets"}
    return m.get(rtype, "aws-general")


def _ensure_rules_in_db(db: Session, rules: list[dict]) -> None:
    """Insert rules if not exist."""
    for r in rules:
        category = r.get("category") or _category_from_resource_type(r.get("resource_type", ""))
        db.execute(
            text("""
                INSERT INTO compliance_rules (rule_id, description, resource_type, severity, compliance_mappings, remediation_guidance, category)
                VALUES (:rid, :desc, :rtype, :sev, CAST(:mappings AS jsonb), :remediation, :category)
                ON CONFLICT (rule_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    resource_type = EXCLUDED.resource_type,
                    severity = EXCLUDED.severity,
                    compliance_mappings = EXCLUDED.compliance_mappings,
                    remediation_guidance = EXCLUDED.remediation_guidance,
                    category = EXCLUDED.category
            """),
            {
                "rid": r["rule_id"],
                "desc": r["description"],
                "rtype": r["resource_type"],
                "sev": r["severity"],
                "mappings": json.dumps(r.get("compliance_mappings") or {}),
                "remediation": r.get("remediation") or r.get("remediation_guidance"),
                "category": category[:64],
            },
        )
    db.commit()


def _upsert_finding(db: Session, resource_id: int, rule: dict, message: str, scan_id: int) -> None:
    """Insert or update finding with remediation."""
    rule_row = db.execute(
        text("SELECT id FROM compliance_rules WHERE rule_id = :rid"),
        {"rid": rule["rule_id"]},
    ).fetchone()
    if not rule_row:
        return
    rule_db_id = rule_row[0]
    remediation = rule.get("remediation") or rule.get("remediation_guidance") or ""
    db.execute(
        text("""
            INSERT INTO findings (resource_id, rule_id, severity, status, message, remediation, scan_id, last_seen_at)
            VALUES (:res_id, :rule_id, :sev, 'open', :msg, :remediation, :scan_id, NOW())
            ON CONFLICT (resource_id, rule_id) DO UPDATE SET
                message = EXCLUDED.message,
                remediation = EXCLUDED.remediation,
                scan_id = EXCLUDED.scan_id,
                last_seen_at = NOW()
        """),
        {
            "res_id": resource_id,
            "rule_id": rule_db_id,
            "sev": rule["severity"],
            "msg": message,
            "remediation": remediation,
            "scan_id": scan_id,
        },
    )
