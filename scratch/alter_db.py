import sqlite3

def alter():
    db_path = "testportal.db"
    print(f"Connecting to database {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(test_attempts)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Existing columns in test_attempts:", columns)
    
    if "secure_browser_used" not in columns:
        print("Adding secure_browser_used column...")
        cursor.execute("ALTER TABLE test_attempts ADD COLUMN secure_browser_used BOOLEAN DEFAULT 0")
        
    if "secure_browser_version" not in columns:
        print("Adding secure_browser_version column...")
        cursor.execute("ALTER TABLE test_attempts ADD COLUMN secure_browser_version VARCHAR(50)")
        
    conn.commit()
    
    # Re-verify columns
    cursor.execute("PRAGMA table_info(test_attempts)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Updated columns in test_attempts:", columns)
    
    conn.close()

if __name__ == "__main__":
    alter()
