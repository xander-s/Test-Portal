import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Import models
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.database import Base
from app.models.models import (
    Role, Permission, Organization, OrganizationSetting, User,
    Department, Batch, Student, Trainer, Subject, Topic, Question,
    QuestionOption, Assessment, AssessmentSection, AssessmentQuestion,
    TestAssignment, SubscriptionPlan, OrganizationSubscription
)

from app.core.security import get_password_hash

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite+aiosqlite:///./testportal.db"
)

async def seed():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        print("Creating all tables if they don't exist...")
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        print("Seeding Subscription Plans...")
        plans = [
            SubscriptionPlan(
                name="Starter", code="starter", price=99.0,
                features={"max_students": 100, "max_tests": 10, "proctoring_enabled": False, "sap_enabled": False}
            ),
            SubscriptionPlan(
                name="Professional", code="professional", price=299.0,
                features={"max_students": 1000, "max_tests": 100, "proctoring_enabled": True, "sap_enabled": True}
            ),
            SubscriptionPlan(
                name="Enterprise", code="enterprise", price=999.0,
                features={"max_students": 10000, "max_tests": 1000, "proctoring_enabled": True, "sap_enabled": True}
            )
        ]
        session.add_all(plans)

        print("Seeding Roles...")
        roles = {
            "SUPER_ADMIN": Role(name="Super Admin", code="SUPER_ADMIN", description="Platform owner"),
            "ORG_ADMIN": Role(name="Organization Admin", code="ORG_ADMIN", description="Tenant owner"),
            "INSTITUTE_ADMIN": Role(name="Institute Admin", code="INSTITUTE_ADMIN", description="Institute administrator"),
            "CORPORATE_HR": Role(name="Corporate HR", code="CORPORATE_HR", description="Corporate Human Resources"),
            "TRAINER": Role(name="Trainer / Teacher", code="TRAINER", description="Question creator and test planner"),
            "STUDENT": Role(name="Student / Candidate", code="STUDENT", description="Test taker"),
            "PROCTOR": Role(name="Proctor / Reviewer", code="PROCTOR", description="AI video proctoring reviewer"),
            "SAP_ADMIN": Role(name="SAP Integration Admin", code="SAP_ADMIN", description="SAP data and sync settings manager"),
            "FINANCE_ADMIN": Role(name="Finance Admin", code="FINANCE_ADMIN", description="Billing and invoices manager")
        }
        session.add_all(roles.values())

        print("Seeding Permissions...")
        permissions = [
            Permission(name="Create User", code="user:create", description="Allow user creation"),
            Permission(name="Delete User", code="user:delete", description="Allow user deletion"),
            Permission(name="Create Assessment", code="assessment:create", description="Create an assessment"),
            Permission(name="Publish Assessment", code="assessment:publish", description="Publish assessments to candidates"),
            Permission(name="View Proctoring Reports", code="proctor:view", description="Access proctor snapshots and scoring logs"),
            Permission(name="Configure SAP Settings", code="sap:config", description="Modify SuccessFactors API keys"),
            Permission(name="Create Questions", code="question:create", description="Add questions to the question bank")
        ]
        session.add_all(permissions)

        # Link permissions to ORG_ADMIN and TRAINER
        roles["ORG_ADMIN"].permissions = permissions
        roles["TRAINER"].permissions = [p for p in permissions if p.code in ["assessment:create", "question:create"]]

        print("Seeding Organization...")
        org = Organization(name="Acme Corporation", slug="acme")
        session.add(org)
        await session.flush()

        org_settings = OrganizationSetting(
            organization_id=org.id,
            brand_name="Acme Academy",
            primary_color="#4F46E5",
            secondary_color="#10B981",
            privacy_policy_url="https://acme.com/privacy",
            terms_url="https://acme.com/terms"
        )
        session.add(org_settings)

        # Assign professional subscription to organization
        org_sub = OrganizationSubscription(
            organization_id=org.id,
            plan_id=plans[1].id,
            status="Active"
        )
        session.add(org_sub)

        print("Seeding Users...")
        super_admin = User(
            email="superadmin@portal.com",
            hashed_password=get_password_hash("SuperAdmin@123"),
            full_name="Platform Administrator",
            role_id=roles["SUPER_ADMIN"].id,
            organization_id=org.id,
            is_active=True
        )
        org_admin = User(
            email="admin@acme.com",
            hashed_password=get_password_hash("Admin@123"),
            full_name="Acme Administrator",
            role_id=roles["ORG_ADMIN"].id,
            organization_id=org.id,
            is_active=True
        )
        trainer = User(
            email="trainer@acme.com",
            hashed_password=get_password_hash("Trainer@123"),
            full_name="John Doe (Instructor)",
            role_id=roles["TRAINER"].id,
            organization_id=org.id,
            is_active=True
        )
        student_user = User(
            email="student@acme.com",
            hashed_password=get_password_hash("Student@123"),
            full_name="Jane Smith (Candidate)",
            role_id=roles["STUDENT"].id,
            organization_id=org.id,
            is_active=True
        )
        session.add_all([super_admin, org_admin, trainer, student_user])
        await session.flush()

        print("Seeding Departments & Batches...")
        dept = Department(name="Engineering", organization_id=org.id)
        session.add(dept)
        await session.flush()

        batch = Batch(name="R&D Batch 2026", department_id=dept.id, organization_id=org.id)
        session.add(batch)
        await session.flush()

        # Create Profiles
        trainer_profile = Trainer(user_id=trainer.id, organization_id=org.id)
        student_profile = Student(
            user_id=student_user.id,
            registration_number="REG-2026-0001",
            sap_employee_id="SAP-EMP-9988",
            designation="Junior Software Engineer",
            department_id=dept.id,
            organization_id=org.id
        )
        session.add_all([trainer_profile, student_profile])
        await session.flush()

        # Link Student to Batch
        from app.models.models import batch_students
        await session.execute(batch_students.insert().values(batch_id=batch.id, student_id=student_profile.id))

        print("Seeding Questions Bank...")
        subject = Subject(name="Computer Science & Engineering", organization_id=org.id)
        session.add(subject)
        await session.flush()

        topic = Topic(name="Python Programming", subject_id=subject.id)
        session.add(topic)
        await session.flush()

        q1 = Question(
            topic_id=topic.id,
            difficulty="Easy",
            type="mcq_single",
            question_text="What is the output of print(2 ** 3) in Python?",
            explanation="The double star operator represents exponentiation in Python, so 2 raised to power of 3 is 8.",
            marks=2.0,
            negative_marks=0.5,
            organization_id=org.id
        )
        session.add(q1)
        await session.flush()

        q1_opts = [
            QuestionOption(question_id=q1.id, option_text="6", is_correct=False),
            QuestionOption(question_id=q1.id, option_text="8", is_correct=True),
            QuestionOption(question_id=q1.id, option_text="9", is_correct=False),
            QuestionOption(question_id=q1.id, option_text="12", is_correct=False)
        ]
        session.add_all(q1_opts)

        q2 = Question(
            topic_id=topic.id,
            difficulty="Hard",
            type="coding",
            question_text="Write a function `reverse_string(s: str) -> str` that returns the input string in reverse order.",
            explanation="Use slicing `s[::-1]` or iterate through the string in reverse.",
            marks=10.0,
            organization_id=org.id
        )
        session.add(q2)

        print("Seeding Assessment and Assignments...")
        assessment = Assessment(
            title="General Python Skills Assessment",
            description="Assess core logical ability and standard Python programming competence.",
            instructions="Maintain full-screen. Tabs switches will trigger automated violations.",
            duration=30,
            total_marks=12.0,
            pass_percentage=40.0,
            organization_id=org.id,
            settings={
                "proctoring_enabled": True,
                "tab_switch_limit": 3,
                "violation_limit": 5,
                "randomize_questions": True
            },
            is_published=True
        )
        session.add(assessment)
        await session.flush()

        sec = AssessmentSection(assessment_id=assessment.id, title="Core Logic")
        session.add(sec)
        await session.flush()

        aq1 = AssessmentQuestion(section_id=sec.id, question_id=q1.id, order_number=1)
        aq2 = AssessmentQuestion(section_id=sec.id, question_id=q2.id, order_number=2)
        session.add_all([aq1, aq2])

        assign = TestAssignment(
            assessment_id=assessment.id,
            student_id=student_profile.id,
            batch_id=batch.id,
            status="Assigned",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=7),
            attempt_limit=1
        )
        session.add(assign)

        await session.commit()
        print("Database Seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
