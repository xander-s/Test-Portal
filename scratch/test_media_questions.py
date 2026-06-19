import asyncio
import os
import sys
import httpx
import sqlite3
import json
from unittest.mock import patch, MagicMock

# Mock boto3 before backend import to avoid connection timeout hangs
import boto3
boto3.client = MagicMock()

# Import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.main import app

def prepare_database_state():
    db_path = "testportal.db"
    print("Preparing database state for media questions testing...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Reset attempt limit on test assignments so we can perform start requests
    cursor.execute("UPDATE test_assignments SET attempts_count = 0, attempt_limit = 10")
    
    # Verify/create a question with media to test retrieval
    cursor.execute("SELECT id FROM questions LIMIT 1")
    q_row = cursor.fetchone()
    if q_row:
        q_id = q_row[0]
        print(f"Attaching dummy media URLs to question {q_id} for test validation...")
        cursor.execute("""
            UPDATE questions 
            SET question_image = 'http://localhost:9000/testportal-media/image.png',
                question_audio = 'http://localhost:9000/testportal-media/audio.mp3',
                question_video = 'http://localhost:9000/testportal-media/video.mp4',
                question_document = 'http://localhost:9000/testportal-media/doc.pdf'
            WHERE id = ?
        """, (q_id,))
        
        # Attach dummy media to its options
        cursor.execute("SELECT id FROM question_options WHERE question_id = ?", (q_id,))
        opt_rows = cursor.fetchall()
        for i, opt_row in enumerate(opt_rows):
            opt_id = opt_row[0]
            cursor.execute("""
                UPDATE question_options 
                SET option_image = ?,
                    option_audio = ?,
                    option_video = ?
                WHERE id = ?
            """, (
                f'http://localhost:9000/testportal-media/opt_img_{i}.png',
                f'http://localhost:9000/testportal-media/opt_aud_{i}.mp3',
                f'http://localhost:9000/testportal-media/opt_vid_{i}.mp4',
                opt_id
            ))
            
        # Ensure there is a link between all sections and our question so it gets fetched
        import uuid
        cursor.execute("SELECT id FROM assessment_sections")
        sections = [r[0] for r in cursor.fetchall()]
        for sec_id in sections:
            cursor.execute("SELECT 1 FROM assessment_questions WHERE section_id = ? AND question_id = ?", (sec_id, q_id))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO assessment_questions (id, section_id, question_id, order_number) VALUES (?, ?, ?, 1)",
                    (str(uuid.uuid4()), sec_id, q_id)
                )
            
    conn.commit()
    conn.close()

async def run_tests():
    prepare_database_state()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # --- 1. ADMIN FLOW ---
        print("\n[Admin Flow] Logging in as Organization Admin...")
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "admin@acme.com",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        admin_token = login_resp.json()["access_token"]
        admin_headers = {
            "Authorization": f"Bearer {admin_token}",
            "X-Tenant-ID": "acme"
        }
        
        # Test Media Upload: Normal Size (Mocked S3 upload)
        print("\n[Admin Flow] Uploading media file (under 50MB)...")
        dummy_file_content = b"fake image content"
        files = {"file": ("test_image.png", dummy_file_content, "image/png")}
        
        with patch("app.core.s3.s3_storage.upload_file", return_value="http://mock-minio:9000/test-bucket/test_image.png") as mock_upload:
            upload_resp = await client.post("/api/v1/questions/upload-media", headers=admin_headers, files=files)
            print("Upload response:", upload_resp.json())
            assert upload_resp.status_code == 200
            assert "url" in upload_resp.json()
            assert upload_resp.json()["url"] == "http://mock-minio:9000/test-bucket/test_image.png"
            mock_upload.assert_called_once()
            print("SUCCESS: File uploaded successfully.")

        # Test Media Upload: Exceeding 50MB Limit
        print("\n[Admin Flow] Uploading oversized media file (over 50MB)...")
        oversized_content = b"a" * (50 * 1024 * 1024 + 100) # 50MB + 100 bytes
        files = {"file": ("large_file.mp4", oversized_content, "video/mp4")}
        
        upload_large_resp = await client.post("/api/v1/questions/upload-media", headers=admin_headers, files=files)
        print("Upload large status code:", upload_large_resp.status_code)
        assert upload_large_resp.status_code == 413
        assert "too large" in upload_large_resp.json()["detail"].lower()
        print("SUCCESS: Upload rejected with 413 Payload Too Large.")

        # --- 2. STUDENT FLOW ---
        print("\n[Student Flow] Logging in as Student...")
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "student@acme.com",
            "password": "Student@123"
        })
        assert login_resp.status_code == 200, f"Student login failed: {login_resp.text}"
        student_token = login_resp.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Get active assignments
        print("Getting active assignments...")
        assign_resp = await client.get("/api/v1/assessments/assignments/my", headers=student_headers)
        assert assign_resp.status_code == 200
        assignments = assign_resp.json()
        assert len(assignments) > 0, "No assignments found for student"
        target_assignment = assignments[0]

        # Start an attempt
        print(f"Starting test attempt for assignment: {target_assignment['title']}...")
        sb_param = "&secure_browser=true&secure_browser_version=1.1.5" if target_assignment.get("lockdown_browser_required") else ""
        start_resp = await client.post(
            f"/api/v1/assessments/attempts/start?assignment_id={target_assignment['id']}{sb_param}",
            headers=student_headers
        )
        assert start_resp.status_code == 200, f"Failed to start attempt: {start_resp.text}"
        attempt_id = start_resp.json()["id"]
        print(f"Started attempt ID: {attempt_id}")

        # Fetch attempt questions and verify filter
        print("\n[Student Flow] Fetching questions for active attempt...")
        questions_resp = await client.get(
            f"/api/v1/assessments/attempts/{attempt_id}/questions",
            headers=student_headers
        )
        assert questions_resp.status_code == 200, f"Failed to fetch questions: {questions_resp.text}"
        res_data = questions_resp.json()
        
        # Verify schema
        assert "questions" in res_data
        assert "remaining_seconds" in res_data
        assert "client_state" in res_data
        
        questions_list = res_data["questions"]
        print(f"Fetched {len(questions_list)} questions.")
        
        # Verify that correct answers and explanations are stripped!
        for q in questions_list:
            # Question properties checking
            assert "correct_answer" not in q, "Question exposed correct_answer!"
            assert "explanation" not in q, "Question exposed explanation!"
            assert "marks" not in q, "Question exposed marks!"
            
            # Media validation for our updated test question
            if q["question_image"]:
                print(f"Found question media attachments: image={q['question_image']}, audio={q['question_audio']}, video={q['question_video']}, document={q['question_document']}")
                assert q["question_image"] == 'http://localhost:9000/testportal-media/image.png'
                assert q["question_audio"] == 'http://localhost:9000/testportal-media/audio.mp3'
                assert q["question_video"] == 'http://localhost:9000/testportal-media/video.mp4'
                assert q["question_document"] == 'http://localhost:9000/testportal-media/doc.pdf'
            
            # Options properties checking
            for opt in q.get("options", []):
                assert "is_correct" not in opt, f"Option {opt['id']} exposed is_correct!"
                # Verify option level media fields exist
                assert "option_image" in opt
                assert "option_audio" in opt
                assert "option_video" in opt
                
        print("\nSUCCESS: All student filtering security controls validated successfully.")

if __name__ == '__main__':
    asyncio.run(run_tests())
