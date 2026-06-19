from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, PermissionChecker
from app.models.models import (
    User, Assessment, AssessmentSection, AssessmentQuestion, Question,
    TestAssignment, TestAttempt, StudentAnswer, Result, QuestionOption, Student, Organization, Report, Certificate
)
from app.schemas.schemas import AssessmentCreate, AssessmentResponse, AnswerSubmit, TestAttemptResponse

router = APIRouter()

@router.post("/", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: AssessmentCreate,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("assessment:create"))
):
    assessment = Assessment(
        title=payload.title,
        description=payload.description,
        instructions=payload.instructions,
        duration=payload.duration,
        total_marks=payload.total_marks,
        pass_percentage=payload.pass_percentage,
        settings=payload.settings,
        organization_id=tenant_id
    )
    db.add(assessment)
    await db.flush()

    for sec_data in payload.sections:
        section = AssessmentSection(
            assessment_id=assessment.id,
            title=sec_data.title,
            duration_minutes=sec_data.duration_minutes
        )
        db.add(section)

    await db.commit()
    
    # Reload
    result = await db.execute(
        select(Assessment).options(selectinload(Assessment.sections)).where(Assessment.id == assessment.id)
    )
    return result.scalars().first()


@router.get("/", response_model=List[AssessmentResponse])
async def list_assessments(
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Assessment)
        .options(selectinload(Assessment.sections))
        .where(Assessment.organization_id == tenant_id)
    )
    return result.scalars().all()


@router.get("/assignments/my")
async def list_my_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.student_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students have test assignments"
        )
    
    stmt = (
        select(TestAssignment)
        .options(selectinload(TestAssignment.assessment))
        .where(TestAssignment.student_id == current_user.student_profile.id)
    )
    res = await db.execute(stmt)
    assignments = res.scalars().all()
    
    output = []
    for assign in assignments:
        settings = assign.assessment.settings or {}
        output.append({
            "id": assign.id,
            "assessment_id": assign.assessment_id,
            "title": assign.assessment.title,
            "duration": assign.assessment.duration,
            "total_marks": assign.assessment.total_marks,
            "start_date": assign.start_date,
            "end_date": assign.end_date,
            "attempts_count": assign.attempts_count,
            "attempt_limit": assign.attempt_limit,
            "status": assign.status,
            "lockdown_browser_required": settings.get("lockdown_browser_required", False),
            "proctoring_enabled": settings.get("proctoring_enabled", False)
        })
    return output


@router.get("/attempts/all")
async def list_all_attempts(
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(TestAttempt)
        .options(
            selectinload(TestAttempt.assessment),
            selectinload(TestAttempt.student).selectinload(Student.user),
            selectinload(TestAttempt.student).selectinload(Student.department),
            selectinload(TestAttempt.result),
            selectinload(TestAttempt.report),
            selectinload(TestAttempt.assignment).selectinload(TestAssignment.batch)
        )
        .join(Assessment)
    )
    
    if current_user.role.code != "SUPER_ADMIN":
        # Resolve tenant ID from user
        tenant_id = current_user.organization_id
        stmt = stmt.where(Assessment.organization_id == tenant_id)
    else:
        # Super Admin can filter by specific organization (college / company)
        if org_id:
            stmt = stmt.where(Assessment.organization_id == org_id)
            
    res = await db.execute(stmt)
    attempts = res.scalars().all()
    
    output = []
    for att in attempts:
        org_name = "Unknown"
        if att.assessment and att.assessment.organization_id:
            org_res = await db.execute(select(Organization).where(Organization.id == att.assessment.organization_id))
            org = org_res.scalars().first()
            org_name = org.name if org else "Unknown"

        score = att.result.total_score if att.result else None
        percentage = att.result.percentage if att.result else None
        pass_fail = att.result.pass_fail if att.result else None
        report_url = att.report.file_url if att.report else None
        batch_name = att.assignment.batch.name if (att.assignment and att.assignment.batch) else "No Batch"
        department_name = att.student.department.name if (att.student and att.student.department) else "No Department"
        email = att.student.user.email if (att.student and att.student.user) else ""

        output.append({
            "id": att.id,
            "student_name": att.student.user.full_name if att.student and att.student.user else "Unknown Student",
            "student_email": email,
            "assessment_title": att.assessment.title,
            "status": att.status,
            "started_at": att.started_at,
            "submitted_at": att.submitted_at,
            "proctor_risk_score": att.proctor_risk_score,
            "violation_count": att.violation_count,
            "organization_id": att.assessment.organization_id if att.assessment else None,
            "organization_name": org_name,
            "score": score,
            "percentage": percentage,
            "pass_fail": pass_fail,
            "report_url": report_url,
            "batch_name": batch_name,
            "department_name": department_name,
            "secure_browser_used": att.secure_browser_used,
            "secure_browser_version": att.secure_browser_version
        })
    return output


