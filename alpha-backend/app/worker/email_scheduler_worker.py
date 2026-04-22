"""Standalone process for running the email scheduler.

Run this in a separate container so the API stays responsive.
"""

import asyncio
import logging
import os


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("email-scheduler-worker")


async def main():
    # Ensure required services initialize (DB tables, redis, etc.)
    from app.services.email_database_service import email_db_service  # noqa: F401

    # Worker must be explicitly enabled
    enabled = os.getenv("ENABLE_EMAIL_SCHEDULER", "").strip().lower() in ("1", "true", "yes")
    if not enabled:
        logger.info("⏸️ Email scheduler worker is DISABLED (ENABLE_EMAIL_SCHEDULER!=true)")
        return

    logger.info("🚀 Starting email scheduler worker process")
    from app.services.email_scheduler import get_email_scheduler

    scheduler = get_email_scheduler()
    await scheduler.start_scheduler()


if __name__ == "__main__":
    asyncio.run(main())

