from __future__ import annotations

import logging
from datetime import date
from typing import Iterable, Optional

from app.services.email_otp_service import get_email_otp_service

logger = logging.getLogger(__name__)


def _split_emails(v: str | None) -> list[str]:
    if not v:
        return []
    parts = []
    for raw in str(v).replace(";", ",").split(","):
        e = raw.strip()
        if e:
            parts.append(e)
    # de-dupe, keep order
    out: list[str] = []
    seen = set()
    for e in parts:
        k = e.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(e)
    return out


async def send_followup_reminder_email(
    *,
    to_emails: str,
    cc_emails: Optional[str],
    subject: str,
    body_html: str,
) -> bool:
    """
    Send an email using the same Microsoft Graph sender mailbox as OTP emails.
    """
    otp = get_email_otp_service()
    to_list = _split_emails(to_emails)
    cc_list = _split_emails(cc_emails)
    if not to_list:
        raise ValueError("Missing recipient (to)")

    try:
        access_token = await otp.get_access_token()
    except Exception as e:
        logger.error(f"Failed to acquire Graph token: {e}")
        return False

    message = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": e}} for e in to_list],
            **(
                {"ccRecipients": [{"emailAddress": {"address": e}} for e in cc_list]}
                if cc_list
                else {}
            ),
        },
        "saveToSentItems": True,
    }

    # Send email via Microsoft Graph API (same as OTP sender mailbox).
    send_mail_url = f"{otp.graph_base_url}/users/{otp.from_email}/sendMail"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    import aiohttp

    async with aiohttp.ClientSession() as session:
        async with session.post(send_mail_url, json=message, headers=headers) as response:
            if response.status == 202:
                return True
            err = await response.text()
            logger.error(f"Follow-up reminder sendMail failed: {response.status} - {err}")
            return False


def render_followup_email_html(data: dict) -> str:
    """
    Render a compact HTML email for follow-up reminders.
    Expects keys matching TrackerFollowUpRead-ish payload.
    """
    def fmt(v):
        return "" if v is None else str(v)

    # Keep this simple and reliable for Word/Outlook rendering.
    rows = [
        ("Client Name", fmt(data.get("client_name"))),
        ("Position", fmt(data.get("position"))),
        ("Recruiter Name", fmt(data.get("recruiter_name"))),
        ("Account Manager", fmt(data.get("account_manager"))),
        ("Recruitment Manager", fmt(data.get("recruitment_manager"))),
        ("Current Stage", fmt(data.get("current_stage"))),
        ("CV Submitted Date", fmt(data.get("cv_submitted_date"))),
        ("Follow Up Date", fmt(data.get("last_follow_up_date"))),
        ("Next Follow-up Date", fmt(data.get("next_follow_up_date"))),
        ("Client Feedback", fmt(data.get("client_feedback"))),
        ("Interview Feedback", fmt(data.get("interview_feedback"))),
        ("Remarks", fmt(data.get("remarks"))),
    ]

    trs = "\n".join(
        f"<tr><td style='padding:8px 10px; border:1px solid #e5e7eb; background:#f9fafb; width:190px;'><b>{k}</b></td>"
        f"<td style='padding:8px 10px; border:1px solid #e5e7eb;'>{v or '—'}</td></tr>"
        for k, v in rows
    )

    return f"""
    <div style="font-family:Calibri, Arial, sans-serif; font-size:11pt; color:#111827;">
      <div style="font-weight:700; font-size:14pt; margin-bottom:10px;">Follow-up Reminder</div>
      <div style="margin-bottom:12px; color:#374151;">
        This is an automated reminder for today’s follow-up.
      </div>
      <table style="border-collapse:collapse; width:100%; max-width:820px;">
        {trs}
      </table>
      <div style="margin-top:14px; color:#6b7280; font-size:10pt;">
        Sent by Alpha CV System.
      </div>
    </div>
    """.strip()