@router.get("/attempts/{attempt_id}/scorecard")
async def get_attempt_scorecard(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve attempt with full relational detail
    stmt = (
        select(TestAttempt)
        .options(
            selectinload(TestAttempt.assessment).selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(AssessmentQuestion.question).selectinload(Question.options),
            selectinload(TestAttempt.student).selectinload(Student.user),
            selectinload(TestAttempt.student).selectinload(Student.department),
            selectinload(TestAttempt.result),
            selectinload(TestAttempt.report),
            selectinload(TestAttempt.assignment).selectinload(TestAssignment.batch),
            selectinload(TestAttempt.answers)
        )
        .where(TestAttempt.id == attempt_id)
    )
    res = await db.execute(stmt)
    attempt = res.scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    # Check permissions (superadmin or tenant check)
    if current_user.role.code != "SUPER_ADMIN":
        if attempt.assessment.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Permission denied")
            
    # Resolve org name
    org_res = await db.execute(select(Organization).where(Organization.id == attempt.assessment.organization_id))
    org = org_res.scalars().first()
    org_name = org.name if org else "Unknown"

    # Map student answers
    answers_map = {ans.question_id: ans for ans in attempt.answers}
    
    sections_output = []
    for section in attempt.assessment.sections:
        questions_output = []
        # Sort by order_number
        for aq in sorted(section.questions, key=lambda x: x.order_number or 0):
            q = aq.question
            ans = answers_map.get(q.id)
            
            selected_option = None
            if ans and ans.selected_option_id:
                for opt in q.options:
                    if opt.id == ans.selected_option_id:
                        selected_option = opt.option_text
                        break
                        
            questions_output.append({
                "id": q.id,
                "type": q.type,
                "question_text": q.question_text,
                "difficulty": q.difficulty,
                "marks": q.marks,
                "negative_marks": q.negative_marks,
                "explanation": q.explanation,
                "options": [{"id": opt.id, "text": opt.option_text, "is_correct": opt.is_correct} for opt in q.options],
                "student_answer": {
                    "selected_option_id": ans.selected_option_id if ans else None,
                    "selected_option_text": selected_option,
                    "answer_text": ans.answer_text if ans else None,
                    "time_spent_seconds": ans.time_spent_seconds if ans else 0,
                    "is_correct": ans.is_correct if ans else False,
                    "marks_obtained": ans.marks_obtained if ans else 0.0,
                    "uploaded_media_url": ans.uploaded_media_url if ans else None
                }
            })
            
        sections_output.append({
            "id": section.id,
            "title": section.title,
            "duration_minutes": section.duration_minutes,
            "questions": questions_output
        })

    # Fetch certificate link if any
    cert_stmt = select(Certificate).where(
        Certificate.student_id == attempt.student_id,
        Certificate.assessment_id == attempt.assessment_id
    )
    cert_res = await db.execute(cert_stmt)
    cert = cert_res.scalars().first()
    
    # Fetch proctoring logs timeline
    from app.models.models import ProctoringSession
    proc_stmt = select(ProctoringSession).options(
        selectinload(ProctoringSession.events),
        selectinload(ProctoringSession.snapshots)
    ).where(ProctoringSession.attempt_id == attempt_id)
    proc_res = await db.execute(proc_stmt)
    proc_session = proc_res.scalars().first()
    
    proctoring_data = {"events": [], "snapshots": []}
    if proc_session:
        proctoring_data = {
            "events": [
                {
                    "id": e.id,
                    "event_type": e.event_type,
                    "severity": e.severity,
                    "timestamp": e.timestamp,
                    "details": e.details
                } for e in proc_session.events
            ],
            "snapshots": [
                {
                    "id": s.id,
                    "timestamp": s.timestamp,
                    "snapshot_url": s.snapshot_url,
                    "risk_score": s.risk_score
                } for s in proc_session.snapshots
            ]
        }

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "proctor_risk_score": attempt.proctor_risk_score,
        "violation_count": attempt.violation_count,
        "candidate": {
            "name": attempt.student.user.full_name if attempt.student and attempt.student.user else "Unknown Student",
            "email": attempt.student.user.email if attempt.student and attempt.student.user else "",
            "registration_number": attempt.student.registration_number if attempt.student else "",
            "designation": attempt.student.designation if attempt.student else "",
            "department": attempt.student.department.name if attempt.student and attempt.student.department else "No Department",
            "batch": attempt.assignment.batch.name if attempt.assignment and attempt.assignment.batch else "No Batch",
            "organization_name": org_name
        },
        "assessment": {
            "title": attempt.assessment.title,
            "total_marks": attempt.assessment.total_marks,
            "pass_percentage": attempt.assessment.pass_percentage,
            "duration": attempt.assessment.duration
        },
        "result": {
            "score": attempt.result.total_score if attempt.result else 0.0,
            "percentage": attempt.result.percentage if attempt.result else 0.0,
            "passed": attempt.result.pass_fail if attempt.result else False,
            "ranking": attempt.result.ranking if attempt.result else None,
            "percentile": attempt.result.percentile if attempt.result else None
        },
        "report_url": attempt.report.file_url if attempt.report else None,
        "certificate_url": cert.file_url if cert else None,
        "secure_browser_used": attempt.secure_browser_used,
        "secure_browser_version": attempt.secure_browser_version,
        "sections": sections_output,
        "proctoring": proctoring_data
    }




