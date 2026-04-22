# app/main.py
"""
Main Application - FastAPI Entry Point
Clean startup + routing wired to new Qdrant collections:
  - *_documents, *_structured, *_embeddings
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Routers
from app.routes import cv_routes, jd_routes, special_routes, careers_routes, storage_routes
from app.routes.auth_routes import router as auth_router
from app.routes.admin_routes import router as admin_router
from app.routes.performance_routes import router as performance_router
from app.routes.email_routes import router as email_router
from app.routes.tracker_routes import router as tracker_router
from app.routes.features_routes import router as features_router

# Services init
from app.utils.qdrant_utils import get_qdrant_utils
from app.services.embedding_service import get_embedding_service
from app.utils.cache import get_cache_service
from app.db.auth_db import init_auth_db
from app.db.tracker_db import init_tracker_db

# --------------------
# Logging
# --------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("cv-analyzer")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    try:
        logger.info("🚀 Starting CV Analyzer API...")

        # Required envs - OpenAI key is optional (warn if missing, but don't fail)
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.warning("⚠️ OPENAI_API_KEY environment variable not set - OpenAI features will be disabled")
            logger.warning("⚠️ Email CV processing and LLM features will not work without OpenAI key")
        else:
            logger.info("✅ OPENAI_API_KEY configured")

        qdrant_host = os.getenv("QDRANT_HOST", "qdrant")
        qdrant_port = os.getenv("QDRANT_PORT", "6333")
        logger.info(f"🔧 Qdrant: {qdrant_host}:{qdrant_port}")

        # Initialize core dependencies
        logger.info("🗄 Initializing Qdrant client & collections...")
        qdrant_utils = get_qdrant_utils()  # ensures collections exist
        logger.info("✅ Qdrant ready")
        
        # Initialize Qdrant connection pool for production
        if os.getenv("ENVIRONMENT") == "production":
            logger.info("🔗 Initializing Qdrant connection pool...")
            from app.utils.qdrant_pool import get_qdrant_pool
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    logger.info("⚠️ Event loop running, Qdrant pool will be initialized on first use")
                else:
                    pool = loop.run_until_complete(get_qdrant_pool())
                    logger.info("✅ Qdrant connection pool ready")
            except Exception as e:
                logger.warning(f"⚠️ Qdrant pool initialization failed: {e}")
        else:
            logger.info("🔗 Using direct Qdrant client for development")

        logger.info("🧠 Warming embedding service...")
        get_embedding_service()
        logger.info("✅ Embedding service ready")

        logger.info("🧰 Initializing cache service...")
        cache_service = get_cache_service()
        logger.info("✅ Cache ready")
        
        logger.info("🔴 Initializing Redis cache...")
        from app.utils.redis_cache import get_redis_cache
        redis_cache = get_redis_cache()
        logger.info("✅ Redis cache ready")

        logger.info("🔐 Initializing auth database...")
        init_auth_db()
        logger.info("✅ Auth database ready")

        # Ensure email-processing tables exist (safe/additive).
        # This prevents scheduler/pipeline from failing on first run when tables
        # haven't been created yet.
        try:
            from app.services.email_database_service import email_db_service  # noqa: F401

            logger.info("✅ Email processing database tables ensured")
        except Exception as e:
            # Don't fail startup if email DB can't be initialized; email features will degrade.
            logger.warning(f"⚠️ Email processing DB init skipped: {e}")

        # Candidate Tracker DB is isolated and only initialized when enabled
        if os.getenv("ENABLE_CANDIDATE_TRACKER", "").lower() == "true":
            logger.info("🧩 Initializing Candidate Tracker database...")
            init_tracker_db()
            logger.info("✅ Candidate Tracker database ready")
        else:
            logger.info("🧩 Candidate Tracker disabled (ENABLE_CANDIDATE_TRACKER=false)")

        # Follow-up reminder scheduler (optional, uses tracker DB)
        followup_task = None
        followup_stop = None
        followup_lock_file = None
        if os.getenv("SEND_EMAIL_REMINDER_FOLLOWUP", "").strip().lower() in ("1", "true", "yes") and os.getenv("ENABLE_CANDIDATE_TRACKER", "").lower() == "true":
            try:
                import fcntl  # type: ignore
                import asyncio

                followup_lock_file = open("/tmp/followup_reminder_scheduler.lock", "w")
                fcntl.flock(followup_lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

                logger.info("📨 Starting follow-up reminder scheduler (acquired lock)...")
                from app.services.followup_reminder_scheduler import followup_reminder_loop

                followup_stop = asyncio.Event()
                followup_task = asyncio.create_task(followup_reminder_loop(followup_stop))
                logger.info("✅ Follow-up reminder scheduler started")
            except BlockingIOError:
                logger.info("⏭️ Follow-up reminder scheduler already running on another worker")
                if followup_lock_file:
                    followup_lock_file.close()
                followup_lock_file = None
            except Exception as e:
                logger.error(f"❌ Failed to start follow-up reminder scheduler: {e}", exc_info=True)
                if followup_lock_file:
                    try:
                        followup_lock_file.close()
                    except Exception:
                        pass
                followup_lock_file = None
        else:
            logger.info("⏸️ Follow-up reminder scheduler is DISABLED (SEND_EMAIL_REMINDER_FOLLOWUP!=true or tracker disabled)")

        logger.info("🔄 Starting enterprise job queue...")
        from app.services.enhanced_job_queue import get_enterprise_job_queue
        await get_enterprise_job_queue()  # This will start the workers
        logger.info("✅ Enterprise job queue ready")

        # Email scheduler (optional)
        # Only start on ONE worker (not all workers) using a file lock.
        # Enable explicitly with ENABLE_EMAIL_SCHEDULER=true
        scheduler_task = None
        scheduler = None
        scheduler_lock_file = None

        enable_email_scheduler = os.getenv("ENABLE_EMAIL_SCHEDULER", "").strip().lower() in ("1", "true", "yes")
        if enable_email_scheduler:
            try:
                import fcntl  # type: ignore
                import asyncio

                scheduler_lock_file = open("/tmp/email_scheduler.lock", "w")
                fcntl.flock(scheduler_lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

                # We got the lock! This worker will run the scheduler
                logger.info("📧 Starting email scheduler (acquired lock)...")
                from app.services.email_scheduler import get_email_scheduler

                scheduler = get_email_scheduler()
                scheduler_task = asyncio.create_task(scheduler.start_scheduler())
                logger.info("✅ Email scheduler started (checking every 5 minutes by default)")
            except BlockingIOError:
                # Another worker already has the lock and is running the scheduler
                logger.info("⏭️ Email scheduler already running on another worker")
                if scheduler_lock_file:
                    scheduler_lock_file.close()
                scheduler_lock_file = None
            except Exception as e:
                logger.error(f"❌ Failed to start email scheduler: {e}", exc_info=True)
                if scheduler_lock_file:
                    try:
                        scheduler_lock_file.close()
                    except Exception:
                        pass
                scheduler_lock_file = None
        else:
            logger.info("⏸️ Email scheduler is DISABLED (ENABLE_EMAIL_SCHEDULER!=true)")

        logger.info("🎉 Startup complete")
        yield
        # Graceful shutdown
        logger.info("🛑 Shutting down CV Analyzer API...")
        if followup_stop is not None:
            followup_stop.set()
        if followup_task:
            try:
                await asyncio.wait_for(followup_task, timeout=5.0)
            except Exception:
                followup_task.cancel()
        if followup_lock_file:
            try:
                import fcntl  # type: ignore
                fcntl.flock(followup_lock_file.fileno(), fcntl.LOCK_UN)
                followup_lock_file.close()
                os.remove("/tmp/followup_reminder_scheduler.lock")
            except Exception:
                pass
        if scheduler_task and scheduler:
            logger.info("🛑 Stopping email scheduler...")
            await scheduler.stop_scheduler()
            try:
                await asyncio.wait_for(scheduler_task, timeout=5.0)
            except asyncio.TimeoutError:
                scheduler_task.cancel()
        # Release the lock file
        if scheduler_lock_file:
            try:
                # fcntl is not available on Windows; this code path is only relevant when the
                # email scheduler is enabled and a lock is acquired.
                import fcntl  # type: ignore
                fcntl.flock(scheduler_lock_file.fileno(), fcntl.LOCK_UN)
                scheduler_lock_file.close()
                os.remove("/tmp/email_scheduler.lock")
            except Exception:
                pass
        logger.info("✅ Shutdown complete")
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise


app = FastAPI(
    title="CV Analyzer API",
    description="AI-powered CV analysis and job matching with explainable, deterministic scoring.",
    version="2.0.0",
    lifespan=lifespan,
)

# --------------------
# CORS
# --------------------
# Environment-specific origins
dev_origins = [
    "http://localhost:3000", "http://localhost:8000", "http://localhost",
    "http://127.0.0.1:3000", "http://127.0.0.1:8000", "http://127.0.0.1",
    "http://13.62.91.25:3000", "http://13.62.91.25:8000"
]
prod_origins = ["https://alphacv.alphadatarecruitment.ae"]

# Check if in development mode
is_development = os.getenv("NODE_ENV") == "development" or os.getenv("ENVIRONMENT") == "development"

# Set origins based on environment
if is_development:
    # Development: allow both HTTP and HTTPS origins
    allow_origins = dev_origins + prod_origins
else:
    # Production: only HTTPS origins
    frontend_origin = os.getenv("FRONTEND_ORIGIN")
    if frontend_origin:
        allow_origins = [frontend_origin]
    else:
        allow_origins = prod_origins

logger.info(f"🔒 CORS origins configured: {allow_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Rate limiting middleware (MUST be first)
from app.middleware.rate_limiter import rate_limit_middleware
app.middleware("http")(rate_limit_middleware)

# Trust proxy headers middleware (for ALB)
@app.middleware("http")
async def trust_proxy_headers(request, call_next):
    """Normalize request scheme when behind a proxy/ALB using X-Forwarded-Proto."""
    # Handle X-Forwarded-Proto for HTTPS detection behind ALB
    forwarded_proto = request.headers.get("X-Forwarded-Proto")
    if forwarded_proto == "https":
        # Update the request URL scheme for proper HTTPS detection
        request.scope["scheme"] = "https"
    
    response = await call_next(request)
    return response

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add common security headers for HTTPS requests in non-development environments."""
    response = await call_next(request)
    
    # Check if request is HTTPS (including via ALB forwarding)
    is_https = (request.url.scheme == "https" or 
                request.headers.get("X-Forwarded-Proto") == "https")
    
    # Add security headers for HTTPS requests
    if not is_development and is_https:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response

