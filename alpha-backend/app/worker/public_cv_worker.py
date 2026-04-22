"""Worker process that consumes the public CV Redis queue."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time

from app.services.public_cv_queue import (
    is_public_cv_queue_enabled,
    set_public_job_status,
    STATUS_NS,
    QUEUE_KEY,
)
from app.utils.redis_cache import get_redis_cache


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("public-cv-worker")


async def main() -> None:
    if not is_public_cv_queue_enabled():
        logger.info("⏸️ Public CV worker disabled (ENABLE_PUBLIC_CV_QUEUE!=true)")
        return

    cache = get_redis_cache()
    if not cache.is_connected:
        raise RuntimeError("Redis not connected; public CV worker cannot run")

    qkey = f"cv_app:{STATUS_NS}:{QUEUE_KEY}"
    logger.info(f"🚀 Public CV worker started. Queue={qkey}")

    from app.services.email_database_service import email_db_service  # noqa: F401 (ensures tables)
    from app.services.careers_service import process_job_application_async

    while True:
        # BRPOP is blocking; run in thread to avoid blocking event loop.
        # IMPORTANT: our Redis client has a small socket_timeout; long blocking calls can raise TimeoutError.
        try:
            item = await asyncio.to_thread(cache.redis_client.brpop, qkey, 1)
        except TimeoutError:
            continue
        except Exception as e:
            # No data / socket timeout while idle; keep looping
            if "Timeout" in e.__class__.__name__ or "timeout" in str(e).lower():
                continue
            raise
        if not item:
            continue
        _, payload = item
        try:
            application_data = json.loads(payload)
            job_id = application_data.get("application_id") or "unknown"
            set_public_job_status(job_id, status="processing", started_at=time.time(), error=None)

            result = await process_job_application_async(application_data)
            if isinstance(result, dict) and result.get("success") is False:
                set_public_job_status(job_id, status="failed", finished_at=time.time(), error=result.get("error") or result.get("message"))
                logger.error(f"❌ Public CV job failed (reported): {job_id}: {result.get('error') or result.get('message')}")
            else:
                set_public_job_status(job_id, status="completed", finished_at=time.time())
                logger.info(f"✅ Public CV job completed: {job_id}")
        except Exception as e:
            job_id = "unknown"
            try:
                job_id = application_data.get("application_id") or "unknown"
            except Exception:
                pass
            set_public_job_status(job_id, status="failed", finished_at=time.time(), error=str(e))
            logger.error(f"❌ Public CV job failed: {job_id}: {e}")


if __name__ == "__main__":
    asyncio.run(main())