@router.post("/assign", status_code=status.HTTP_200_OK)
async def assign_assessment(
    assessment_id: str,
    student_ids: List[str],
    batch_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    attempt_limit: int = 1,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("assessment:publish"))
):
    # Verify assessment
    result = await db.execute(
        select(Assessment).where(Assessment.id == assessment_id, Assessment.organization_id == tenant_id)
    )
    assessment = result.scalars().first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
        
    for student_id in student_ids:
        assignment = TestAssignment(
            assessment_id=assessment_id,
            student_id=student_id,
            batch_id=batch_id,
            start_date=start_date,
            end_date=end_date,
            attempt_limit=attempt_limit
        )
        db.add(assignment)
        
    await db.commit()
    return {"message": f"Successfully assigned assessment to {len(student_ids)} students."}


@router.post("/attempts/start", response_model=TestAttemptResponse)
async def start_attempt(
    assignment_id: str,
    secure_browser: bool = False,
    secure_browser_version: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve student profile
    if not current_user.student_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered students can take assessments"
        )

    # Check assignment eligibility
    stmt = select(TestAssignment).options(
        selectinload(TestAssignment.assessment)
    ).where(
        TestAssignment.id == assignment_id,
        TestAssignment.student_id == current_user.student_profile.id
    )
    res = await db.execute(stmt)
    assignment = res.scalars().first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test assignment not found"
        )

    # Enforce lockdown browser if required
    settings = assignment.assessment.settings or {}
    if settings.get("lockdown_browser_required", False) and not secure_browser:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment requires the Bluebirds Secure Lockdown Browser to be started."
        )

    # Check window
    now = datetime.utcnow()
    if assignment.start_date and assignment.start_date > now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment slot has not started yet"
        )
    if assignment.end_date and assignment.end_date < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment window has closed"
        )

    # Check limits
    if assignment.attempts_count >= assignment.attempt_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum attempt limit reached for this assessment"
        )

    # Create new attempt
    attempt = TestAttempt(
        assignment_id=assignment.id,
        student_id=current_user.student_profile.id,
        assessment_id=assignment.assessment_id,
        status="In_Progress",
        started_at=datetime.utcnow(),
        secure_browser_used=secure_browser,
        secure_browser_version=secure_browser_version
    )
    
    # Increment assignment counter
    assignment.attempts_count += 1
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


