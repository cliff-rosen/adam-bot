#!/usr/bin/env python3
"""
Migration script to create conversations and messages tables.

This script creates the tables needed for conversation persistence.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def table_exists(db, table_name: str) -> bool:
    """Check if a table exists in the database."""
    result = db.execute(text("""
        SELECT COUNT(*) as table_exists
        FROM information_schema.tables
        WHERE table_name = :table_name
        AND table_schema = DATABASE()
    """), {"table_name": table_name})
    return result.fetchone()[0] > 0


def migrate_add_conversations_messages():
    """Create conversations and messages tables."""

    with SessionLocal() as db:
        try:
            # Create conversations table
            if not table_exists(db, "conversations"):
                logger.info("Creating conversations table...")

                db.execute(text("""
                    CREATE TABLE conversations (
                        conversation_id INT PRIMARY KEY AUTO_INCREMENT,
                        user_id INT NOT NULL,
                        title VARCHAR(255) NULL,
                        is_archived BOOLEAN DEFAULT FALSE,
                        extra_data JSON,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(user_id),
                        INDEX idx_user_id (user_id),
                        INDEX idx_created_at (created_at)
                    )
                """))
                db.commit()
                logger.info("conversations table created successfully")
            else:
                logger.info("conversations table already exists")

            # Create messages table
            if not table_exists(db, "messages"):
                logger.info("Creating messages table...")

                db.execute(text("""
                    CREATE TABLE messages (
                        message_id INT PRIMARY KEY AUTO_INCREMENT,
                        conversation_id INT NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        content TEXT NOT NULL,
                        tool_calls JSON NULL,
                        suggested_values JSON NULL,
                        suggested_actions JSON NULL,
                        custom_payload JSON NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
                        INDEX idx_conversation_id (conversation_id),
                        INDEX idx_created_at (created_at)
                    )
                """))
                db.commit()
                logger.info("messages table created successfully")
            else:
                logger.info("messages table already exists")

            # Show table structures
            for table_name in ["conversations", "messages"]:
                result = db.execute(text("""
                    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                    AND table_schema = DATABASE()
                    ORDER BY ORDINAL_POSITION
                """), {"table_name": table_name})

                logger.info(f"\n{table_name} table structure:")
                for row in result:
                    logger.info(f"  {row[0]}: {row[1]} (Nullable: {row[2]})")

        except Exception as e:
            logger.error(f"Error during migration: {e}")
            db.rollback()
            raise

        logger.info("\nMigration completed successfully")


if __name__ == "__main__":
    migrate_add_conversations_messages()
