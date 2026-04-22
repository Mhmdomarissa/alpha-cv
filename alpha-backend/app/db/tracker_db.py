from __future__ import annotations

import os
from typing import Generator, Optional

from sqlmodel import Session, create_engine

from app.core.config import settings
from app.models.tracker.base import tracker_metadata


def _looks_like_prod(url: str) -> bool:
    hints_raw = (settings.TRACKER_PROD_URL_HINTS or "").strip()
    if not hints_raw:
        return False
    hints = [h.strip().lower() for h in hints_raw.split(",") if h.strip()]
    u = url.lower()
    return any(h in u for h in hints)


def _assert_safe_tracker_db_url(url: str) -> None:
    env = (os.getenv("ENVIRONMENT") or os.getenv("NODE_ENV") or "development").lower()
    if env == "production":
        return
    if not url:
        return
    if _looks_like_prod(url) and not settings.ALLOW_PROD_DATA_ACCESS:
        raise RuntimeError(
            "Refusing to use TRACKER_DB_URL that matches TRACKER_PROD_URL_HINTS in non-production. "
            "Set ALLOW_PROD_DATA_ACCESS=true to override (not recommended)."
        )


_tracker_engine = None


def get_tracker_engine():
    global _tracker_engine
    if _tracker_engine is not None:
        return _tracker_engine
    if not settings.TRACKER_DB_URL:
        raise RuntimeError("TRACKER_DB_URL is not configured")
    _assert_safe_tracker_db_url(settings.TRACKER_DB_URL)
    _tracker_engine = create_engine(
        settings.TRACKER_DB_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False,
    )
    return _tracker_engine


def get_tracker_session() -> Generator[Session, None, None]:
    engine = get_tracker_engine()
    with Session(engine) as session:
        yield session


def init_tracker_db() -> Optional[bool]:
    """Initialize tracker tables if feature flag is enabled.

    Returns:
      - True if initialized
      - False if disabled
      - None if misconfigured (disabled by default behavior)
    """
    if not settings.ENABLE_CANDIDATE_TRACKER:
        return False
    if not settings.TRACKER_DB_URL:
        # Feature enabled but no DB configured: fail fast so we don't silently use auth DB.
        raise RuntimeError("ENABLE_CANDIDATE_TRACKER=true but TRACKER_DB_URL is empty")

    # Ensure tracker models are imported so their tables are registered on tracker_metadata
    from app.models.tracker import models as _tracker_models  # noqa: F401

    engine = get_tracker_engine()
    tracker_metadata.create_all(engine)
    _migrate_tracker_application_columns(engine)
    _migrate_tracker_application_job_opening_nullable(engine)
    _migrate_tracker_application_ad_columns(engine)
    _migrate_tracker_application_ad_job_opening_nullable(engine)
    _migrate_tracker_job_opening_columns(engine)
    _migrate_tracker_job_opening_ad_columns(engine)
    _migrate_tracker_option_columns(engine)
    _migrate_tracker_option_ad_columns(engine)
    _migrate_tracker_followup_table(engine)
    _migrate_tracker_followup_ad_table(engine)
    _drop_unused_tracker_tables(engine)
    return True


def _drop_unused_tracker_tables(engine) -> None:
    """
    Destructive cleanup (safe):
    These tables are not used by the current Tracker UI/features and can be removed
    without affecting core tracker data (requirements, candidates, applications, follow-ups, options).
    """
    from sqlalchemy import text

    # Keep list explicit and stable.
    tables = [
        "tracker_candidate_skill_ad",
        "tracker_document_ad",
        "tracker_skill_ad",
        "tracker_candidate_skill",
        "tracker_document",
        "tracker_skill",
    ]

    with engine.begin() as conn:
        for t in tables:
            try:
                conn.execute(text(f'DROP TABLE IF EXISTS "{t}"'))
            except Exception:
                # Best-effort: if permissions or dialect quirks, skip.
                pass