@router.post("/attempts/{attempt_id}/save-answer", status_code=status.HTTP_200_OK)
async def save_answer(
    attempt_id: str,
    payload: AnswerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify attempt owner
    res = await db.execute(select(TestAttempt).where(TestAttempt.id == attempt_id))
    attempt = res.scalars().first()
    if not attempt or attempt.student_id != current_user.student_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid attempt context or permission denied"
        )
        
    if attempt.status != "In_Progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment attempt has already been submitted"
        )

    # Upsert answer
    ans_stmt = select(StudentAnswer).where(
        StudentAnswer.attempt_id == attempt_id,
        StudentAnswer.question_id == payload.question_id
    )
    ans_res = await db.execute(ans_stmt)
    answer = ans_res.scalars().first()

    if not answer:
        answer = StudentAnswer(
            attempt_id=attempt_id,
            question_id=payload.question_id
        )
        db.add(answer)

    answer.selected_option_id = payload.selected_option_id
    answer.answer_text = payload.answer_text
    answer.time_spent_seconds = payload.time_spent_seconds
    answer.uploaded_media_url = payload.uploaded_media_url

    # Save state tracker for connection drops
    state = dict(attempt.client_state or {})
    state[payload.question_id] = {
        "selected_option_id": payload.selected_option_id,
        "answer_text": payload.answer_text,
        "time_spent": payload.time_spent_seconds
    }
    attempt.client_state = state

    await db.commit()
    return {"status": "saved"}


@router.post("/attempts/{attempt_id}/submit", status_code=status.HTTP_200_OK)
async def submit_attempt(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch attempt and questions to compute MCQ auto-score
    res = await db.execute(
        select(TestAttempt)
        .options(selectinload(TestAttempt.assessment).selectinload(Assessment.sections).selectinload(AssessmentSection.questions))
        .where(TestAttempt.id == attempt_id)
    )
    attempt = res.scalars().first()
    
    if not attempt or attempt.student_id != current_user.student_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attempt context not found or permission denied"
        )
        
    if attempt.status != "In_Progress":
        return {"status": attempt.status, "message": "Attempt already submitted"}

    # Update attempt status
    attempt.status = "Submitted"
    attempt.submitted_at = datetime.utcnow()

    # Load all submitted answers for this attempt
    ans_res = await db.execute(
        select(StudentAnswer).where(StudentAnswer.attempt_id == attempt_id)
    )
    answers = {a.question_id: a for a in ans_res.scalars().all()}

    # Auto grade MCQs
    total_score = 0.0
    
    # Loop over all assessment questions
    for section in attempt.assessment.sections:
        for aq in section.questions:
            q_id = aq.question_id
            
            # Fetch question options to determine correctness
            q_res = await db.execute(
                select(Question)
                .options(selectinload(Question.options))
                .where(Question.id == q_id)
            )
            question = q_res.scalars().first()
            if not question:
                continue

            ans = answers.get(q_id)
            if not ans:
                continue

            # Auto grade if MCQ
            if question.type in ("mcq_single", "mcq_multi", "audio_mcq", "video_mcq"):
                correct_option_ids = {opt.id for opt in question.options if opt.is_correct}
                
                is_correct = False
                if question.type == "mcq_single":
                    is_correct = ans.selected_option_id in correct_option_ids
                else:
                    # multi-correct (split or check mapping if multiple option IDs submitted in text/payload)
                    # For simplicity, if selected_option_id matches one of correct options
                    is_correct = ans.selected_option_id in correct_option_ids
                
                ans.is_correct = is_correct
                if is_correct:
                    ans.marks_obtained = question.marks
                    total_score += question.marks
                else:
                    ans.marks_obtained = -question.negative_marks
                    total_score -= question.negative_marks
            elif question.type in ("fill_blank", "true_false"):
                # Direct match with correct_answer string
                is_correct = str(ans.answer_text).strip().lower() == str(question.correct_answer).strip().lower()
                ans.is_correct = is_correct
                if is_correct:
                    ans.marks_obtained = question.marks
                    total_score += question.marks
                else:
                    ans.marks_obtained = -question.negative_marks
                    total_score -= question.negative_marks

    # Compute percentage
    total_score = max(0.0, total_score)  # Prevent negative total score
    max_possible_marks = attempt.assessment.total_marks
    percentage = (total_score / max_possible_marks * 100) if max_possible_marks > 0 else 0.0
    pass_fail = percentage >= attempt.assessment.pass_percentage

    # Create result log
    result = Result(
        attempt_id=attempt.id,
        total_score=total_score,
        percentage=percentage,
        pass_fail=pass_fail
    )
    db.add(result)
    await db.commit()

    # Trigger Celery Background Workers
    from app.tasks.report_tasks import generate_attempt_pdf_report, generate_certificate_task
    try:
        generate_attempt_pdf_report.delay(attempt.id)
        if pass_fail:
            generate_certificate_task.delay(attempt.id)
    except Exception as e:
        print(f"Failed to dispatch Celery tasks (is redis running?): {e}")

    return {
        "status": "Submitted",
        "score": total_score,
        "percentage": percentage,
        "passed": pass_fail
    }


