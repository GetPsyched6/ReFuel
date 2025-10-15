"""
Database connection and session management
"""
import aiosqlite
from pathlib import Path
from typing import AsyncGenerator
from contextlib import asynccontextmanager
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings


class Database:
    """SQLite database manager"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or settings.DATABASE_PATH
        self._ensure_db_exists()
    
    def _ensure_db_exists(self):
        """Ensure database file and directory exist"""
        db_file = Path(self.db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Create database if it doesn't exist
        if not db_file.exists():
            import sqlite3
            conn = sqlite3.connect(self.db_path)
            conn.close()
    
    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[aiosqlite.Connection, None]:
        """Get database connection"""
        async with aiosqlite.connect(self.db_path) as conn:
            conn.row_factory = aiosqlite.Row
            yield conn
    
    async def init_schema(self):
        """Initialize database schema"""
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        
        async with self.get_connection() as conn:
            with open(schema_path) as f:
                await conn.executescript(f.read())
            await conn.commit()
    
    async def execute_query(self, query: str, params: tuple = ()):
        """Execute a query and return results"""
        async with self.get_connection() as conn:
            async with conn.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
    
    async def execute_write(self, query: str, params: tuple = ()):
        """Execute a write query"""
        async with self.get_connection() as conn:
            cursor = await conn.execute(query, params)
            await conn.commit()
            return cursor.lastrowid
    
    async def execute_many(self, query: str, params_list: list[tuple]):
        """Execute multiple write queries"""
        async with self.get_connection() as conn:
            await conn.executemany(query, params_list)
            await conn.commit()


# Global database instance
db = Database()


async def get_db() -> Database:
    """Dependency for FastAPI routes"""
    return db