def _migrate_tracker_application_ad_columns(engine) -> None:
    """Best-effort additive migration for TrackerApplicationAD columns."""
    from sqlalchemy import text

    desired = {
        "applied_date": "DATE",
        "position": "TEXT",
        "client": "TEXT",
        "location": "TEXT",
        "recruiter": "TEXT",
        "account_manager": "TEXT",
        "recruitment_manager": "TEXT",
        "comment": "TEXT",
        "created_by_username": "TEXT",
        "created_by_role": "TEXT",
        "created_by_team_location": "TEXT",
    }

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            res = conn.execute(text("PRAGMA table_info(tracker_application_ad)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_application_ad ADD COLUMN {col} {coltype}"))
            try:
                conn.execute(
                    text(
                        """
                        UPDATE tracker_application_ad
                        SET created_by_team_location = location
                        WHERE created_by_team_location IS NULL
                          AND location IS NOT NULL
                          AND TRIM(location) <> ''
                        """
                    )
                )
            except Exception:
                pass
        else:
            res = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_application_ad'")
            )
            existing = {r[0] for r in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE "tracker_application_ad" ADD COLUMN {col} {coltype}'))
            try:
                conn.execute(
                    text(
                        """
                        UPDATE "tracker_application_ad"
                        SET created_by_team_location = location
                        WHERE created_by_team_location IS NULL
                          AND location IS NOT NULL
                          AND BTRIM(location) <> ''
                        """
                    )
                )
            except Exception:
                pass


def _migrate_tracker_application_columns(engine) -> None:
    """Best-effort additive migration for TrackerApplication columns."""
    from sqlalchemy import text

    desired = {
        "applied_date": "DATE",
        "position": "TEXT",
        "client": "TEXT",
        "location": "TEXT",
        "recruiter": "TEXT",
        "account_manager": "TEXT",
        "recruitment_manager": "TEXT",
        "comment": "TEXT",
        "created_by_username": "TEXT",
        "created_by_role": "TEXT",
        "created_by_team_location": "TEXT",
    }

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            res = conn.execute(text("PRAGMA table_info(tracker_application)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_application ADD COLUMN {col} {coltype}"))
            # Backfill: for existing rows, default created_by_team_location to current location.
            try:
                conn.execute(
                    text(
                        """
                        UPDATE tracker_application
                        SET created_by_team_location = location
                        WHERE created_by_team_location IS NULL
                          AND location IS NOT NULL
                          AND TRIM(location) <> ''
                        """
                    )
                )
            except Exception:
                pass
        else:
            res = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_application'")
            )
            existing = {r[0] for r in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE "tracker_application" ADD COLUMN {col} {coltype}'))
            # Backfill: for existing rows, default created_by_team_location to current location.
            try:
                conn.execute(
                    text(
                        """
                        UPDATE "tracker_application"
                        SET created_by_team_location = location
                        WHERE created_by_team_location IS NULL
                          AND location IS NOT NULL
                          AND BTRIM(location) <> ''
                        """
                    )
                )
            except Exception:
                pass


def _migrate_tracker_application_job_opening_nullable(engine) -> None:
    """Allow TrackerApplication.job_opening_id to be nullable (and clean empty strings)."""
    from sqlalchemy import text

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")

    with engine.begin() as conn:
        if is_sqlite:
            # SQLite: no easy ALTER COLUMN; best-effort cleanup only.
            try:
                conn.execute(text("UPDATE tracker_application SET job_opening_id = NULL WHERE job_opening_id = ''"))
            except Exception:
                pass
            return

        # Postgres:
        # - convert '' to NULL so FK is not violated
        # - ensure column is nullable
        conn.execute(text('UPDATE "tracker_application" SET job_opening_id = NULL WHERE job_opening_id = \'\''))
        try:
            conn.execute(text('ALTER TABLE "tracker_application" ALTER COLUMN job_opening_id DROP NOT NULL'))
        except Exception:
            # already nullable or column missing; ignore
            pass


def _migrate_tracker_application_ad_job_opening_nullable(engine) -> None:
    """Allow TrackerApplicationAD.job_opening_id to be nullable (and clean empty strings)."""
    from sqlalchemy import text

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")

    with engine.begin() as conn:
        if is_sqlite:
            try:
                conn.execute(text("UPDATE tracker_application_ad SET job_opening_id = NULL WHERE job_opening_id = ''"))
            except Exception:
                pass
            return

        conn.execute(text('UPDATE "tracker_application_ad" SET job_opening_id = NULL WHERE job_opening_id = \'\''))
        try:
            conn.execute(text('ALTER TABLE "tracker_application_ad" ALTER COLUMN job_opening_id DROP NOT NULL'))
        except Exception:
            pass

def _migrate_tracker_job_opening_columns(engine) -> None:
    """Best-effort additive migration for TrackerJobOpening columns."""
    from sqlalchemy import text

    desired = {
        "req_date": "DATE",
        "client": "TEXT",
        "work_location": "TEXT",
        "recruitment_manager": "TEXT",
    }

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            res = conn.execute(text("PRAGMA table_info(tracker_job_opening)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_job_opening ADD COLUMN {col} {coltype}"))
        else:
            res = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_job_opening'")
            )
            existing = {r[0] for r in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE "tracker_job_opening" ADD COLUMN {col} {coltype}'))


def _migrate_tracker_job_opening_ad_columns(engine) -> None:
    """Best-effort additive migration for TrackerJobOpeningAD columns."""
    from sqlalchemy import text

    desired = {
        "req_date": "DATE",
        "client": "TEXT",
        "work_location": "TEXT",
        "recruitment_manager": "TEXT",
    }

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            res = conn.execute(text("PRAGMA table_info(tracker_job_opening_ad)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_job_opening_ad ADD COLUMN {col} {coltype}"))
        else:
            res = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_job_opening_ad'")
            )
            existing = {r[0] for r in res.fetchall()}
            for col, coltype in desired.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE "tracker_job_opening_ad" ADD COLUMN {col} {coltype}'))


