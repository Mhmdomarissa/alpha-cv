from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, datetime, time
from typing import Optional

from sqlmodel import Session, select

from app.core.config import is_followup_email_reminder_enabled
from app.db.tracker_db import get_tracker_engine
from app.models.tracker.models import TrackerFollowUp, TrackerFollowUpAD, TrackerOption, TrackerOptionAD
from app.services.followup_reminder_service import render_followup_email_html, send_followup_reminder_email

logger = logging.getLogger(__name__)


def _norm_team(team: str) -> str:
    return "".join(ch for ch in (team or "").strip().lower() if ch.isalnum())


def _option_model(team: str):
    return TrackerOptionAD if _norm_team(team) == "abudhabi" else TrackerOption


def _get_option_value(session: Session, *, team: str, kind: str) -> str:
    Opt = _option_model(team)
    r = session.exec(
        select(Opt)
        .where(Opt.kind == kind)
        .where(Opt.is_deleted == False)  # noqa: E712
        .order_by(Opt.updated_at.desc())
    ).first()
    return (r.value if r else "").strip()


def _set_option_value(session: Session, *, team: str, kind: str, value: str) -> None:
    Opt = _option_model(team)
    existing = session.exec(
        select(Opt)
        .where(Opt.kind == kind)
        .where(Opt.is_deleted == False)  # noqa: E712
        .order_by(Opt.updated_at.desc())
    ).first()
    now = datetime.utcnow()
    if existing:
        existing.value = value
        existing.updated_at = now
        session.add(existing)
        session.commit()
        return
    row = Opt(kind=kind, value=value, is_deleted=False, created_at=now, updated_at=now)
    session.add(row)
    session.commit()


def _lookup_person_email(session: Session, *, team: str, kind: str, name: Optional[str]) -> tuple[Optional[str], bool]:
    """
    Look up email for a named person from tracker_option[_ad].

    Returns: (email, enabled)
    - enabled defaults True when missing for backwards compatibility.
    """
    if not name or not str(name).strip():
        return None, True
    is_ad = _norm_team(team) == "abudhabi"
    Opt = TrackerOptionAD if is_ad else TrackerOption
    nm = str(name).strip()
    row = session.exec(
        select(Opt)
        .where(Opt.kind == kind)
        .where(Opt.value == nm)
        .where(Opt.is_deleted == False)  # noqa: E712
        .order_by(Opt.updated_at.desc())
    ).first()
    if not row:
        return None, True
    email = (getattr(row, "email", None) or "").strip() or None
    enabled = bool(getattr(row, "email_enabled", True))
    return email, enabled


def _due_query(FollowUpModel, today: date):
    # Send for next_follow_up_date <= today and not positions closed.
    return (
        select(FollowUpModel)
        .where(FollowUpModel.is_deleted == False)  # noqa: E712
        .where(FollowUpModel.next_follow_up_date != None)  # noqa: E711
        .where(FollowUpModel.next_follow_up_date <= today)
        .where(FollowUpModel.current_stage != "Positions Closed")
        .order_by(FollowUpModel.next_follow_up_date.asc(), FollowUpModel.created_at.desc())
    )


def _parse_dt(v: any) -> Optional[datetime]:
    if not v:
        return None
    try:
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
    except Exception:
        return None
    return None


def _scheduled_dt_local(today_local: date, hhmm: str, tz_name: str) -> datetime:
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(tz_name)
    except Exception:
        tz = None  # type: ignore
    hour, minute = 9, 0
    try:
        parts = (hhmm or "").strip().split(":")
        if len(parts) >= 2:
            hour = int(parts[0])
            minute = int(parts[1])
    except Exception:
        hour, minute = 9, 0
    dt = datetime.combine(today_local, time(hour=hour, minute=minute))
    return dt.replace(tzinfo=tz) if tz else dt


def _should_skip_as_duplicate(last_sent_at: Optional[datetime], scheduled_local: datetime, tz_name: str) -> bool:
    """
    Duplicate rules:
    - We consider it sent-for-today if last_sent_at (in local TZ) is >= today's scheduled send time.
    - If the configured time changes later the same day, scheduled_local becomes later; earlier sends
      are NOT treated as duplicates and it will send again at the new time.
    """
    if not last_sent_at:
        return False
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(tz_name)
        sent_local = last_sent_at.astimezone(tz)
    except Exception:
        sent_local = last_sent_at
    try:
        return sent_local >= scheduled_local
    except Exception:
        return False


