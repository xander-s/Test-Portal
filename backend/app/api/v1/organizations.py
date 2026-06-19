from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, PermissionChecker
from app.models.models import User, OrganizationSetting, Organization
from app.schemas.schemas import OrganizationSettingsUpdate, OrganizationResponse

router = APIRouter()

@router.get("/settings")
async def get_tenant_settings(
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(OrganizationSetting).where(OrganizationSetting.organization_id == tenant_id)
    )
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant settings not configured"
        )
    return {
        "brand_name": settings.brand_name,
        "logo_url": settings.logo_url,
        "primary_color": settings.primary_color,
        "secondary_color": settings.secondary_color,
        "privacy_policy_url": settings.privacy_policy_url,
        "terms_url": settings.terms_url
    }

@router.put("/settings")
async def update_tenant_settings(
    payload: OrganizationSettingsUpdate,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("user:create"))  # Admin/creator level required
):
    result = await db.execute(
        select(OrganizationSetting).where(OrganizationSetting.organization_id == tenant_id)
    )
    settings = result.scalars().first()
    if not settings:
        settings = OrganizationSetting(organization_id=tenant_id)
        db.add(settings)

    if payload.brand_name is not None:
        settings.brand_name = payload.brand_name
    if payload.logo_url is not None:
        settings.logo_url = payload.logo_url
    if payload.primary_color is not None:
        settings.primary_color = payload.primary_color
    if payload.secondary_color is not None:
        settings.secondary_color = payload.secondary_color
    if payload.privacy_policy_url is not None:
        settings.privacy_policy_url = payload.privacy_policy_url
    if payload.terms_url is not None:
        settings.terms_url = payload.terms_url

    await db.commit()
    return {"message": "Settings updated successfully"}


@router.get("/", response_model=List[OrganizationResponse])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.code != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can list organizations"
        )
    result = await db.execute(select(Organization))
    return result.scalars().all()


@router.put("/{org_id}/status")
async def toggle_organization_status(
    org_id: str,
    is_active: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.code != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can manage organization status"
        )
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org.is_active = is_active
    await db.commit()
    return {"message": f"Organization status updated to {'active' if is_active else 'inactive'}"}


@router.get("/active-list")
async def list_active_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.code not in ("SUPER_ADMIN", "ORG_ADMIN", "TRAINER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted"
        )
    result = await db.execute(
        select(Organization).where(Organization.is_active == True)
    )
    orgs = result.scalars().all()
    return [{"id": o.id, "name": o.name, "slug": o.slug} for o in orgs]

