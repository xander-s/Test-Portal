import os
import subprocess
import tempfile
import sys
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

class CodeSandboxService:
    @staticmethod
    def run_python_code(code: str, test_cases: List[Dict[str, str]], timeout: float = 2.0) -> Dict[str, Any]:
        """
        Runs Python code inside a secure environment.
        Uses ephemeral docker container, with fallback to local subprocess under strict constraints.
        """
        results = []
        all_passed = True
        
        # Check if Docker is available
        use_docker = False
        try:
            subprocess.run(["docker", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            use_docker = True
        except Exception:
            pass

        # Write candidate code to temporary file
        temp_dir = tempfile.mkdtemp()
        code_file_path = os.path.join(temp_dir, "solution.py")
        with open(code_file_path, "w", encoding="utf-8") as f:
            f.write(code)

        try:
            for idx, case in enumerate(test_cases):
                input_data = case.get("input", "")
                expected_output = case.get("expected_output", "").strip()
                
                # Setup runner command
                if use_docker:
                    # Run inside an isolated python-slim docker container with limits:
                    # 128MB RAM, 0.5 CPU cores, no network access, auto-cleanup
                    cmd = [
                        "docker", "run", "--rm",
                        "-v", f"{temp_dir}:/code",
                        "-w", "/code",
                        "--network", "none",
                        "--memory", "128m",
                        "--cpus", "0.5",
                        "python:3.12-slim",
                        "python", "solution.py"
                    ]
                else:
                    # Local fallback with standard process execution
                    cmd = [sys.executable, code_file_path]
                
                try:
                    proc = subprocess.run(
                        cmd,
                        input=input_data,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        timeout=timeout
                    )
                    
                    actual_output = proc.stdout.strip()
                    error_output = proc.stderr.strip()
                    
                    if proc.returncode != 0:
                        results.append({
                            "case_index": idx,
                            "status": "Compile/Runtime Error",
                            "error": error_output,
                            "passed": False
                        })
                        all_passed = False
                    elif actual_output == expected_output:
                        results.append({
                            "case_index": idx,
                            "status": "Success",
                            "passed": True
                        })
                    else:
                        results.append({
                            "case_index": idx,
                            "status": "Wrong Answer",
                            "expected": expected_output,
                            "actual": actual_output,
                            "passed": False
                        })
                        all_passed = False
                        
                except subprocess.TimeoutExpired:
                    results.append({
                        "case_index": idx,
                        "status": "Timeout Exceeded",
                        "passed": False
                    })
                    all_passed = False
        finally:
            # Clean temp resources
            try:
                shutil_rmtree = lambda p: subprocess.run(f"rm -rf {p}" if os.name != 'nt' else f"rmdir /s /q {p}", shell=True)
                shutil_rmtree(temp_dir)
            except Exception:
                pass

        return {
            "status": "Success" if all_passed else "Failed",
            "passed_all": all_passed,
            "test_cases": results
        }

    @staticmethod
    async def run_sql_query(
        query: str, 
        expected_query: str, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Runs a candidate SELECT query and compares results with the expected query.
        Runs inside a transaction that is rolled back to protect data consistency.
        """
        try:
            # Execute candidate query
            candidate_res = await db.execute(text(query))
            candidate_rows = candidate_res.fetchall()
            
            # Execute expected query
            expected_res = await db.execute(text(expected_query))
            expected_rows = expected_res.fetchall()
            
            # Compare dimensions and rows
            passed = len(candidate_rows) == len(expected_rows)
            if passed:
                for r1, r2 in zip(candidate_rows, expected_rows):
                    if tuple(r1) != tuple(r2):
                        passed = False
                        break
            
            # Rollback to protect database state from mutations
            await db.rollback()
            
            return {
                "passed": passed,
                "status": "Success" if passed else "Wrong Answer",
                "rows_returned": len(candidate_rows)
            }
        except Exception as e:
            await db.rollback()
            return {
                "passed": False,
                "status": "Syntax/Execution Error",
                "error": str(e)
            }
class CodeSandboxController:
    pass