def _migrate_tracker_option_columns(engine) -> None:
    """Ensure tracker_option exists and has required columns (best-effort)."""
    from sqlalchemy import text

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            # If the table doesn't exist, create it.
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tracker_option (
                        id TEXT PRIMARY KEY,
                        kind TEXT,
                        value TEXT,
                        email TEXT,
                        email_enabled BOOLEAN DEFAULT 1,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at TEXT,
                        updated_at TEXT
                    )
                    """
                )
            )
            # Add any missing columns (sqlite supports ADD COLUMN).
            res = conn.execute(text("PRAGMA table_info(tracker_option)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in {
                "kind": "TEXT",
                "value": "TEXT",
                "email": "TEXT",
                "email_enabled": "BOOLEAN",
                "is_deleted": "BOOLEAN",
                "created_at": "TEXT",
                "updated_at": "TEXT",
            }.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_option ADD COLUMN {col} {coltype}"))
        else:
            # Postgres: create if not exists, then ensure columns exist.
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tracker_option (
                        id TEXT PRIMARY KEY,
                        kind TEXT,
                        value TEXT,
                        email TEXT,
                        email_enabled BOOLEAN DEFAULT TRUE,
                        is_deleted BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            res = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_option'")
            )
            existing = {r[0] for r in res.fetchall()}
            for col, coltype in {
                "kind": "TEXT",
                "value": "TEXT",
                "email": "TEXT",
                "email_enabled": "BOOLEAN",
                "is_deleted": "BOOLEAN",
                "created_at": "TIMESTAMP",
                "updated_at": "TIMESTAMP",
            }.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE "tracker_option" ADD COLUMN {col} {coltype}'))
            try:
                conn.execute(text('UPDATE "tracker_option" SET email_enabled = TRUE WHERE email_enabled IS NULL'))
            except Exception:
                pass


def _migrate_tracker_option_ad_columns(engine) -> None:
    """Ensure tracker_option_ad exists and has required columns (best-effort)."""
    from sqlalchemy import text

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tracker_option_ad (
                        id TEXT PRIMARY KEY,
                        kind TEXT,
                        value TEXT,
                        email TEXT,
                        email_enabled BOOLEAN DEFAULT 1,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at TEXT,
                        updated_at TEXT
                    )
                    """
                )
            )
            res = conn.execute(text("PRAGMA table_info(tracker_option_ad)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in {
                "kind": "TEXT",
                "value": "TEXT",
                "email": "TEXT",
                "email_enabled": "BOOLEAN",
                "is_deleted": "BOOLEAN",
                "created_at": "TEXT",
                "updated_at": "TEXT",
            }.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_option_ad ADD COLUMN {col} {coltype}"))
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tracker_option_ad (
                        id TEXT PRIMARY KEY,
                        kind TEXT,
                        value TEXT,
                        email TEXT,
                        email_enabled BOOLEAN DEFAULT TRUE,
                        is_deleted BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            res = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_option_ad'")
            )
            existing = {r[0] for r in res.fetchall()}
            for col, coltype in {
                "kind": "TEXT",
                "value": "TEXT",
                "email": "TEXT",
                "email_enabled": "BOOLEAN",
                "is_deleted": "BOOLEAN",
                "created_at": "TIMESTAMP",
                "updated_at": "TIMESTAMP",
            }.items():
                if col not in existing:
                    conn.execute(text(f'ALTER TABLE "tracker_option_ad" ADD COLUMN {col} {coltype}'))
            try:
                conn.execute(text('UPDATE "tracker_option_ad" SET email_enabled = TRUE WHERE email_enabled IS NULL'))
            except Exception:
                pass


def _migrate_tracker_followup_table(engine) -> None:
    """Ensure tracker_follow_up exists (best-effort)."""
    from sqlalchemy import text

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tracker_follow_up (
                        id TEXT PRIMARY KEY,
                        client_name TEXT,
                        position TEXT,
                        recruiter_name TEXT,
                        account_manager TEXT,
                        recruitment_manager TEXT,
                        cv_submitted_date DATE,
                        current_stage TEXT,
                        last_follow_up_date DATE,
                        next_follow_up_date DATE,
                        interview_date DATE,
                        client_feedback TEXT,
                        interview_feedback TEXT,
                        remarks TEXT,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at TEXT,
                        updated_at TEXT
                    )
                    """
                )
            )
            res = conn.execute(text("PRAGMA table_info(tracker_follow_up)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in {
                "account_manager": "TEXT",
                "recruitment_manager": "TEXT",
                "reminder_last_sent_at": "TEXT",
            }.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_follow_up ADD COLUMN {col} {coltype}"))
            return

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tracker_follow_up (
                    id TEXT PRIMARY KEY,
                    client_name TEXT,
                    position TEXT,
                    recruiter_name TEXT,
                    account_manager TEXT,
                    recruitment_manager TEXT,
                    cv_submitted_date DATE,
                    current_stage TEXT,
                    last_follow_up_date DATE,
                    next_follow_up_date DATE,
                    interview_date DATE,
                    client_feedback TEXT,
                    interview_feedback TEXT,
                    remarks TEXT,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
                """
            )
        )

        # Add missing columns if table already existed.
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_follow_up'"))
        existing = {r[0] for r in res.fetchall()}
        for col, coltype in {
            "account_manager": "TEXT",
            "recruitment_manager": "TEXT",
            "reminder_last_sent_at": "TIMESTAMP",
        }.items():
            if col not in existing:
                conn.execute(text(f'ALTER TABLE "tracker_follow_up" ADD COLUMN {col} {coltype}'))


