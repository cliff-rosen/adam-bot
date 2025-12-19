#!/usr/bin/env python3
"""
Migration script to create job mandate tables.

Creates tables for the job mandate interview feature:
- job_mandates: Main mandate record
- job_mandate_items: Individual insights/bullet points
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


def enum_exists(db, enum_name: str) -> bool:
    """Check if an enum type is used (by checking if any column uses it)."""
    # MySQL doesn't have standalone enum types, they're defined per column
    # So we just return False and let the CREATE TABLE handle it
    return False


def migrate_add_job_mandate_tables():
    """Create job mandate tables."""

    with SessionLocal() as db:
        try:
            # Create job_mandates table
            if not table_exists(db, "job_mandates"):
                logger.info("Creating job_mandates table...")

                db.execute(text("""
                    CREATE TABLE job_mandates (
                        mandate_id INT PRIMARY KEY AUTO_INCREMENT,
                        user_id INT NOT NULL,
                        conversation_id INT NULL,
                        status ENUM('in_progress', 'completed', 'archived') NOT NULL DEFAULT 'in_progress',
                        current_section ENUM('energizes', 'strengths', 'must_haves', 'deal_breakers') NOT NULL DEFAULT 'energizes',
                        section_statuses JSON,
                        summary TEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP NULL,
                        FOREIGN KEY (user_id) REFERENCES users(user_id),
                        FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
                        INDEX idx_user_id (user_id),
                        INDEX idx_status (status),
                        INDEX idx_created_at (created_at)
                    )
                """))
                db.commit()
                logger.info("job_mandates table created successfully")
            else:
                logger.info("job_mandates table already exists")

            # Create job_mandate_items table
            if not table_exists(db, "job_mandate_items"):
                logger.info("Creating job_mandate_items table...")

                db.execute(text("""
                    CREATE TABLE job_mandate_items (
                        item_id INT PRIMARY KEY AUTO_INCREMENT,
                        mandate_id INT NOT NULL,
                        section ENUM('energizes', 'strengths', 'must_haves', 'deal_breakers') NOT NULL,
                        category VARCHAR(100) NULL,
                        content TEXT NOT NULL,
                        source ENUM('extracted', 'user_added', 'user_edited') NOT NULL DEFAULT 'extracted',
                        source_message_id INT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (mandate_id) REFERENCES job_mandates(mandate_id) ON DELETE CASCADE,
                        FOREIGN KEY (source_message_id) REFERENCES messages(message_id) ON DELETE SET NULL,
                        INDEX idx_mandate_id (mandate_id),
                        INDEX idx_section (section),
                        INDEX idx_created_at (created_at)
                    )
                """))
                db.commit()
                logger.info("job_mandate_items table created successfully")
            else:
                logger.info("job_mandate_items table already exists")

            # Show table structures
            for table_name in ["job_mandates", "job_mandate_items"]:
                if table_exists(db, table_name):
                    result = db.execute(text("""
                        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
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
    migrate_add_job_mandate_tables()
