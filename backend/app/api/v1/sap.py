from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant, PermissionChecker
from app.models.models import User, SAPConfig
from app.schemas.schemas import SAPConfigCreate, SAPConfigResponse
from app.services.sap_service import SAPIntegrationService

router = APIRouter()

@router.post("/config", response_model=SAPConfigResponse)
async def create_or_update_sap_config(
    payload: SAPConfigCreate,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("sap:config"))
):
    stmt = select(SAPConfig).where(SAPConfig.organization_id == tenant_id)
    res = await db.execute(stmt)
    config = res.scalars().first()
    
    if not config:
        config = SAPConfig(organization_id=tenant_id)
        db.add(config)
        
    config.system_type = payload.system_type
    config.base_url = payload.base_url
    config.client_id = payload.client_id
    config.client_secret = payload.client_secret
    config.oauth_token_url = payload.oauth_token_url
    config.employee_endpoint = payload.employee_endpoint
    config.candidate_endpoint = payload.candidate_endpoint
    config.result_update_endpoint = payload.result_update_endpoint
    config.certificate_update_endpoint = payload.certificate_update_endpoint
    config.sync_frequency = payload.sync_frequency
    config.is_active = payload.is_active

    await db.commit()
    await db.refresh(config)
    return config

@router.post("/test-connection")
async def test_sap_connection(
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("sap:config"))
):
    stmt = select(SAPConfig).where(SAPConfig.organization_id == tenant_id)
    res = await db.execute(stmt)
    config = res.scalars().first()
    if not config:
        raise HTTPException(status_code=404, detail="SAP configuration not found for tenant")
        
    try:
        token = await SAPIntegrationService.fetch_oauth_token(config)
        return {
            "status": "connected",
            "message": "Successfully authenticated with SAP Identity Provider.",
            "token_acquired": bool(token)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Connection test failed: {str(e)}"
        )

@router.post("/sync/employees")
async def trigger_employee_sync(
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PermissionChecker("sap:config"))
):
    result = await SAPIntegrationService.sync_employees(tenant_id, db)
    return result
