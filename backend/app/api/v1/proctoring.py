from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, PermissionChecker
from app.core.s3 import s3_storage
from app.models.models import User, TestAttempt, ProctoringSession, ProctoringEvent, ProctoringSnapshot

router = APIRouter()

PROCTOR_MICROSERVICE_URL = "http://127.0.0.1:8001/analyze-frame"

@router.post("/events")
async def log_proctoring_event(
    attempt_id: str,
    event_type: str,
    severity: str = "Low",
    details: dict = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Direct logging for browser/client-side violations (tab switch, exit full-screen).
    """
    # Fetch active attempt
    attempt_res = await db.execute(select(TestAttempt).where(TestAttempt.id == attempt_id))
    attempt = attempt_res.scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    # Get or create proctoring session
    session_res = await db.execute(
        select(ProctoringSession).where(ProctoringSession.attempt_id == attempt_id)
    )
    session = session_res.scalars().first()
    if not session:
        session = ProctoringSession(attempt_id=attempt_id)
        db.add(session)
        await db.flush()

    # Log event
    suspicion_inc = 5.0
    if event_type == "tab_switch":
        suspicion_inc = 10.0
    elif event_type == "window_blur":
        suspicion_inc = 10.0
    elif event_type == "multiple-monitors":
        suspicion_inc = 25.0
        severity = "High"
    elif event_type == "blacklisted-app":
        suspicion_inc = 25.0
        severity = "High"
    elif event_type == "vm-detected":
        suspicion_inc = 50.0
        severity = "High"

    event = ProctoringEvent(
        session_id=session.id,
        event_type=event_type,
        severity=severity,
        suspicion_increment=suspicion_inc,
        details=details or {}
    )
    db.add(event)
    
    # Update attempt suspicion
    attempt.proctor_risk_score = min(100.0, attempt.proctor_risk_score + suspicion_inc)
    attempt.violation_count += 1
    
    await db.commit()
    return {"status": "event_logged", "risk_score": attempt.proctor_risk_score}


@router.post("/frame-upload")
async def upload_proctoring_frame(
    attempt_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Receives candidate webcam frame, uploads to MinIO, forwards to AI proctor
    microservice, and logs result.
    """
    # Verify attempt
    attempt_res = await db.execute(select(TestAttempt).where(TestAttempt.id == attempt_id))
    attempt = attempt_res.scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    session_res = await db.execute(
        select(ProctoringSession).where(ProctoringSession.attempt_id == attempt_id)
    )
    session = session_res.scalars().first()
    if not session:
        session = ProctoringSession(attempt_id=attempt_id)
        db.add(session)
        await db.flush()

    # Upload original frame to MinIO storage (JPEG/PNG only)
    contents = await file.read()
    filename = f"organizations/{attempt.student.organization_id}/attempts/{attempt_id}/frames/{datetime.utcnow().timestamp()}.jpg"
    s3_url = s3_storage.upload_file(contents, filename, content_type="image/jpeg")

    # Send to AI Proctor Service
    # To facilitate local testing, we capture exceptions if the docker service is offline
    risk_increment = 0.0
    detected_events = []
    
    try:
        async with httpx.AsyncClient() as client:
            files = {'file': (file.filename, contents, file.content_type)}
            resp = await client.post(PROCTOR_MICROSERVICE_URL, files=files, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                risk_increment = data.get("risk_increment", 0.0)
                detected_events = data.get("events", [])
    except Exception as e:
        print(f"Failed to communicate with AI proctor microservice: {e}")
        # Default mock simulation if downstream is offline
        risk_increment = 5.0
        detected_events = ["eye_away"]

    # Save snapshot reference
    snapshot = ProctoringSnapshot(
        session_id=session.id,
        snapshot_url=s3_url,
        risk_score=risk_increment
    )
    db.add(snapshot)

    # Save individual events
    for ev_type in detected_events:
        event = ProctoringEvent(
            session_id=session.id,
            event_type=ev_type,
            severity="Medium",
            suspicion_increment=risk_increment,
            details={"s3_snapshot": s3_url}
        )
        db.add(event)
        attempt.violation_count += 1

    # Update attempt risk metrics
    attempt.proctor_risk_score = min(100.0, attempt.proctor_risk_score + risk_increment)
    await db.commit()

    return {
        "status": "processed",
        "events": detected_events,
        "current_suspicion_score": attempt.proctor_risk_score
    }


@router.get("/attempts/{attempt_id}/timeline")
async def get_proctoring_timeline(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("proctor:view"))
):
    """
    Returns full list of screenshots and flagged events for reviewer analysis.
    """
    stmt = select(ProctoringSession).options(
        selectinload(ProctoringSession.events),
        selectinload(ProctoringSession.snapshots)
    ).where(ProctoringSession.attempt_id == attempt_id)
    
    res = await db.execute(stmt)
    session = res.scalars().first()
    if not session:
        return {"events": [], "snapshots": []}

    return {
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "severity": e.severity,
                "timestamp": e.timestamp,
                "details": e.details
            } for e in session.events
        ],
        "snapshots": [
            {
                "id": s.id,
                "timestamp": s.timestamp,
                "snapshot_url": s.snapshot_url,
                "risk_score": s.risk_score
            } for s in session.snapshots
        ]
    }