@router.post("/attempts/{attempt_id}/run-code", status_code=status.HTTP_200_OK)
async def run_attempt_code(
    attempt_id: str,
    question_id: str,
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(TestAttempt).where(TestAttempt.id == attempt_id))
    attempt = res.scalars().first()
    if not attempt or attempt.student_id != current_user.student_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )
    
    q_res = await db.execute(select(Question).where(Question.id == question_id))
    question = q_res.scalars().first()
    if not question or question.type != "coding":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid coding question not found"
        )
    
    from app.services.code_sandbox import CodeSandboxService
    sample_cases = [
        {"input": "hello", "expected_output": "olleh"}
    ]
    return CodeSandboxService.run_python_code(code, sample_cases)


@router.get("/attempts/{attempt_id}/questions")
async def get_attempt_questions(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify student context
    if not current_user.student_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered students can access attempt questions"
        )

    # Retrieve attempt with full relational detail
    stmt = (
        select(TestAttempt)
        .options(
            selectinload(TestAttempt.assessment)
            .selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(AssessmentQuestion.question)
            .selectinload(Question.options)
        )
        .where(TestAttempt.id == attempt_id, TestAttempt.student_id == current_user.student_profile.id)
    )
    res = await db.execute(stmt)
    attempt = res.scalars().first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test attempt not found or permission denied"
        )

    if attempt.status != "In_Progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment attempt has already been submitted or evaluated"
        )

    # Collect questions from all sections
    questions_data = []
    for section in attempt.assessment.sections:
        for aq in section.questions:
            q = aq.question
            if not q:
                continue
            options = []
            for opt in q.options:
                options.append({
                    "id": opt.id,
                    "option_text": opt.option_text,
                    "option_image": opt.option_image,
                    "option_audio": opt.option_audio,
                    "option_video": opt.option_video
                })
            questions_data.append({
                "id": q.id,
                "type": q.type,
                "question_text": q.question_text,
                "question_image": q.question_image,
                "question_audio": q.question_audio,
                "question_video": q.question_video,
                "question_document": q.question_document,
                "options": options
            })
            
    elapsed_seconds = (datetime.utcnow() - attempt.started_at).total_seconds()
    duration_seconds = attempt.assessment.duration * 60
    remaining_seconds = max(0, int(duration_seconds - elapsed_seconds))

    return {
        "id": attempt.id,
        "assessment_title": attempt.assessment.title,
        "duration": attempt.assessment.duration,
        "remaining_seconds": remaining_seconds,
        "client_state": attempt.client_state or {},
        "questions": questions_data
    }

