import os
import sqlite3
import pymysql
from datetime import date
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Determine database type
LOCAL = os.getenv('LOCAL', 'False').strip().lower() in ['true', '1', 'yes']

def fix_sqlite():
    db_path = 'db.sqlite3' # Assumed path relative to backend
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found")
        return

    try:
        conn = sqlite3.connect(db_path, timeout=10)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(api_habit)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'created_at' not in columns:
            print("Adding column created_at to SQLite...")
            today = date.today().isoformat()
            cursor.execute(f"ALTER TABLE api_habit ADD COLUMN created_at DATE DEFAULT '{today}'")
            conn.commit()
            print("Successfully added created_at to api_habit (SQLite).")
        else:
            print("Column created_at already exists in api_habit (SQLite).")

        if 'dismissed_comment_date' not in columns:
            print("Adding column dismissed_comment_date to SQLite...")
            cursor.execute("ALTER TABLE api_habit ADD COLUMN dismissed_comment_date DATE NULL")
            conn.commit()
            print("Successfully added dismissed_comment_date to api_habit (SQLite).")
        else:
            print("Column dismissed_comment_date already exists in api_habit (SQLite).")
        
        conn.close()
    except Exception as e:
        print(f"SQLite Error: {e}")

def fix_mysql():
    name = os.getenv("NAME_DB")
    if not name:
        print("Error: NAME_DB not found in environment.")
        return
        
    user = os.getenv("NAME_DB")  # Based on settings.py logic: 'USER': os.getenv('NAME_DB')
    password = os.getenv("PASS_DB")
    host = os.getenv("HOST_DB", "127.0.0.1")
    
    if not password:
        print("Error: PASS_DB not found in environment.")
        return

    try:
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            database=name,
            charset='utf8mb4'
        )
        try:
            with conn.cursor() as cursor:
                # Check columns in MySQL
                cursor.execute("DESCRIBE api_habit")
                rows = cursor.fetchall()
                # Row format is (Field, Type, Null, Key, Default, Extra)
                columns = [row[0] for row in rows]
                
                if 'created_at' not in columns:
                    print("Adding column created_at to MySQL...")
                    cursor.execute("ALTER TABLE api_habit ADD COLUMN created_at DATE DEFAULT (CURRENT_DATE)")
                    conn.commit()
                    print("Successfully added created_at to api_habit (MySQL).")
                else:
                    print("Column created_at already exists in api_habit (MySQL).")

                if 'dismissed_comment_date' not in columns:
                    print("Adding column dismissed_comment_date to MySQL...")
                    cursor.execute("ALTER TABLE api_habit ADD COLUMN dismissed_comment_date DATE NULL")
                    conn.commit()
                    print("Successfully added dismissed_comment_date to api_habit (MySQL).")
                else:
                    print("Column dismissed_comment_date already exists in api_habit (MySQL).")
        finally:
            conn.close()
    except Exception as e:
        print(f"MySQL Error: {e}")

if __name__ == "__main__":
    if LOCAL:
        print("Running in LOCAL mode (SQLite)...")
        fix_sqlite()
    else:
        print("Running in SERVER mode (MySQL)...")
        fix_mysql()
