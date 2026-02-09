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
    
    # Migration: Add email column if it doesn't exist (for existing databases)
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
                except Exception as e:
                    logger.error(f"❌ Error checking/adding email column: {e}")
                    # Try to add column anyway (might fail if it exists, but that's okay)
                    try:
                        session.exec(text("ALTER TABLE user ADD COLUMN email TEXT"))
                        session.commit()
                        logger.info("✅ Email column added (attempted)")
                    except Exception as add_error:
                        if "duplicate column" in str(add_error).lower() or "already exists" in str(add_error).lower():
                            logger.info("✅ Email column already exists (verified by add attempt)")
                        else:
                            logger.warning(f"⚠️ Could not add email column: {add_error}")
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
    except Exception as e:
        # If migration fails, log and continue (might be a new database)
        logger.warning(f"⚠️ Email column migration: {e}")
    
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
        else:
            # For development, ensure admin password is 'Faizan123'
            if settings.ADMIN_PASSWORD == "Faizan123":
                admin.password_hash = hash_password("Faizan123")
                session.add(admin)
                session.commit()
                logger.info("✅ Admin password updated to Faizan123")