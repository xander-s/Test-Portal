import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, Float, DateTime, ForeignKey, Text, JSON, Table
from sqlalchemy.orm import relationship
from app.core.database import Base

# --- ASSOCIATION TABLES ---

batch_students = Table(
    "batch_students",
    Base.metadata,
    Column("batch_id", String(36), ForeignKey("batches.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", String(36), ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", String(36), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
)

# --- SaaS TENANT MODELS ---

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    domain = Column(String(255), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    settings = relationship("OrganizationSetting", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    batches = relationship("Batch", back_populates="organization", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="organization", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="organization", cascade="all, delete-orphan")
    assessments = relationship("Assessment", back_populates="organization", cascade="all, delete-orphan")
    subscriptions = relationship("OrganizationSubscription", back_populates="organization", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="organization", cascade="all, delete-orphan")
    sap_configs = relationship("SAPConfig", back_populates="organization", cascade="all, delete-orphan")
    sap_mappings = relationship("SAPFieldMapping", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")
    media_files = relationship("MediaFile", back_populates="organization", cascade="all, delete-orphan")
    import_jobs = relationship("ImportJob", back_populates="organization", cascade="all, delete-orphan")


class OrganizationSetting(Base):
    __tablename__ = "organization_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    logo_url = Column(String(1024), nullable=True)
    brand_name = Column(String(255), nullable=True)
    primary_color = Column(String(7), default="#4F46E5")  # Tailwind Indigo 600
    secondary_color = Column(String(7), default="#10B981")  # Tailwind Emerald 500
    email_template_sender = Column(String(255), nullable=True)
    custom_domain = Column(String(255), nullable=True)
    privacy_policy_url = Column(String(1024), nullable=True)
    terms_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="settings")


# --- AUTH & ACCESS CONTROL MODELS ---

class Role(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

    # Relationships
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users = relationship("User", back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    mobile = Column(String(50), nullable=True)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    lock_until = Column(DateTime, nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    role = relationship("Role", back_populates="users")
    student_profile = relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")
    trainer_profile = relationship("Trainer", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


# --- STUDENT & BATCH MANAGEMENT ---

class Department(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="departments")
    batches = relationship("Batch", back_populates="department", cascade="all, delete-orphan")
    students = relationship("Student", back_populates="department")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="batches")
    department = relationship("Department", back_populates="batches")
    students = relationship("Student", secondary=batch_students, back_populates="batches")


class Student(Base):
    __tablename__ = "students"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    registration_number = Column(String(100), unique=True, nullable=True, index=True)
    sap_employee_id = Column(String(100), unique=True, nullable=True, index=True)
    designation = Column(String(255), nullable=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="student_profile")
    department = relationship("Department", back_populates="students")
    batches = relationship("Batch", secondary=batch_students, back_populates="students")
    organization = relationship("Organization")
    assignments = relationship("TestAssignment", back_populates="student", cascade="all, delete-orphan")
    attempts = relationship("TestAttempt", back_populates="student", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="student", cascade="all, delete-orphan")
    sap_links = relationship("SAPEmployeeLink", back_populates="student", cascade="all, delete-orphan")


class Trainer(Base):
    __tablename__ = "trainers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="trainer_profile")
    organization = relationship("Organization")


# --- QUESTIONS & MEDIA MANAGEMENT ---

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="subjects")
    topics = relationship("Topic", back_populates="subject", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    subject = relationship("Subject", back_populates="topics")
    questions = relationship("Question", back_populates="topic")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    difficulty = Column(String(50), default="Medium")  # Easy, Medium, Hard
    type = Column(String(100), nullable=False)  # mcq_single, mcq_multi, text, fill_blank, coding, speaking, video_response, audio_mcq, video_mcq, image_q, pdf_q
    question_text = Column(Text, nullable=False)
    question_image = Column(String(1024), nullable=True)
    question_audio = Column(String(1024), nullable=True)
    question_video = Column(String(1024), nullable=True)
    question_document = Column(String(1024), nullable=True)
    correct_answer = Column(Text, nullable=True)  # For non-MCQ direct matching (e.g. fill blanks)
    explanation = Column(Text, nullable=True)
    marks = Column(Float, default=1.0)
    negative_marks = Column(Float, default=0.0)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="questions")
    topic = relationship("Topic", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_text = Column(Text, nullable=True)
    option_image = Column(String(1024), nullable=True)
    option_audio = Column(String(1024), nullable=True)
    option_video = Column(String(1024), nullable=True)
    is_correct = Column(Boolean, default=False)

    # Relationships
    question = relationship("Question", back_populates="options")


# --- ASSESSMENT & ATTEMPT SERVICE ---

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    duration = Column(Integer, default=60)  # minutes
    total_marks = Column(Float, default=100.0)
    pass_percentage = Column(Float, default=40.0)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    settings = Column(JSON, default=dict)  # Stores: randomize_questions, proctoring_enabled, tab_switch_limit, etc.
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="assessments")
    sections = relationship("AssessmentSection", back_populates="assessment", cascade="all, delete-orphan")
    assignments = relationship("TestAssignment", back_populates="assessment", cascade="all, delete-orphan")
    attempts = relationship("TestAttempt", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentSection(Base):
    __tablename__ = "assessment_sections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assessment = relationship("Assessment", back_populates="sections")
    questions = relationship("AssessmentQuestion", back_populates="section", cascade="all, delete-orphan")


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    section_id = Column(String(36), ForeignKey("assessment_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    order_number = Column(Integer, default=0)

    # Relationships
    section = relationship("AssessmentSection", back_populates="questions")
    question = relationship("Question")


class TestAssignment(Base):
    __tablename__ = "test_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id = Column(String(36), ForeignKey("batches.id"), nullable=True)
    status = Column(String(50), default="Assigned")  # Assigned, Completed, Expired
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    attempt_limit = Column(Integer, default=1)
    attempts_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assessment = relationship("Assessment", back_populates="assignments")
    student = relationship("Student", back_populates="assignments")
    attempts = relationship("TestAttempt", back_populates="assignment", cascade="all, delete-orphan")
    batch = relationship("Batch")


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String(36), ForeignKey("test_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="In_Progress")  # In_Progress, Submitted, Evaluated, Cancelled
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    proctor_risk_score = Column(Float, default=0.0)
    violation_count = Column(Integer, default=0)
    client_state = Column(JSON, default=dict)  # Periodically auto-saves student draft progress here
    secure_browser_used = Column(Boolean, default=False)
    secure_browser_version = Column(String(50), nullable=True)

    # Relationships
    assignment = relationship("TestAssignment", back_populates="attempts")
    student = relationship("Student", back_populates="attempts")
    assessment = relationship("Assessment", back_populates="attempts")
    answers = relationship("StudentAnswer", back_populates="attempt", cascade="all, delete-orphan")
    result = relationship("Result", back_populates="attempt", uselist=False, cascade="all, delete-orphan")
    report = relationship("Report", back_populates="attempt", uselist=False, cascade="all, delete-orphan")
    proctoring_sessions = relationship("ProctoringSession", back_populates="attempt", cascade="all, delete-orphan")
    ai_summaries = relationship("AIReportSummary", back_populates="attempt", cascade="all, delete-orphan")


class StudentAnswer(Base):
    __tablename__ = "student_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    selected_option_id = Column(String(36), ForeignKey("question_options.id"), nullable=True)
    answer_text = Column(Text, nullable=True)  # For text, coding, descriptive, speaking, etc.
    is_correct = Column(Boolean, nullable=True)
    marks_obtained = Column(Float, default=0.0)
    time_spent_seconds = Column(Integer, default=0)
    uploaded_media_url = Column(String(1024), nullable=True)  # Speaking audio response or video response
    reviewer_comments = Column(Text, nullable=True)

    # Relationships
    attempt = relationship("TestAttempt", back_populates="answers")
    question = relationship("Question")
    option = relationship("QuestionOption")


# --- RESULTS, CERTIFICATES & REPORTS ---

class Result(Base):
    __tablename__ = "results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    total_score = Column(Float, default=0.0)
    percentage = Column(Float, default=0.0)
    pass_fail = Column(Boolean, default=False)
    ranking = Column(Integer, nullable=True)
    percentile = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    attempt = relationship("TestAttempt", back_populates="result")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    file_url = Column(String(1024), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    attempt = relationship("TestAttempt", back_populates="report")


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    certificate_number = Column(String(100), unique=True, nullable=False, index=True)
    qr_code_url = Column(String(1024), nullable=True)
    issue_date = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=True)
    file_url = Column(String(1024), nullable=False)
    sap_sync_status = Column(String(50), default="Pending")  # Pending, Synced, Failed
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="certificates")
    assessment = relationship("Assessment")


# --- AI PROCTORING SERVICE ---

class ProctoringSession(Base):
    __tablename__ = "proctoring_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="Active")  # Active, Completed

    # Relationships
    attempt = relationship("TestAttempt", back_populates="proctoring_sessions")
    events = relationship("ProctoringEvent", back_populates="session", cascade="all, delete-orphan")
    snapshots = relationship("ProctoringSnapshot", back_populates="session", cascade="all, delete-orphan")


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("proctoring_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)  # tab_switch, eye_away, no_face, multiple_faces, speaking
    severity = Column(String(50), default="Low")  # Low, Medium, High
    timestamp = Column(DateTime, default=datetime.utcnow)
    suspicion_increment = Column(Float, default=0.0)
    details = Column(JSON, default=dict)

    # Relationships
    session = relationship("ProctoringSession", back_populates="events")


class ProctoringSnapshot(Base):
    __tablename__ = "proctoring_snapshots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("proctoring_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    snapshot_url = Column(String(1024), nullable=False)
    risk_score = Column(Float, default=0.0)

    # Relationships
    session = relationship("ProctoringSession", back_populates="snapshots")


# --- SAP INTEGRATION ---

class SAPConfig(Base):
    __tablename__ = "sap_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    system_type = Column(String(100), default="SuccessFactors")  # SuccessFactors, HCM, S4HANA
    base_url = Column(String(1024), nullable=False)
    client_id = Column(String(255), nullable=True)
    client_secret = Column(String(512), nullable=True)
    oauth_token_url = Column(String(1024), nullable=True)
    employee_endpoint = Column(String(1024), nullable=True)
    candidate_endpoint = Column(String(1024), nullable=True)
    result_update_endpoint = Column(String(1024), nullable=True)
    certificate_update_endpoint = Column(String(1024), nullable=True)
    sync_frequency = Column(String(100), default="Daily")  # Hourly, Daily, Weekly
    is_active = Column(Boolean, default=True)

    # Relationships
    organization = relationship("Organization", back_populates="sap_configs")


class SAPFieldMapping(Base):
    __tablename__ = "sap_field_mappings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    portal_field = Column(String(100), nullable=False)
    sap_field = Column(String(100), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="sap_mappings")


class SAPSyncLog(Base):
    __tablename__ = "sap_sync_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    sync_type = Column(String(100), nullable=False)  # Employee, Candidate
    status = Column(String(50), nullable=False)  # Success, Failure
    records_processed = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    sync_time = Column(DateTime, default=datetime.utcnow)


class SAPEmployeeLink(Base):
    __tablename__ = "sap_employee_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    sap_employee_id = Column(String(100), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    student = relationship("Student", back_populates="sap_links")


class SAPResultPushLog(Base):
    __tablename__ = "sap_result_push_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False)  # Success, Failure
    payload = Column(JSON, default=dict)
    response = Column(JSON, default=dict)
    pushed_at = Column(DateTime, default=datetime.utcnow)


# --- BILLING & SUBSCRIPTIONS ---

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    code = Column(String(100), unique=True, nullable=False, index=True)  # starter, pro, enterprise
    description = Column(String(255), nullable=True)
    price = Column(Float, default=0.0)
    features = Column(JSON, default=dict)  # max_students, max_tests, proctoring_enabled, etc.


class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(String(36), ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(String(50), default="Active")  # Active, Cancelled, Expired
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String(50), default="Pending")  # Pending, Paid, Void
    invoice_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_gateway = Column(String(100), default="Stripe")  # Stripe, Razorpay
    transaction_id = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(50), default="Completed")
    paid_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")


# --- INTERNAL AI SERVICES ---

class AIJob(Base):
    __tablename__ = "ai_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(100), nullable=False)  # question_generation, report_analysis, plagiarism_detect
    status = Column(String(50), default="Pending")  # Pending, Processing, Completed, Failed
    payload = Column(JSON, default=dict)
    result = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class AIGeneratedQuestion(Base):
    __tablename__ = "ai_generated_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("ai_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, default=list)
    correct_answer = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)


class AIReportSummary(Base):
    __tablename__ = "ai_report_summaries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_text = Column(Text, nullable=False)
    strength_areas = Column(JSON, default=list)
    gap_areas = Column(JSON, default=list)
    recommendations = Column(JSON, default=list)

    # Relationships
    attempt = relationship("TestAttempt", back_populates="ai_summaries")


# --- OTHER INFRASTRUCTURE MODELS ---

class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_url = Column(String(1024), nullable=False)
    file_type = Column(String(50), nullable=False)  # image, audio, video, document
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="media_files")


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="Pending")  # Pending, Processing, Completed, Failed
    file_url = Column(String(1024), nullable=False)
    total_rows = Column(Integer, default=0)
    processed_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    log_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="import_jobs")
    errors = relationship("ImportError", back_populates="job", cascade="all, delete-orphan")


class ImportError(Base):
    __tablename__ = "import_errors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    error_message = Column(Text, nullable=False)

    # Relationships
    job = relationship("ImportJob", back_populates="errors")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(100), nullable=False)  # test_assigned, sync_failed, billing_invoice
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(255), nullable=False)  # user.login, test.started, etc.
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    payload = Column(JSON, default=dict)

    # Relationships
    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")
