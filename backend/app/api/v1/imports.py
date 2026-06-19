import shutil
import tempfile
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, PermissionChecker
from app.models.models import User
from app.services.import_engine import ImportEngineService

router = APIRouter()

@router.post("/zip", status_code=status.HTTP_201_CREATED)
async def import_questions_from_zip(
    topic_id: str = Query(...),
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a ZIP container archive"
        )
        
    temp_fd, temp_path = tempfile.mkstemp(suffix=".zip")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        result = await ImportEngineService.process_zip_import(
            zip_file_path=temp_path,
            organization_id=tenant_id,
            topic_id=topic_id,
            db=db
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )
    finally:
        os.close(temp_fd)
        if os.path.exists(temp_path):
            os.remove(temp_path)

# --- Schemas for committing questions ---
from pydantic import BaseModel
from typing import List, Optional

class OptionCommit(BaseModel):
    option_text: str
    is_correct: bool = False

class QuestionCommit(BaseModel):
    question_text: str
    difficulty: str = "Medium"
    type: str = "mcq_single"
    options: List[OptionCommit] = []
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    marks: float = 1.0
    negative_marks: float = 0.0

class CommitRequest(BaseModel):
    topic_id: str
    questions: List[QuestionCommit]

# --- Endpoints for file preview & commit ---

@router.post("/preview-file")
async def preview_file(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".docx", ".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a Microsoft Word (.docx) or PDF (.pdf) file."
        )
        
    temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if ext == ".docx":
            questions = ImportEngineService.parse_docx_questions(temp_path)
        else:
            questions = ImportEngineService.parse_pdf_questions(temp_path)
            
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parsing failed: {str(e)}"
        )
    finally:
        os.close(temp_fd)
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/commit-questions", status_code=status.HTTP_201_CREATED)
async def commit_questions(
    payload: CommitRequest,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("question:create"))
):
    from app.models.models import Question, QuestionOption
    
    created_count = 0
    try:
        for q_data in payload.questions:
            question = Question(
                topic_id=payload.topic_id,
                difficulty=q_data.difficulty,
                type=q_data.type,
                question_text=q_data.question_text,
                correct_answer=q_data.correct_answer,
                explanation=q_data.explanation,
                marks=q_data.marks,
                negative_marks=q_data.negative_marks,
                organization_id=tenant_id
            )
            db.add(question)
            await db.flush()
            
            for opt_data in q_data.options:
                option = QuestionOption(
                    question_id=question.id,
                    option_text=opt_data.option_text,
                    is_correct=opt_data.is_correct
                )
                db.add(option)
            created_count += 1
            
        await db.commit()
        return {"status": "success", "created_count": created_count}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database commit failed: {str(e)}"
        )

