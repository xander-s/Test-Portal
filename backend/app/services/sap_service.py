import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.models import SAPConfig, Student, User, Role, TestAttempt, Certificate, SAPSyncLog, SAPResultPushLog

class SAPIntegrationService:
    @staticmethod
    async def get_sap_client(db: AsyncSession, organization_id: str) -> Optional[SAPConfig]:
        stmt = select(SAPConfig).where(SAPConfig.organization_id == organization_id, SAPConfig.is_active == True)
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def fetch_oauth_token(config: SAPConfig) -> str:
        """
        Requests OAuth2 access token from SAP Identity Provider / Token Service.
        """
        if not config.oauth_token_url:
            return ""
            
        data = {
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "grant_type": "client_credentials"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(config.oauth_token_url, data=data, timeout=10.0)
            if resp.status_code == 200:
                return resp.json().get("access_token", "")
            else:
                raise Exception(f"SAP Token Request Failed: {resp.text}")

    @staticmethod
    async def sync_employees(organization_id: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Pulls employee list from SAP SuccessFactors User OData entities.
        Maps them to Local Student Users.
        """
        config = await SAPIntegrationService.get_sap_client(db, organization_id)
        if not config or not config.employee_endpoint:
            return {"status": "skipped", "message": "SAP not configured for this organization"}

        token = await SAPIntegrationService.fetch_oauth_token(config)
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        result_log = {"synced": 0, "errors": []}
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(config.base_url + config.employee_endpoint, headers=headers, timeout=15.0)
                if resp.status_code != 200:
                    raise Exception(f"SAP Sync Error: {resp.text}")
                
                # Assume standard OData JSON body returning a list of users
                sap_users = resp.json().get("d", {}).get("results", [])
                
                # Retrieve default STUDENT role
                role_stmt = select(Role).where(Role.code == "STUDENT")
                role_res = await db.execute(role_stmt)
                student_role = role_res.scalars().first()

                for u in sap_users:
                    emp_id = u.get("userId")
                    email = u.get("email")
                    name = u.get("defaultFullName")
                    
                    if not email or not emp_id:
                        continue
                        
                    # Check if student already linked
                    link_stmt = select(Student).where(Student.sap_employee_id == emp_id)
                    link_res = await db.execute(link_stmt)
                    existing_student = link_res.scalars().first()
                    
                    if not existing_student:
                        # Create new user and student profile
                        user = User(
                            email=email,
                            hashed_password="SAP_MANAGED_PASSWORD_SSO",
                            full_name=name,
                            role_id=student_role.id,
                            organization_id=organization_id
                        )
                        db.add(user)
                        await db.flush()
                        
                        student = Student(
                            user_id=user.id,
                            sap_employee_id=emp_id,
                            organization_id=organization_id
                        )
                        db.add(student)
                        result_log["synced"] += 1
                
                # Add log entry
                log = SAPSyncLog(
                    organization_id=organization_id,
                    sync_type="Employee",
                    status="Success",
                    records_processed=result_log["synced"]
                )
                db.add(log)
                await db.commit()
                
        except Exception as e:
            log = SAPSyncLog(
                organization_id=organization_id,
                sync_type="Employee",
                status="Failure",
                error_message=str(e)
            )
            db.add(log)
            await db.commit()
            result_log["errors"].append(str(e))
            
        return result_log

    @staticmethod
    async def push_test_result(attempt_id: str, db: AsyncSession) -> bool:
        """
        Pushes completed test score and status back to SAP.
        """
        stmt = select(TestAttempt).options(
            selectinload(TestAttempt.student),
            selectinload(TestAttempt.result),
            selectinload(TestAttempt.assessment)
        ).where(TestAttempt.id == attempt_id)
        
        res = await db.execute(stmt)
        attempt = res.scalars().first()
        if not attempt or not attempt.result:
            return False

        config = await SAPIntegrationService.get_sap_client(db, attempt.student.organization_id)
        if not config or not config.result_update_endpoint:
            return False

        token = await SAPIntegrationService.fetch_oauth_token(config)
        headers = {
            "Authorization": f"Bearer {token}" if token else "",
            "Content-Type": "application/json"
        }
        
        payload = {
            "employeeId": attempt.student.sap_employee_id,
            "assessmentId": attempt.assessment_id,
            "score": attempt.result.total_score,
            "percentage": attempt.result.percentage,
            "passed": attempt.result.pass_fail,
            "completionDate": attempt.submitted_at.isoformat() if attempt.submitted_at else ""
        }
        
        success = False
        response_text = ""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    config.base_url + config.result_update_endpoint, 
                    json=payload, 
                    headers=headers, 
                    timeout=10.0
                )
                response_text = resp.text
                success = (resp.status_code in (200, 201, 204))
        except Exception as e:
            response_text = str(e)
            
        # Log result push
        log = SAPResultPushLog(
            attempt_id=attempt_id,
            status="Success" if success else "Failure",
            payload=payload,
            response={"raw": response_text}
        )
        db.add(log)
        await db.commit()
        return success
