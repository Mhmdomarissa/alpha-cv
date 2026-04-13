from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.config import settings
from app.db.tracker_db import get_tracker_session
from app.deps.auth import require_roles
from app.models.tracker.models import (
    TrackerApplication,
    TrackerCandidate,
    TrackerCandidateSkill,
    TrackerDocument,
    TrackerJobOpening,
    TrackerSkill,
)
from app.models.user import User
from app.schemas.tracker import (
    TrackerApplicationCreate,
    TrackerApplicationRead,
    TrackerApplicationUpdate,
    TrackerCandidateCreate,
    TrackerCandidateRead,
    TrackerCandidateSkillsUpdate,
    TrackerCandidateUpdate,
    TrackerDocumentCreate,
    TrackerDocumentRead,
    TrackerJobOpeningCreate,
    TrackerJobOpeningRead,
    TrackerJobOpeningUpdate,
    TrackerSkillCreate,
    TrackerSkillRead,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tracker", tags=["Candidate Tracker"])


def tracker_session(session: Session = Depends(get_tracker_session)) -> Session:
    # IMPORTANT: this dependency runs before route handlers. Keep the feature flag and
    # TRACKER_DB_URL checks here so disabled tracker endpoints don't crash due to missing DB.
    _require_tracker_enabled()
    return session


def _require_tracker_enabled():
    if not settings.ENABLE_CANDIDATE_TRACKER:
        raise HTTPException(status_code=404, detail="Candidate Tracker is disabled")
    if not settings.TRACKER_DB_URL:
        raise HTTPException(status_code=500, detail="TRACKER_DB_URL not configured")


def _touch_updated_at(obj):
    if hasattr(obj, "updated_at"):
        obj.updated_at = datetime.utcnow()


AllowedTrackerReadUser = Depends(require_roles("admin", "manager", "user", "recruiter"))
AllowedTrackerWriteUser = Depends(require_roles("admin", "manager"))


@router.get("/job-openings", response_model=List[TrackerJobOpeningRead])
def list_job_openings(
    status_filter: Optional[str] = None,
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    q = select(TrackerJobOpening).where(TrackerJobOpening.is_deleted == False)  # noqa: E712
    if status_filter:
        q = q.where(TrackerJobOpening.status == status_filter)
    rows = session.exec(q.order_by(TrackerJobOpening.created_at.desc())).all()
    return [
        TrackerJobOpeningRead(
            id=r.id,
            title=r.title,
            department=r.department,
            location=r.location,
            status=r.status,
            hiring_manager=r.hiring_manager,
            req_date=r.req_date,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/job-openings", response_model=TrackerJobOpeningRead, status_code=201)
def create_job_opening(
    data: TrackerJobOpeningCreate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = TrackerJobOpening(
        title=data.title,
        department=data.department,
        location=data.location,
        status=data.status,
        hiring_manager=data.hiring_manager,
        req_date=data.req_date,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerJobOpeningRead(
        id=row.id,
        title=row.title,
        department=row.department,
        location=row.location,
        status=row.status,
        hiring_manager=row.hiring_manager,
        req_date=row.req_date,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.patch("/job-openings/{job_opening_id}", response_model=TrackerJobOpeningRead)
def update_job_opening(
    job_opening_id: str,
    data: TrackerJobOpeningUpdate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = session.exec(select(TrackerJobOpening).where(TrackerJobOpening.id == job_opening_id)).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="Job opening not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    _touch_updated_at(row)
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerJobOpeningRead(
        id=row.id,
        title=row.title,
        department=row.department,
        location=row.location,
        status=row.status,
        hiring_manager=row.hiring_manager,
        req_date=row.req_date,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.delete("/job-openings/{job_opening_id}", status_code=204)
def delete_job_opening(
    job_opening_id: str,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = session.exec(select(TrackerJobOpening).where(TrackerJobOpening.id == job_opening_id)).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="Job opening not found")
    row.is_deleted = True
    _touch_updated_at(row)
    session.add(row)
    session.commit()
    return None


@router.get("/candidates", response_model=List[TrackerCandidateRead])
def list_candidates(
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    rows = session.exec(
        select(TrackerCandidate)
        .where(TrackerCandidate.is_deleted == False)  # noqa: E712
        .order_by(TrackerCandidate.created_at.desc())
    ).all()
    return [
        TrackerCandidateRead(
            id=r.id,
            name=r.name,
            email=r.email,
            phone=r.phone,
            current_company=r.current_company,
            experience_years=r.experience_years,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/candidates", response_model=TrackerCandidateRead, status_code=201)
def create_candidate(
    data: TrackerCandidateCreate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = TrackerCandidate(
        name=data.name,
        email=data.email,
        phone=data.phone,
        current_company=data.current_company,
        experience_years=data.experience_years,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerCandidateRead(
        id=row.id,
        name=row.name,
        email=row.email,
        phone=row.phone,
        current_company=row.current_company,
        experience_years=row.experience_years,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.patch("/candidates/{candidate_id}", response_model=TrackerCandidateRead)
def update_candidate(
    candidate_id: str,
    data: TrackerCandidateUpdate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == candidate_id)).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    _touch_updated_at(row)
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerCandidateRead(
        id=row.id,
        name=row.name,
        email=row.email,
        phone=row.phone,
        current_company=row.current_company,
        experience_years=row.experience_years,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.delete("/candidates/{candidate_id}", status_code=204)
def delete_candidate(
    candidate_id: str,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == candidate_id)).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")
    row.is_deleted = True
    _touch_updated_at(row)
    session.add(row)
    session.commit()
    return None


@router.post("/applications", response_model=TrackerApplicationRead, status_code=201)
def create_application(
    data: TrackerApplicationCreate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    # Validate candidate exists
    cand = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == data.candidate_id)).first()
    if not cand or cand.is_deleted:
        raise HTTPException(status_code=400, detail="Invalid candidate_id")
    job_opening_id = (data.job_opening_id or "").strip() or None
    # job_opening_id is optional — only validate if provided
    if job_opening_id:
        job = session.exec(select(TrackerJobOpening).where(TrackerJobOpening.id == job_opening_id)).first()
        if not job or job.is_deleted:
            raise HTTPException(status_code=400, detail="Invalid job_opening_id")

    row = TrackerApplication(
        candidate_id=data.candidate_id,
        job_opening_id=job_opening_id,
        applied_date=data.applied_date,
        position=data.position,
        client=data.client,
        status=data.status,
        recruiter=data.recruiter,
        account_manager=data.account_manager,
        comment=data.comment,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerApplicationRead(
        id=row.id,
        candidate_id=row.candidate_id,
        job_opening_id=row.job_opening_id,
        applied_date=row.applied_date,
        position=row.position,
        client=row.client,
        status=row.status,
        recruiter=row.recruiter,
        account_manager=row.account_manager,
        comment=row.comment,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/applications", response_model=List[TrackerApplicationRead])
def list_applications(
    candidate_id: Optional[str] = None,
    job_opening_id: Optional[str] = None,
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    q = select(TrackerApplication)
    if candidate_id:
        q = q.where(TrackerApplication.candidate_id == candidate_id)
    if job_opening_id:
        q = q.where(TrackerApplication.job_opening_id == job_opening_id)
    rows = session.exec(q.order_by(TrackerApplication.created_at.desc())).all()
    return [
        TrackerApplicationRead(
            id=r.id,
            candidate_id=r.candidate_id,
            job_opening_id=r.job_opening_id,
            applied_date=r.applied_date,
            position=r.position,
            client=r.client,
            status=r.status,
            recruiter=r.recruiter,
            account_manager=r.account_manager,
            comment=r.comment,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.patch("/applications/{application_id}", response_model=TrackerApplicationRead)
def update_application(
    application_id: str,
    data: TrackerApplicationUpdate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    row = session.exec(select(TrackerApplication).where(TrackerApplication.id == application_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    _touch_updated_at(row)
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerApplicationRead(
        id=row.id,
        candidate_id=row.candidate_id,
        job_opening_id=row.job_opening_id,
        applied_date=row.applied_date,
        position=row.position,
        client=row.client,
        status=row.status,
        recruiter=row.recruiter,
        account_manager=row.account_manager,
        comment=row.comment,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/skills", response_model=List[TrackerSkillRead])
def list_skills(
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    rows = session.exec(select(TrackerSkill).order_by(TrackerSkill.name.asc())).all()
    return [TrackerSkillRead(id=r.id, name=r.name, created_at=r.created_at) for r in rows]


@router.post("/skills", response_model=TrackerSkillRead, status_code=201)
def create_skill(
    data: TrackerSkillCreate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    existing = session.exec(select(TrackerSkill).where(TrackerSkill.name == data.name)).first()
    if existing:
        return TrackerSkillRead(id=existing.id, name=existing.name, created_at=existing.created_at)
    row = TrackerSkill(name=data.name.strip())
    session.add(row)
    session.commit()
    session.refresh(row)
    return TrackerSkillRead(id=row.id, name=row.name, created_at=row.created_at)


@router.put("/candidates/{candidate_id}/skills", status_code=200)
def set_candidate_skills(
    candidate_id: str,
    data: TrackerCandidateSkillsUpdate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    cand = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == candidate_id)).first()
    if not cand or cand.is_deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")

    desired = [s.strip() for s in (data.skill_names or []) if s and s.strip()]

    # Ensure skills exist
    skill_rows = []
    for name in sorted(set(desired), key=lambda x: x.lower()):
        sk = session.exec(select(TrackerSkill).where(TrackerSkill.name == name)).first()
        if not sk:
            sk = TrackerSkill(name=name)
            session.add(sk)
            session.commit()
            session.refresh(sk)
        skill_rows.append(sk)

    # Replace join table rows
    existing_links = session.exec(
        select(TrackerCandidateSkill).where(TrackerCandidateSkill.candidate_id == candidate_id)
    ).all()
    for link in existing_links:
        session.delete(link)
    session.commit()

    for sk in skill_rows:
        session.add(TrackerCandidateSkill(candidate_id=candidate_id, skill_id=sk.id))
    _touch_updated_at(cand)
    session.add(cand)
    session.commit()
    return {"success": True, "skills": desired}


@router.get("/candidates/{candidate_id}/skills", status_code=200)
def get_candidate_skills(
    candidate_id: str,
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    cand = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == candidate_id)).first()
    if not cand or cand.is_deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")

    links = session.exec(
        select(TrackerCandidateSkill).where(TrackerCandidateSkill.candidate_id == candidate_id)
    ).all()
    if not links:
        return {"skills": []}
    skill_ids = [l.skill_id for l in links]
    skills = session.exec(select(TrackerSkill).where(TrackerSkill.id.in_(skill_ids))).all()
    names = sorted({s.name for s in skills}, key=lambda x: x.lower())
    return {"skills": names}


@router.get("/candidates/{candidate_id}/documents", response_model=List[TrackerDocumentRead])
def list_candidate_documents(
    candidate_id: str,
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    cand = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == candidate_id)).first()
    if not cand or cand.is_deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")
    rows = session.exec(
        select(TrackerDocument)
        .where(TrackerDocument.candidate_id == candidate_id)
        .order_by(TrackerDocument.created_at.desc())
    ).all()
    return [
        TrackerDocumentRead(
            id=r.id,
            candidate_id=r.candidate_id,
            label=r.label,
            url=r.url,
            storage_key=r.storage_key,
            doc_type=r.doc_type,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/candidates/{candidate_id}/documents", response_model=TrackerDocumentRead, status_code=201)
def add_candidate_document(
    candidate_id: str,
    data: TrackerDocumentCreate,
    session: Session = Depends(tracker_session),
    __: User = AllowedTrackerWriteUser,
):
    cand = session.exec(select(TrackerCandidate).where(TrackerCandidate.id == candidate_id)).first()
    if not cand or cand.is_deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not (data.url or data.storage_key):
        raise HTTPException(status_code=400, detail="Provide url or storage_key")
    row = TrackerDocument(
        candidate_id=candidate_id,
        label=data.label,
        url=data.url,
        storage_key=data.storage_key,
        doc_type=data.doc_type,
    )
    session.add(row)
    _touch_updated_at(cand)
    session.add(cand)
    session.commit()
    session.refresh(row)
    return TrackerDocumentRead(
        id=row.id,
        candidate_id=row.candidate_id,
        label=row.label,
        url=row.url,
        storage_key=row.storage_key,
        doc_type=row.doc_type,
        created_at=row.created_at,
    )


@router.get("/export/job-openings.xlsx")
def export_job_openings_xlsx(
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    from io import BytesIO
    from openpyxl import Workbook

    rows = session.exec(
        select(TrackerJobOpening)
        .where(TrackerJobOpening.is_deleted == False)  # noqa: E712
        .order_by(TrackerJobOpening.created_at.desc())
    ).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Requirement Status"
    ws.append(["Date", "Role", "Client", "Recruiter", "Account Manager", "Status"])
    for r in rows:
        ws.append([
            r.req_date.isoformat() if r.req_date else "",
            r.title or "",
            r.location or "",
            r.hiring_manager or "",
            r.department or "",
            r.status or "",
        ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="job_openings.xlsx"'}
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/export/candidates.xlsx")
def export_candidates_xlsx(
    session: Session = Depends(tracker_session),
    _: User = AllowedTrackerReadUser,
):
    from io import BytesIO
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Candidates"
    ws.append(["Date", "Candidate Name", "Position", "Client", "Status", "Recruiter", "Account Manager", "Comment"])

    candidates_by_id = {
        c.id: c
        for c in session.exec(select(TrackerCandidate).where(TrackerCandidate.is_deleted == False)).all()  # noqa: E712
    }
    apps = session.exec(select(TrackerApplication).order_by(TrackerApplication.created_at.desc())).all()

    for a in apps:
        cand = candidates_by_id.get(a.candidate_id)
        if not cand:
            continue
        ws.append(
            [
                a.applied_date.isoformat() if a.applied_date else "",
                cand.name,
                a.position or "",
                a.client or "",
                a.status or "",
                a.recruiter or "",
                a.account_manager or "",
                a.comment or "",
            ]
        )

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="candidates.xlsx"'}
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )

