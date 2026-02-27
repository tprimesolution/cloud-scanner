"""Run Prowler AWS scan and parse JSON output into findings."""
import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _prowler_bin() -> str:
    """Prowler binary - use venv if available."""
    venv = os.environ.get("PROWLER_VENV", "")
    if venv:
        return str(Path(venv) / "bin" / "prowler")
    return "prowler"


def run_prowler(compliance: str | None = None) -> list[dict[str, Any]]:
    """
    Run Prowler AWS scan. Uses default credential chain (EC2 IAM role).
    Returns list of findings (FAIL status only).
    """
    with tempfile.TemporaryDirectory() as tmp:
        out_file = Path(tmp) / "prowler_output.json"
        cmd = [
            _prowler_bin(), "aws",
            "-M", "json",
            "-F", out_file.stem,
            "-o", tmp,
            "--quiet",
        ]
        if compliance:
            cmd.extend(["--compliance", compliance])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600,
                env={**os.environ, "AWS_DEFAULT_REGION": os.environ.get("AWS_REGION", "us-east-1")},
            )
        except subprocess.TimeoutExpired:
            return []
        except FileNotFoundError:
            return []
        except Exception:
            return []

        if not out_file.exists():
            return []

        try:
            data = json.loads(out_file.read_text())
        except (json.JSONDecodeError, OSError):
            return []

    if isinstance(data, list):
        return [r for r in data if r.get("Status") == "FAIL"]
    elif isinstance(data, dict) and "results" in data:
        return [r for r in data["results"] if r.get("Status") == "FAIL"]
    return []


def _category_from_service(service: str) -> str:
    """Map Prowler ServiceName to category_id."""
    m = {
        "iam": "aws-iam", "s3": "aws-s3", "ec2": "aws-ec2", "rds": "aws-rds",
        "cloudtrail": "aws-cloudtrail", "kms": "aws-kms", "lambda": "aws-lambda",
        "secretsmanager": "aws-secrets", "vpc": "aws-networking", "elbv2": "aws-elb",
        "elb": "aws-elb", "config": "aws-config", "backup": "aws-backup",
    }
    return m.get(service.lower(), "aws-general")


def _resource_type_from_service(service: str) -> str:
    """Map Prowler ServiceName to our resource_type."""
    mapping = {
        "rds": "rds_instance",
        "s3": "s3_bucket",
        "ec2": "ec2_instance",
        "iam": "iam_role",
        "cloudtrail": "cloudtrail",
        "kms": "kms_key",
        "lambda": "lambda_function",
        "secretsmanager": "secretsmanager_secret",
        "vpc": "vpc",
        "elbv2": "elbv2",
        "elb": "elb",
    }
    return mapping.get(service.lower(), f"{service}_resource")


def _severity_from_prowler(sev: str) -> str:
    """Map Prowler severity to our severity."""
    m = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}
    return m.get((sev or "").lower(), "medium")


def ingest_prowler_findings(db: Session, findings: list[dict], scan_id: int) -> int:
    """
    Ingest Prowler findings into DB. Upserts resources and rules, inserts findings.
    Returns count of findings ingested.
    """
    count = 0
    for f in findings:
        resource_id_str = f.get("ResourceId") or f.get("ResourceArn") or f.get("ResourceIdExtended") or ""
        if not resource_id_str:
            resource_id_str = f"prowler-{f.get('CheckID', 'unknown')}-{f.get('Region', 'global')}"

        region = f.get("Region") or "global"
        service = f.get("ServiceName", "unknown")
        resource_type = _resource_type_from_service(service)
        rule_id = f"prowler_{f.get('CheckID', 'unknown')}"
        severity = _severity_from_prowler(f.get("Severity"))
        message = f.get("StatusExtended") or f.get("CheckTitle", "")
        remediation = f.get("Remediation", {}).get("Recommendation", {}).get("Text", "") or ""

        # Upsert resource
        db.execute(
            text("""
                INSERT INTO resources (resource_id, resource_type, region, raw_metadata, collected_at)
                VALUES (:rid, :rtype, :region, '{}'::jsonb, NOW())
                ON CONFLICT (resource_id, resource_type)
                DO UPDATE SET collected_at = NOW()
            """),
            {"rid": resource_id_str[:512], "rtype": resource_type, "region": region},
        )
        db.commit()
        row = db.execute(
            text("SELECT id FROM resources WHERE resource_id = :rid AND resource_type = :rtype"),
            {"rid": resource_id_str[:512], "rtype": resource_type},
        ).fetchone()
        if not row:
            continue
        res_db_id = row[0]

        # Upsert compliance rule
        compliance = f.get("Compliance", {}) or {}
        mappings = {}
        for k, v in compliance.items():
            if isinstance(v, list):
                mappings[k.lower()] = v
            elif isinstance(v, dict) and "Framework" in v:
                mappings[k.lower()] = [v.get("Framework", v.get("Id", ""))]
        category = _category_from_service(service)

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
                "rid": rule_id,
                "desc": f.get("CheckTitle", rule_id),
                "rtype": resource_type,
                "sev": severity,
                "mappings": json.dumps(mappings),
                "remediation": remediation,
                "category": category[:64],
            },
        )
        db.commit()

        rule_row = db.execute(text("SELECT id FROM compliance_rules WHERE rule_id = :rid"), {"rid": rule_id}).fetchone()
        if not rule_row:
            continue
        rule_db_id = rule_row[0]

        # Upsert finding
        try:
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
                    "res_id": res_db_id,
                    "rule_id": rule_db_id,
                    "sev": severity,
                    "msg": message[:2000],
                    "remediation": remediation[:5000],
                    "scan_id": scan_id,
                },
            )
            count += 1
        except Exception:
            pass
    db.commit()
    return count
