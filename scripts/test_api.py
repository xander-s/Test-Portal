import asyncio
import os
import sys
import httpx

# Import backend app
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.main import app

async def test_endpoints():
    print("Initializing ASGI direct transport client...")
    
    # We use httpx with ASGITransport to talk directly to the FastAPI app code
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        
        # 1. Test Home Endpoint
        print("\n--- Testing API root '/' ---")
        resp = await client.get("/")
        print("Status Code:", resp.status_code)
        print("Body:", resp.json())
        
        # 2. Test Login (Seeded Org Admin)
        print("\n--- Testing Login '/api/v1/auth/login' ---")
        login_payload = {
            "email": "admin@acme.com",
            "password": "Admin@123"
        }
        resp = await client.post(
            "/api/v1/auth/login",
            json=login_payload,
            headers={"X-Tenant-ID": "acme"}  # Passed tenant identifier
        )
        print("Status Code:", resp.status_code)
        if resp.status_code == 200:
            token_data = resp.json()
            access_token = token_data.get("access_token")
            print("Login successful! Token acquired.")
            
            # 3. Test Fetching Tenant Settings
            print("\n--- Testing Settings GET '/api/v1/organizations/settings' ---")
            settings_resp = await client.get(
                "/api/v1/organizations/settings",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Tenant-ID": "acme"
                }
            )
            print("Status Code:", settings_resp.status_code)
            print("Settings Body:", settings_resp.json())
        else:
            print("Login failed:", resp.text)

if __name__ == "__main__":
    asyncio.run(test_endpoints())