async def _run_followup_reminders_for_team(session: Session, *, team: str, tz_name: str) -> dict:
    if not is_followup_email_reminder_enabled():
        return {"enabled": False, "team": team, "sent": 0, "skipped": 0}

    hhmm = _get_option_value(session, team=team, kind="followup_reminder_send_time") or "09:00"
    FollowUpModel = TrackerFollowUpAD if _norm_team(team) == "abudhabi" else TrackerFollowUp

    # Compute "today" in local TZ (UAE by default) to match business expectation.
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(tz_name)
        now_local = datetime.now(tz)
        today_local = now_local.date()
    except Exception:
        now_local = datetime.now()
        today_local = date.today()

    scheduled_local = _scheduled_dt_local(today_local, hhmm, tz_name)
    if now_local < scheduled_local:
        return {"enabled": True, "team": team, "sent": 0, "skipped": 0}

    sent = 0
    skipped = 0
    rows = session.exec(_due_query(FollowUpModel, today_local)).all()
    for r in rows:
        last_sent_at = _parse_dt(getattr(r, "reminder_last_sent_at", None))
        if _should_skip_as_duplicate(last_sent_at, scheduled_local, tz_name):
            skipped += 1
            continue

        # Resolve To/CC from row selections.
        to_email, to_enabled = _lookup_person_email(
            session,
            team=team,
            kind="account_manager",
            name=getattr(r, "account_manager", None),
        )
        if not to_enabled:
            skipped += 1
            continue
        cc_email, _cc_enabled = _lookup_person_email(
            session,
            team=team,
            kind="recruitment_manager",
            name=getattr(r, "recruitment_manager", None),
        )

        to_final = to_email or ""
        cc_final = cc_email or None
        if not to_final.strip():
            skipped += 1
            continue

        payload = {
            "client_name": r.client_name,
            "position": r.position,
            "recruiter_name": r.recruiter_name,
            "recruitment_manager": getattr(r, "recruitment_manager", None),
            "account_manager": getattr(r, "account_manager", None),
            "cv_submitted_date": r.cv_submitted_date.isoformat() if r.cv_submitted_date else None,
            "current_stage": r.current_stage,
            "last_follow_up_date": r.last_follow_up_date.isoformat() if r.last_follow_up_date else None,
            "next_follow_up_date": r.next_follow_up_date.isoformat() if r.next_follow_up_date else None,
            "client_feedback": r.client_feedback,
            "interview_feedback": r.interview_feedback,
            "remarks": r.remarks,
        }
        subject = f"Follow-up Reminder: {r.client_name}" + (f" – {r.position}" if r.position else "")
        html = render_followup_email_html(payload)

        ok = await send_followup_reminder_email(
            to_emails=to_final,
            cc_emails=cc_final,
            subject=subject,
            body_html=html,
        )
        if ok:
            r.reminder_last_sent_at = datetime.utcnow()
            session.add(r)
            session.commit()
            sent += 1
        else:
            skipped += 1

    return {"enabled": True, "team": team, "sent": sent, "skipped": skipped}


async def followup_reminder_loop(stop_event: asyncio.Event):
    """
    Background loop: checks once per minute, but only runs the send pass when:
    - local time >= configured time for the team, AND
    - we haven't already run for that team at/after today's configured time.

    This allows changing the send time in the UI without restart, and avoids duplicate sends.
    """
    tz_name = os.getenv("FOLLOWUP_REMINDER_TZ", "Asia/Dubai").strip() or "Asia/Dubai"

    logger.info(f"⏰ Follow-up reminder scheduler started (tz={tz_name})")

    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=60.0)
            break
        except asyncio.TimeoutError:
            pass

        try:
            if not is_followup_email_reminder_enabled():
                continue

            engine = get_tracker_engine()
            with Session(engine) as session:
                # Evaluate each team independently so Dubai/Abu Dhabi can have different times.
                for team in ("dubai", "abudhabi"):
                    hhmm = _get_option_value(session, team=team, kind="followup_reminder_send_time") or "09:00"
                    last_run_raw = _get_option_value(session, team=team, kind="followup_reminder_last_run_at")
                    last_run_at = _parse_dt(last_run_raw)

                    try:
                        from zoneinfo import ZoneInfo

                        tz = ZoneInfo(tz_name)
                        now_local = datetime.now(tz)
                        today_local = now_local.date()
                    except Exception:
                        now_local = datetime.now()
                        today_local = date.today()

                    scheduled_local = _scheduled_dt_local(today_local, hhmm, tz_name)
                    if now_local < scheduled_local:
                        continue

                    # If we already ran after the scheduled time (in local TZ), skip.
                    if last_run_at and _should_skip_as_duplicate(last_run_at, scheduled_local, tz_name):
                        continue

                    res = await _run_followup_reminders_for_team(session, team=team, tz_name=tz_name)
                    _set_option_value(session, team=team, kind="followup_reminder_last_run_at", value=datetime.utcnow().isoformat())
                    logger.info(f"📨 Follow-up reminders run ({team}): {res}")
        except Exception as e:
            logger.error(f"❌ Follow-up reminder scheduler run failed: {e}", exc_info=True)

    logger.info("🛑 Follow-up reminder scheduler stopped")

