from typing import Generator
from sqlmodel import SQLModel, create_engine, Session, select, text
from app.core.config import settings
from app.models.user import User
from app.utils.security import hash_password
import logging

logger = logging.getLogger(__name__)

# Create engine with connection pool settings to prevent hanging
connect_args = {"check_same_thread": False} if settings.AUTH_DB_URL.startswith("sqlite") else {}
engine = create_engine(
    settings.AUTH_DB_URL, 
    connect_args=connect_args,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    echo=False
)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def init_auth_db() -> None:
    if not settings.ENABLE_AUTH:
        return
    
    SQLModel.metadata.create_all(engine)
    
    # Migration: Add email/otp_mode columns if they don't exist (for existing databases)
    try:
        with Session(engine) as session:
            if settings.AUTH_DB_URL.startswith("sqlite"):
                # SQLite: Check if column exists and add if not
                try:
                    # Use PRAGMA to check table structure
                    result = session.exec(text("PRAGMA table_info(user)"))
                    columns = []
                    for row in result:
                        # PRAGMA returns: (cid, name, type, notnull, default_value, pk)
                        if len(row) >= 2:
                            columns.append(row[1])
                    
                    if 'email' not in columns:
                        logger.info("🔄 Adding email column to user table...")
                        session.exec(text("ALTER TABLE user ADD COLUMN email TEXT"))
                        session.commit()
                        logger.info("✅ Email column added successfully")
                    else:
                        logger.info("✅ Email column already exists in user table")

                    if 'otp_mode' not in columns:
                        logger.info("🔄 Adding otp_mode column to user table...")
                        session.exec(text("ALTER TABLE user ADD COLUMN otp_mode TEXT DEFAULT 'real'"))
                        session.commit()
                        logger.info("✅ otp_mode column added successfully")
                    else:
                        logger.info("✅ otp_mode column already exists in user table")

                    if 'team_location' not in columns:
                        logger.info("🔄 Adding team_location column to user table...")
                        session.exec(text("ALTER TABLE user ADD COLUMN team_location TEXT"))
                        session.commit()
                        logger.info("✅ team_location column added successfully")
                    else:
                        logger.info("✅ team_location column already exists in user table")
                except Exception as e:
                    logger.error(f"❌ Error checking/adding columns: {e}")
                    # Try to add columns anyway (might fail if they exist, but that's okay)
                    try:
                        session.exec(text("ALTER TABLE user ADD COLUMN email TEXT"))
                        session.commit()
                        logger.info("✅ Email column added (attempted)")
                    except Exception as add_error:
                        if "duplicate column" in str(add_error).lower() or "already exists" in str(add_error).lower():
                            logger.info("✅ Email column already exists (verified by add attempt)")
                        else:
                            logger.warning(f"⚠️ Could not add email column: {add_error}")
                    try:
                        session.exec(text("ALTER TABLE user ADD COLUMN otp_mode TEXT DEFAULT 'real'"))
                        session.commit()
                        logger.info("✅ otp_mode column added (attempted)")
                    except Exception as add_error:
                        if "duplicate column" in str(add_error).lower() or "already exists" in str(add_error).lower():
                            logger.info("✅ otp_mode column already exists (verified by add attempt)")
                        else:
                            logger.warning(f"⚠️ Could not add otp_mode column: {add_error}")
                    try:
                        session.exec(text("ALTER TABLE user ADD COLUMN team_location TEXT"))
                        session.commit()
                        logger.info("✅ team_location column added (attempted)")
                    except Exception as add_error:
                        if "duplicate column" in str(add_error).lower() or "already exists" in str(add_error).lower():
                            logger.info("✅ team_location column already exists (verified by add attempt)")
                        else:
                            logger.warning(f"⚠️ Could not add team_location column: {add_error}")
            else:
                # PostgreSQL/other: Check and add column if not exists
                try:
                    result = session.exec(text("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='user' AND column_name='email'
                    """))
                    if not result.first():
                        logger.info("🔄 Adding email column to user table...")
                        session.exec(text('ALTER TABLE "user" ADD COLUMN email TEXT'))
                        session.commit()
                        logger.info("✅ Email column added successfully")
                    else:
                        logger.info("✅ Email column already exists in user table")
                except Exception as e:
                    logger.warning(f"⚠️ Could not check/add email column: {e}")
                try:
                    result = session.exec(text("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='user' AND column_name='otp_mode'
                    """))
                    if not result.first():
                        logger.info("🔄 Adding otp_mode column to user table...")
                        session.exec(text('ALTER TABLE "user" ADD COLUMN otp_mode TEXT DEFAULT \'real\''))
                        session.commit()
                        logger.info("✅ otp_mode column added successfully")
                    else:
                        logger.info("✅ otp_mode column already exists in user table")
                except Exception as e:
                    logger.warning(f"⚠️ Could not check/add otp_mode column: {e}")
                try:
                    result = session.exec(text("""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name='user' AND column_name='team_location'
                    """))
                    if not result.first():
                        logger.info("🔄 Adding team_location column to user table...")
                        session.exec(text('ALTER TABLE "user" ADD COLUMN team_location TEXT'))
                        session.commit()
                        logger.info("✅ team_location column added successfully")
                    else:
                        logger.info("✅ team_location column already exists in user table")
                except Exception as e:
                    logger.warning(f"⚠️ Could not check/add team_location column: {e}")
    except Exception as e:
        # If migration fails, log and continue (might be a new database)
        logger.warning(f"⚠️ User table column migration: {e}")
    
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.username == settings.ADMIN_USERNAME)).first()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            session.commit()
            logger.info("Seeded initial admin '%s'", settings.ADMIN_USERNAME)
        # NOTE:
        # We do NOT auto-reset the admin password on startup. Admin credentials
        # should be managed via environment variables at first boot (seeding),
        # or via admin/user management endpoints thereafter.