import asyncio
import os
import sys
import httpx
import sqlite3
import json

# Setup database state for testing
def prepare_database_state():
    db_path = "testportal.db"
    print("Preparing database state for testing...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Force enable lockdown_browser_required in settings of the assessment
    cursor.execute("SELECT id, settings FROM assessments")
    rows = cursor.fetchall()
    for row in rows:
        ass_id = row[0]
        settings = json.loads(row[1]) if row[1] else {}
        settings["lockdown_browser_required"] = True
        settings["proctoring_enabled"] = True
        cursor.execute("UPDATE assessments SET settings = ? WHERE id = ?", (json.dumps(settings), ass_id))
        print(f"Updated assessment {ass_id} settings: {settings}")
        
    # 2. Reset attempt limit on test assignments so we can perform start requests
    cursor.execute("UPDATE test_assignments SET attempts_count = 0, attempt_limit = 10")
    
    conn.commit()
    conn.close()

# Import backend app
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.main import app

async def verify_lockdown():
    prepare_database_state()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Login as Student
        print("\nLogging in as Student...")
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "student@acme.com",
            "password": "Student@123"
        })
        assert login_resp.status_code == 200, "Student login failed"
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get my assignments
        print("Getting active assignments...")
        assign_resp = await client.get("/api/v1/assessments/assignments/my", headers=headers)
        assert assign_resp.status_code == 200
        assignments = assign_resp.json()
        assert len(assignments) > 0, "No assignments found for student"
        
        lockdown_assignment = assignments[0]
        print(f"Testing assignment: {lockdown_assignment['title']} (Lockdown required: {lockdown_assignment['lockdown_browser_required']})")
        
        # 3. Try starting attempt WITHOUT secure_browser flag
        print("Attempting to start test WITHOUT secure_browser flag...")
        start_failed_resp = await client.post(
            f"/api/v1/assessments/attempts/start?assignment_id={lockdown_assignment['id']}",
            headers=headers
        )
        print("Start without flag response status:", start_failed_resp.status_code)
        print("Response body:", start_failed_resp.json())
        assert start_failed_resp.status_code == 400, "Should have failed with 400 Bad Request!"
        assert "requires the Bluebirds Secure Lockdown Browser" in start_failed_resp.json()["detail"]
        print("SUCCESS: Endpoint correctly rejected starting lockdown assessment without secure browser flag.")
        
        # 4. Try starting attempt WITH secure_browser flag
        print("Attempting to start test WITH secure_browser flag...")
        start_success_resp = await client.post(
            f"/api/v1/assessments/attempts/start?assignment_id={lockdown_assignment['id']}&secure_browser=true&secure_browser_version=1.1.5",
            headers=headers
        )
        print("Start with flag response status:", start_success_resp.status_code)
        assert start_success_resp.status_code == 200, "Should have started successfully!"
        
        attempt_data = start_success_resp.json()
        print("SUCCESS: Started test attempt! Attempt ID:", attempt_data["id"])
        print("secure_browser_used in DB:", attempt_data.get("secure_browser_used"))
        print("secure_browser_version in DB:", attempt_data.get("secure_browser_version"))
        assert attempt_data["secure_browser_used"] is True
        assert attempt_data["secure_browser_version"] == "1.1.5"
        
        print("\nAll Backend Secure Browser enforcement verifications passed!")

if __name__ == "__main__":
    asyncio.run(verify_lockdown())
