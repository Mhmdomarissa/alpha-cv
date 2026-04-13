"""Redis-backed queue for public-link CV processing.

Why:
- The existing in-process background tasks compete with API traffic.
- This queue allows a separate worker container to process applications.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, Optional

from app.utils.redis_cache import get_redis_cache

logger = logging.getLogger(__name__)


def _truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


QUEUE_KEY = "queue:public_job_apply"
STATUS_NS = "public_apply_jobs"


def is_public_cv_queue_enabled() -> bool:
    """Enable API enqueue + worker processing via env flag."""
    return _truthy("ENABLE_PUBLIC_CV_QUEUE")


def enqueue_public_application(application_data: Dict[str, Any]) -> str:
    """Enqueue a public job application for background processing.

    Stores a status record in Redis and pushes the job id onto a list.
    """
    cache = get_redis_cache()
    if not cache.is_connected:
        raise RuntimeError("Redis not connected; cannot enqueue public CV job")

    job_id = application_data.get("application_id") or ""
    if not job_id:
        raise ValueError("application_id is required to enqueue")

    status = {
        "job_id": job_id,
        "status": "queued",
        "queued_at": time.time(),
        "started_at": None,
        "finished_at": None,
        "error": None,
    }

    cache.set(job_id, status, ttl_seconds=60 * 60 * 24, namespace=STATUS_NS)

    payload = json.dumps(application_data, default=str)
    # Use raw redis client to support list operations
    cache.redis_client.lpush(f"cv_app:{STATUS_NS}:{QUEUE_KEY}", payload)

    logger.info(f"📥 Public CV job queued: {job_id}")
    return job_id


def get_public_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    return get_redis_cache().get(job_id, namespace=STATUS_NS)


def set_public_job_status(job_id: str, **updates: Any) -> None:
    cache = get_redis_cache()
    current = cache.get(job_id, namespace=STATUS_NS) or {"job_id": job_id}
    current.update(updates)
    cache.set(job_id, current, ttl_seconds=60 * 60 * 24, namespace=STATUS_NS)

