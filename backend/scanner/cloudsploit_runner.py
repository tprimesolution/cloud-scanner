"""Run CloudSploit AWS scan and parse JSON output into findings."""
import json
import os
import subprocess
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

CLOUDSPLOIT_DIR = Path(os.environ.get("CLOUDSPLOIT_DIR", "/opt/cloudsploit"))


def run_cloudsploit(compliance: str | None = None) -> list[dict[str, Any]]:
    """
    Run CloudSploit AWS scan. Uses default credential chain (EC2 IAM role).
    Returns list of findings (non-OK status).
    """
    index_js = CLOUDSPLOIT_DIR / "index.js"
    if not index_js.exists():
        return []

    out_file = Path("/tmp/cloudsploit_out.json")
    cmd = ["node", str(index_js), "--json", str(out_file), "--console", "none"]
    if compliance:
        cmd.extend(["--compliance", compliance])

    try:
        result = subprocess.run(
            cmd,
            cwd=str(CLOUDSPLOIT_DIR),
            capture_output=True,
            text=True,
            timeout=3600,
            env={**os.environ, "AWS_DEFAULT_REGION": os.environ.get("AWS_REGION", "us-east-1")},
        )
    except subprocess.TimeoutExpired:
        return []
    except Exception:
        return []

    if not out_file.exists():
        return []

    try:
        data = json.loads(out_file.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    finally:
        try:
            out_file.unlink(missing_ok=True)
        except OSError:
            pass

    if isinstance(data, list):
        findings = [r for r in data if r.get("status") and str(r.get("status", "")).upper() != "OK"]
    elif isinstance(data, dict) and "results" in data:
        findings = [r for r in data["results"] if r.get("status") and str(r.get("status", "")).upper() != "OK"]
    else:
        findings = []
    return findings


def _category_from_plugin(plugin: str) -> str:
    """Map CloudSploit plugin to category_id."""
    pl = (plugin or "").lower()
    if "s3" in pl or "bucket" in pl:
        return "aws-s3"
    if "ec2" in pl or "instance" in pl:
        return "aws-ec2"
    if "iam" in pl:
        return "aws-iam"
    if "cloudtrail" in pl:
        return "aws-cloudtrail"
    if "rds" in pl:
        return "aws-rds"
    if "lambda" in pl:
        return "aws-lambda"
    if "kms" in pl:
        return "aws-kms"
    if "vpc" in pl:
        return "aws-networking"
    if "security" in pl or "sg" in pl:
        return "aws-networking"
    return "aws-general"


def _resource_type_from_plugin(plugin: str) -> str:
    """Map CloudSploit plugin/category to resource_type."""
    plugin_lower = (plugin or "").lower()
    if "s3" in plugin_lower or "bucket" in plugin_lower:
        return "s3_bucket"
    if "ec2" in plugin_lower or "instance" in plugin_lower:
        return "ec2_instance"
    if "iam" in plugin_lower:
        return "iam_role"
    if "cloudtrail" in plugin_lower:
        return "cloudtrail"
    if "rds" in plugin_lower:
        return "rds_instance"
    if "lambda" in plugin_lower:
        return "lambda_function"
    if "kms" in plugin_lower:
        return "kms_key"
    if "vpc" in plugin_lower:
        return "vpc"
    if "security" in plugin_lower or "sg" in plugin_lower:
        return "security_group"
    return "aws_resource"


def _severity_from_cloudsploit(sev: str) -> str:
    m = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}
    return m.get((sev or "").lower(), "medium")


def ingest_cloudsploit_findings(db: Session, findings: list[dict], scan_id: int) -> int:
    """Ingest CloudSploit findings into DB."""
    count = 0
    for f in findings:
        resource_id_str = f.get("resource") or f.get("resourceId") or f.get("ResourceId") or ""
        region = f.get("region") or f.get("Region") or "global"
        plugin = f.get("plugin") or f.get("pluginId") or f.get("plugin_id") or "unknown"
        if not resource_id_str:
            resource_id_str = f"cloudsploit-{plugin}-{region}"

        resource_type = _resource_type_from_plugin(plugin)
        category = _category_from_plugin(plugin)
        rule_id = f"cloudsploit_{plugin}"
        severity = _severity_from_cloudsploit(f.get("severity") or f.get("Severity"))
        message = f.get("message") or f.get("statusExtended") or f.get("title", "")
        remediation = f.get("remediation") or f.get("recommended_action") or ""

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

        # Compliance mappings from CloudSploit
        compliance = f.get("compliance") or {}
        mappings = {}
        if isinstance(compliance, dict):
            for k, v in compliance.items():
                if isinstance(v, str) and v:
                    mappings[k.lower()] = [v]
                elif isinstance(v, list):
                    mappings[k.lower()] = v

        # Upsert rule
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
                "desc": f.get("title") or f.get("description") or plugin,
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
