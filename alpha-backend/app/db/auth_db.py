from typing import Generator
from sqlmodel import SQLModel, create_engine, Session, select
from app.core.config import settings
from app.models.user import User
from app.utils.security import hash_password
import logging

logger = logging.getLogger(__name__)

engine = create_engine(settings.AUTH_DB_URL, connect_args={"check_same_thread": False} if settings.AUTH_DB_URL.startswith("sqlite") else {})

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def init_auth_db() -> None:
    if not settings.ENABLE_AUTH:
        return
    
    SQLModel.metadata.create_all(engine)
    
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
