from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, PermissionChecker
from app.models.models import User, Question, QuestionOption
from app.schemas.schemas import QuestionCreate, QuestionResponse

router = APIRouter()

@router.post("/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionCreate,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    question = Question(
        topic_id=payload.topic_id,
        difficulty=payload.difficulty,
        type=payload.type,
        question_text=payload.question_text,
        question_image=payload.question_image,
        question_audio=payload.question_audio,
        question_video=payload.question_video,
        question_document=payload.question_document,
        correct_answer=payload.correct_answer,
        explanation=payload.explanation,
        marks=payload.marks,
        negative_marks=payload.negative_marks,
        organization_id=tenant_id
    )
    db.add(question)
    await db.flush()

    for opt_data in payload.options:
        option = QuestionOption(
            question_id=question.id,
            option_text=opt_data.option_text,
            option_image=opt_data.option_image,
            option_audio=opt_data.option_audio,
            option_video=opt_data.option_video,
            is_correct=opt_data.is_correct
        )
        db.add(option)

    await db.commit()
    
    # Reload with options loaded
    result = await db.execute(
        select(Question).options(selectinload(Question.options)).where(Question.id == question.id)
    )
    return result.scalars().first()


@router.get("/", response_model=List[QuestionResponse])
async def list_questions(
    topic_id: Optional[str] = None,
    difficulty: Optional[str] = None,
    q_type: Optional[str] = Query(None, alias="type"),
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Question).options(selectinload(Question.options)).where(Question.organization_id == tenant_id)
    
    if topic_id:
        query = query.where(Question.topic_id == topic_id)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)
    if q_type:
        query = query.where(Question.type == q_type)
        
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.id == question_id, Question.organization_id == tenant_id)
    )
    question = result.scalars().first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    return question


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.organization_id == tenant_id)
    )
    question = result.scalars().first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    await db.delete(question)
    await db.commit()
    return None


# --- Schemas for updating and assigning questions ---
from pydantic import BaseModel

class OptionCreateOrUpdate(BaseModel):
    id: Optional[str] = None
    option_text: Optional[str] = None
    option_image: Optional[str] = None
    option_audio: Optional[str] = None
    option_video: Optional[str] = None
    is_correct: bool = False

class QuestionUpdate(BaseModel):
    topic_id: Optional[str] = None
    difficulty: Optional[str] = None
    type: Optional[str] = None
    question_text: Optional[str] = None
    question_image: Optional[str] = None
    question_audio: Optional[str] = None
    question_video: Optional[str] = None
    question_document: Optional[str] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    marks: Optional[float] = None
    negative_marks: Optional[float] = None
    options: Optional[List[OptionCreateOrUpdate]] = None

class QuestionAssignRequest(BaseModel):
    question_ids: List[str]
    target_organization_ids: List[str]


# --- Endpoints for edit and assign ---

@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    payload: QuestionUpdate,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    # Fetch question
    result = await db.execute(
        select(Question).options(selectinload(Question.options))
        .where(Question.id == question_id, Question.organization_id == tenant_id)
    )
    question = result.scalars().first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
        
    # Update question fields
    if payload.topic_id is not None:
        question.topic_id = payload.topic_id
    if payload.difficulty is not None:
        question.difficulty = payload.difficulty
    if payload.type is not None:
        question.type = payload.type
    if payload.question_text is not None:
        question.question_text = payload.question_text
    if payload.question_image is not None:
        question.question_image = payload.question_image
    if payload.question_audio is not None:
        question.question_audio = payload.question_audio
    if payload.question_video is not None:
        question.question_video = payload.question_video
    if payload.question_document is not None:
        question.question_document = payload.question_document
    if payload.correct_answer is not None:
        question.correct_answer = payload.correct_answer
    if payload.explanation is not None:
        question.explanation = payload.explanation
    if payload.marks is not None:
        question.marks = payload.marks
    if payload.negative_marks is not None:
        question.negative_marks = payload.negative_marks
        
    # Update options if provided
    if payload.options is not None:
        # Delete old options
        for opt in question.options:
            await db.delete(opt)
        await db.flush()
        
        # Add new options
        for opt_data in payload.options:
            new_opt = QuestionOption(
                question_id=question.id,
                option_text=opt_data.option_text,
                option_image=opt_data.option_image,
                option_audio=opt_data.option_audio,
                option_video=opt_data.option_video,
                is_correct=opt_data.is_correct
            )
            db.add(new_opt)
            
    await db.commit()
    
    # Reload question
    reloaded = await db.execute(
        select(Question).options(selectinload(Question.options)).where(Question.id == question_id)
    )
    return reloaded.scalars().first()


