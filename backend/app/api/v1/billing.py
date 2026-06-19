from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant
from app.models.models import User, OrganizationSubscription, SubscriptionPlan, Invoice

router = APIRouter()

@router.get("/plans")
async def list_available_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SubscriptionPlan))
    return result.scalars().all()

@router.get("/my-subscription")
async def get_tenant_subscription(
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(OrganizationSubscription).options(
        selectinload(OrganizationSubscription.plan)
    ).where(OrganizationSubscription.organization_id == tenant_id)
    
    res = await db.execute(stmt)
    sub = res.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found for tenant")
        
    return {
        "plan_name": sub.plan.name,
        "status": sub.status,
        "start_date": sub.start_date,
        "end_date": sub.end_date,
        "features": sub.plan.features
    }

@router.post("/checkout/stripe")
async def create_stripe_checkout(
    plan_code: str,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve plan
    res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code))
    plan = res.scalars().first()
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan code")
        
    # Standard Stripe Checkout session payload mock
    return {
        "gateway": "Stripe",
        "session_id": f"cs_test_{plan_code}_mocksessionid",
        "url": f"https://checkout.stripe.com/pay/mock_{plan_code}"
    }