def _migrate_tracker_followup_ad_table(engine) -> None:
    """Ensure tracker_follow_up_ad exists (best-effort)."""
    from sqlalchemy import text

    url = str(engine.url)
    is_sqlite = url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tracker_follow_up_ad (
                        id TEXT PRIMARY KEY,
                        client_name TEXT,
                        position TEXT,
                        recruiter_name TEXT,
                        account_manager TEXT,
                        recruitment_manager TEXT,
                        cv_submitted_date DATE,
                        current_stage TEXT,
                        last_follow_up_date DATE,
                        next_follow_up_date DATE,
                        interview_date DATE,
                        client_feedback TEXT,
                        interview_feedback TEXT,
                        remarks TEXT,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at TEXT,
                        updated_at TEXT
                    )
                    """
                )
            )
            res = conn.execute(text("PRAGMA table_info(tracker_follow_up_ad)"))
            existing = {row[1] for row in res.fetchall()}
            for col, coltype in {
                "account_manager": "TEXT",
                "recruitment_manager": "TEXT",
                "reminder_last_sent_at": "TEXT",
            }.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tracker_follow_up_ad ADD COLUMN {col} {coltype}"))
            return

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tracker_follow_up_ad (
                    id TEXT PRIMARY KEY,
                    client_name TEXT,
                    position TEXT,
                    recruiter_name TEXT,
                    account_manager TEXT,
                    recruitment_manager TEXT,
                    cv_submitted_date DATE,
                    current_stage TEXT,
                    last_follow_up_date DATE,
                    next_follow_up_date DATE,
                    interview_date DATE,
                    client_feedback TEXT,
                    interview_feedback TEXT,
                    remarks TEXT,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
                """
            )
        )

        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='tracker_follow_up_ad'"))
        existing = {r[0] for r in res.fetchall()}
        for col, coltype in {
            "account_manager": "TEXT",
            "recruitment_manager": "TEXT",
            "reminder_last_sent_at": "TIMESTAMP",
        }.items():
            if col not in existing:
                conn.execute(text(f'ALTER TABLE "tracker_follow_up_ad" ADD COLUMN {col} {coltype}'))

