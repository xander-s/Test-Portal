from fastapi import Depends, HTTPException, Header, status
from jose import jwt
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User, Organization, Role, Permission

async def get_current_tenant(
    x_tenant_id: str = Header(None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db)
) -> str:
    """
    Extracts and validates the tenant (Organization ID or slug) from request headers.
    """
    if not x_tenant_id:
        # For development ease, if header is omitted we fallback to a default or raise 400.
        # In production, we enforce this header or resolve it via subdomain.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Tenant-ID header is missing"
        )
    
    # Verify organization exists and is active (supports ID or slug)
    result = await db.execute(
        select(Organization).where(
            or_(Organization.id == x_tenant_id, Organization.slug == x_tenant_id),
            Organization.is_active == True
        )
    )
    org = result.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant organization not found or inactive"
        )
    
    return org.id

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Retrieves the authenticated user from the JWT access token.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials format"
        )
    
    token = authorization.split(" ")[1]
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except Exception:
        raise credentials_exception
        
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.organization),
            selectinload(User.student_profile),
            selectinload(User.trainer_profile)
        )
        .where(User.id == user_id, User.is_active == True)
    )
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
        
    return user

class PermissionChecker:
    """
    Enforces that a user has a specific permission code, or is a SUPER_ADMIN.
    """
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Super Admin bypasses all checks
        if current_user.role.code == "SUPER_ADMIN":
            return current_user
            
        user_permissions = {p.code for p in current_user.role.permissions}
        if self.required_permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user