@router.post("/assign")
async def assign_questions(
    payload: QuestionAssignRequest,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    from app.models.models import Organization, Subject, Topic
    
    assigned_count = 0
    errors = []
    
    for org_id in payload.target_organization_ids:
        # Verify target organization exists
        org_res = await db.execute(select(Organization).where(Organization.id == org_id))
        org = org_res.scalars().first()
        if not org:
            errors.append(f"Target organization ID {org_id} not found.")
            continue
            
        for q_id in payload.question_ids:
            # Fetch original question (with options, topic, and subject)
            q_res = await db.execute(
                select(Question)
                .options(selectinload(Question.options), selectinload(Question.topic).selectinload(Topic.subject))
                .where(Question.id == q_id, Question.organization_id == tenant_id)
            )
            src_q = q_res.scalars().first()
            if not src_q:
                errors.append(f"Source question ID {q_id} not found in this tenant.")
                continue
                
            # Get original subject & topic name
            src_topic_name = src_q.topic.name if src_q.topic else "General"
            src_subject_name = src_q.topic.subject.name if (src_q.topic and src_q.topic.subject) else "General Subject"
            
            # Resolve target subject in target organization
            tgt_subject_res = await db.execute(
                select(Subject).where(Subject.name == src_subject_name, Subject.organization_id == org_id)
            )
            tgt_sub = tgt_subject_res.scalars().first()
            if not tgt_sub:
                tgt_sub = Subject(name=src_subject_name, organization_id=org_id)
                db.add(tgt_sub)
                await db.flush()
                
            # Resolve target topic in target subject
            tgt_topic_res = await db.execute(
                select(Topic).where(Topic.name == src_topic_name, Topic.subject_id == tgt_sub.id)
            )
            tgt_top = tgt_topic_res.scalars().first()
            if not tgt_top:
                tgt_top = Topic(name=src_topic_name, subject_id=tgt_sub.id)
                db.add(tgt_top)
                await db.flush()
                
            # Duplicate question
            new_q = Question(
                topic_id=tgt_top.id,
                difficulty=src_q.difficulty,
                type=src_q.type,
                question_text=src_q.question_text,
                question_image=src_q.question_image,
                question_audio=src_q.question_audio,
                question_video=src_q.question_video,
                question_document=src_q.question_document,
                correct_answer=src_q.correct_answer,
                explanation=src_q.explanation,
                marks=src_q.marks,
                negative_marks=src_q.negative_marks,
                organization_id=org_id
            )
            db.add(new_q)
            await db.flush()
            
            # Duplicate options
            for opt in src_q.options:
                new_opt = QuestionOption(
                    question_id=new_q.id,
                    option_text=opt.option_text,
                    option_image=opt.option_image,
                    option_audio=opt.option_audio,
                    option_video=opt.option_video,
                    is_correct=opt.is_correct
                )
                db.add(new_opt)
            assigned_count += 1
            
    await db.commit()
    return {
        "status": "success", 
        "assigned_count": assigned_count,
        "errors": errors
    }


from fastapi import UploadFile, File
import uuid
import os
from app.core.s3 import s3_storage

@router.post("/upload-media")
async def upload_question_media(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    # Enforce 50MB limit
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File is too large. Maximum supported size is 50MB."
        )
        
    ext = os.path.splitext(file.filename)[1].lower()
    if not ext:
        ext = ".bin"
        
    filename = f"organizations/{tenant_id}/questions/media/{uuid.uuid4()}{ext}"
    s3_url = s3_storage.upload_file(contents, filename, content_type=file.content_type)
    return {"url": s3_url}


