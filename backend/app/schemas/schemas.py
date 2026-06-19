from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# --- AUTH SCHEMAS ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    type: Optional[str] = None


# --- TENANT SCHEMAS ---

class OrganizationBase(BaseModel):
    name: str
    slug: str
    domain: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class OrganizationSettingsUpdate(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(None, max_length=7)
    secondary_color: Optional[str] = Field(None, max_length=7)
    email_template_sender: Optional[str] = None
    privacy_policy_url: Optional[str] = None
    terms_url: Optional[str] = None


# --- USER & PROFILE SCHEMAS ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    mobile: Optional[str] = None
    role_id: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    organization_id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization_id: str
    organization_slug: Optional[str] = None

    class Config:
        from_attributes = True


# --- QUESTIONS & MEDIA SCHEMAS ---

class QuestionOptionBase(BaseModel):
    option_text: Optional[str] = None
    option_image: Optional[str] = None
    option_audio: Optional[str] = None
    option_video: Optional[str] = None
    is_correct: bool = False

class QuestionOptionCreate(QuestionOptionBase):
    pass

class QuestionOptionResponse(QuestionOptionBase):
    id: str

    class Config:
        from_attributes = True

class QuestionBase(BaseModel):
    topic_id: str
    difficulty: str = "Medium"
    type: str
    question_text: str
    question_image: Optional[str] = None
    question_audio: Optional[str] = None
    question_video: Optional[str] = None
    question_document: Optional[str] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    marks: float = 1.0
    negative_marks: float = 0.0

class QuestionCreate(QuestionBase):
    options: List[QuestionOptionCreate] = []

class QuestionResponse(QuestionBase):
    id: str
    organization_id: str
    options: List[QuestionOptionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# --- ASSESSMENT SCHEMAS ---

class AssessmentSectionBase(BaseModel):
    title: str
    duration_minutes: Optional[int] = None

class AssessmentSectionCreate(AssessmentSectionBase):
    pass

class AssessmentSectionResponse(AssessmentSectionBase):
    id: str
    
    class Config:
        from_attributes = True

class AssessmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration: int = 60
    total_marks: float = 100.0
    pass_percentage: float = 40.0
    settings: Dict[str, Any] = Field(default_factory=dict)

class AssessmentCreate(AssessmentBase):
    sections: List[AssessmentSectionCreate] = []

class AssessmentResponse(AssessmentBase):
    id: str
    organization_id: str
    is_published: bool
    created_at: datetime
    sections: List[AssessmentSectionResponse] = []

    class Config:
        from_attributes = True


# --- TEST ATTEMPT SCHEMAS ---

class AnswerSubmit(BaseModel):
    question_id: str
    selected_option_id: Optional[str] = None
    answer_text: Optional[str] = None
    time_spent_seconds: int = 0
    uploaded_media_url: Optional[str] = None

class TestAttemptBase(BaseModel):
    assignment_id: str

class TestAttemptResponse(BaseModel):
    id: str
    student_id: str
    assessment_id: str
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    proctor_risk_score: float
    violation_count: int
    client_state: Dict[str, Any]
    secure_browser_used: bool = False
    secure_browser_version: Optional[str] = None

    class Config:
        from_attributes = True


# --- SAP INTEGRATION SCHEMAS ---

class SAPConfigBase(BaseModel):
    system_type: str = "SuccessFactors"
    base_url: str
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    oauth_token_url: Optional[str] = None
    employee_endpoint: Optional[str] = None
    candidate_endpoint: Optional[str] = None
    result_update_endpoint: Optional[str] = None
    certificate_update_endpoint: Optional[str] = None
    sync_frequency: str = "Daily"
    is_active: bool = True

class SAPConfigCreate(SAPConfigBase):
    pass

class SAPConfigResponse(SAPConfigBase):
    id: str
    organization_id: str

    class Config:
        from_attributes = True
