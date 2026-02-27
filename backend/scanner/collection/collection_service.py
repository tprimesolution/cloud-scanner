"""Orchestrates collection phase - runs all collectors and stores in PostgreSQL."""
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from scanner.collection.ec2_collector import EC2Collector
from scanner.collection.s3_collector import S3Collector
from scanner.collection.iam_collector import IAMCollector
from scanner.collection.security_group_collector import SecurityGroupCollector
from scanner.collection.rds_collector import RDSCollector
from scanner.collection.vpc_collector import VPCCollector


COLLECTORS = [
    EC2Collector,
    S3Collector,
    IAMCollector,
    SecurityGroupCollector,
    RDSCollector,
    VPCCollector,
]


def run_collection(db: Session) -> dict[str, Any]:
    """
    Run full collection phase.
    Uses boto3 default credential chain (EC2 IAM role).
    """
    started = datetime.utcnow()
    scan_row = db.execute(
        text("""
            INSERT INTO scan_history (scan_type, phase, status, started_at)
            VALUES ('full', 'collection', 'running', :started)
            RETURNING id
        """),
        {"started": started},
    ).fetchone()
    scan_id = scan_row[0]
    db.commit()

    total = 0
    errors = []

    for collector_cls in COLLECTORS:
        try:
            collector = collector_cls(region=settings.aws_region)
            items = collector.collect()
            for item in items:
                _upsert_resource(db, item)
                total += 1
        except Exception as e:
            errors.append(f"{collector_cls.__name__}: {e}")

    db.execute(
        text("""
            UPDATE scan_history
            SET status = 'completed', resource_count = :total,
                completed_at = :completed, error_message = :err
            WHERE id = :scan_id
        """),
        {
            "total": total,
            "completed": datetime.utcnow(),
            "err": "; ".join(errors) if errors else None,
            "scan_id": scan_id,
        },
    )
    db.commit()

    return {"scan_id": scan_id, "resource_count": total, "errors": errors}


def _upsert_resource(db: Session, item: dict) -> None:
    """Insert or update resource."""
    import json
    db.execute(
        text("""
            INSERT INTO resources (resource_id, resource_type, region, raw_metadata, collected_at)
            VALUES (:rid, :rtype, :region, CAST(:meta AS jsonb), NOW())
            ON CONFLICT (resource_id, resource_type)
            DO UPDATE SET raw_metadata = CAST(:meta AS jsonb), collected_at = NOW()
        """),
        {
            "rid": item["resource_id"],
            "rtype": item["resource_type"],
            "region": item.get("region"),
            "meta": json.dumps(item.get("raw_metadata", {})),
        },
    )
