from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.models.models import User, Organization, Role, OrganizationSetting, SubscriptionPlan, OrganizationSubscription
from app.schemas.schemas import LoginRequest, Token, OrganizationCreate, UserCreate, MeResponse
from app.core.dependencies import get_current_user

router = APIRouter()

@router.post("/register", response_model=Token)
async def register_org_admin(
    org_data: OrganizationCreate,
    admin_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    # Check if user email already exists
    user_exists = await db.execute(select(User).where(User.email == admin_data.email))
    if user_exists.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if organization slug is taken
    slug_exists = await db.execute(select(Organization).where(Organization.slug == org_data.slug))
    if slug_exists.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization slug is already taken"
        )
    
    # Check if role ORG_ADMIN exists
    role_result = await db.execute(select(Role).where(Role.code == "ORG_ADMIN"))
    role = role_result.scalars().first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default organization administrator role not seeded in database"
        )
        
    # Get standard starter subscription
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.code == "starter"))
    starter_plan = plan_result.scalars().first()
    if not starter_plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default starter plan not seeded in database"
        )

    # Create Organization
    organization = Organization(
        name=org_data.name,
        slug=org_data.slug,
        domain=org_data.domain
    )
    db.add(organization)
    await db.flush()

    # Create Settings
    settings = OrganizationSetting(
        organization_id=organization.id,
        brand_name=organization.name
    )
    db.add(settings)

    # Assign subscription
    sub = OrganizationSubscription(
        organization_id=organization.id,
        plan_id=starter_plan.id,
        status="Active"
    )
    db.add(sub)

    # Create User
    user = User(
        email=admin_data.email,
        hashed_password=get_password_hash(admin_data.password),
        full_name=admin_data.full_name,
        mobile=admin_data.mobile,
        role_id=role.id,
        organization_id=organization.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Issue Tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Account Lockout check
    if user.lock_until and user.lock_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked. Try again after {user.lock_until.strftime('%H:%M:%S')}"
        )

    if not verify_password(payload.password, user.hashed_password):
        # Increment failed count
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.lock_until = datetime.utcnow() + timedelta(minutes=15)
            user.failed_login_attempts = 0
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Too many failed attempts. Account locked for 15 minutes."
            )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Reset failure counter on success
    user.failed_login_attempts = 0
    user.lock_until = None
    await db.commit()

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.code,
        organization_id=current_user.organization_id,
        organization_slug=current_user.organization.slug if current_user.organization else None
    )