# --------------------
# Routes
# --------------------
# Auth routes
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(features_router)
app.include_router(tracker_router)

# Core routes
app.include_router(cv_routes.router, prefix="/api/cv", tags=["CV Management"])
app.include_router(jd_routes.router, prefix="/api/jd", tags=["Job Description Management"])
app.include_router(special_routes.router, prefix="/api", tags=["Matching & System"])

# Performance monitoring routes
app.include_router(performance_router, tags=["Performance Monitoring"])

# Careers routes (public job postings & applications)
app.include_router(careers_routes.router, prefix="/api/careers", tags=["Careers & Public Applications"])

# Email processing routes (Azure integration)
app.include_router(email_router, prefix="/api/email", tags=["Email Processing & Azure Integration"])
app.include_router(storage_routes.router, prefix="/api/storage", tags=["Local Storage"])



# --------------------
# Root + Error handlers
# --------------------
@app.get("/")
async def root():
    return {
        "message": "CV Analyzer API",
        "version": "2.0.0",
        "status": "running",
        "description": "AI-powered CV analysis and job matching system",
        "endpoints": {
            "cv_management": "/api/cv",
            "jd_management": "/api/jd",
            "matching_deterministic": "/api/match",
            "text_match": "/api/match-text",
            "health": "/api/health",
            "auth_login": "/api/auth/login",
            "auth_me": "/api/auth/me",
            "admin_users": "/api/admin/users",
            "careers_admin": "/api/careers/admin",
            "careers_public": "/api/careers/jobs/{public_token}",
            "careers_apply": "/api/careers/jobs/{public_token}/apply",
            "docs": "/docs",
            "redoc": "/redoc",
        },
        "features": [
            "Document processing (PDF, DOCX, OCR)",
            "LLM standardization for CV/JD",
            "Vector embeddings (all-mpnet-base-v2, 768d)",
            "EXACT 32-vector storage for embeddings",
            "Explainable + Hungarian deterministic matching",
            "Bulk processing & top candidate search",
            "JWT Authentication & User Management",
            "Public job postings with secure tokens",
            "Anonymous job applications",
            "Careers page functionality",
        ],
        "qdrant_collections": [
            "cv_documents", "cv_structured", "cv_embeddings",
            "jd_documents", "jd_structured", "jd_embeddings",
            "job_postings_documents", "job_postings_structured", "job_postings_embeddings",
            "applications_documents", "applications_structured", "applications_embeddings",
        ],
    }


from fastapi import HTTPException as _HTTPException


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred. Please try again later.",
            "type": "internal_error",
        },
    )


@app.exception_handler(_HTTPException)
async def http_exception_handler(request, exc):
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "type": "http_error",
        },
    )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    logger.info(f"🚀 Starting server on {host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=False, log_level="info")