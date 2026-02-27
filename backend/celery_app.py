"""Celery app for background tasks. Uses Redis."""
from celery import Celery

from config import settings

celery_app = Celery(
    "scanner",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["celery_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "collection-every-6h": {
            "task": "celery_tasks.run_collection_task",
            "schedule": 21600.0,  # 6 hours
        },
        "scan-every-1h": {
            "task": "celery_tasks.run_scan_task",
            "schedule": 3600.0,  # 1 hour
        },
    },
)
