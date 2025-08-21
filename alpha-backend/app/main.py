"""
Main Application - FastAPI Entry Point
Consolidated, clean application setup with proper middleware and routing.
Single responsibility: Application configuration and startup.
"""
import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Import routes
from app.routes import cv_routes, jd_routes, special_routes

# Import services for startup initialization
from app.utils.qdrant_utils import get_qdrant_utils
from app.services.embedding_service import get_embedding_service
from app.utils.cache import get_cache_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    try:
        logger.info("🚀 Starting CV Analyzer API...")

        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.error("❌ OPENAI_API_KEY environment variable is required")
            raise Exception("OPENAI_API_KEY not configured")

        qdrant_host = os.getenv("QDRANT_HOST", "qdrant")
        qdrant_port = os.getenv("QDRANT_PORT", "6333")
        logger.info(f"🔧 Configuration: Qdrant={qdrant_host}:{qdrant_port}")

        logger.info("🗄 Initializing Qdrant database...")
        get_qdrant_utils()
        logger.info("✅ Qdrant database initialized successfully")

        logger.info("🧠 Initializing embedding service...")
        get_embedding_service()
        logger.info("✅ Embedding service initialized successfully")

        logger.info("🗄 Initializing cache service...")
        get_cache_service()
        logger.info("✅ Cache service initialized successfully")

        logger.info("🎉 CV Analyzer API started successfully")
    except Exception as e:
        logger.error(f"❌ Startup failed: {str(e)}")
        raise

    yield

    try:
        logger.info("🛑 Shutting down CV Analyzer API...")
        cache_service = get_cache_service()
        cache_service.cleanup_expired()
        logger.info("🧹 Cache cleaned up")
        logger.info("✅ CV Analyzer API shutdown complete")
    except Exception as e:
        logger.error(f"❌ Shutdown error: {str(e)}")

app = FastAPI(
    title="CV Analyzer API",
    description="AI-powered CV analysis and job matching system with advanced vector similarity matching",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route groups
app.include_router(cv_routes.router, prefix="/api/cv", tags=["CV Management"])
app.include_router(jd_routes.router, prefix="/api/jd", tags=["Job Description Management"])
app.include_router(special_routes.router, prefix="/api", tags=["Matching & System"])

# Legacy aliases for your frontend
app.include_router(cv_routes.router, prefix="/api/jobs", tags=["Legacy CV Routes"])
app.include_router(jd_routes.router, prefix="/api/jobs", tags=["Legacy JD Routes"])
app.include_router(special_routes.router, prefix="/api/jobs", tags=["Legacy Matching Routes"])

@app.get("/")
async def root():
    return {
        "message": "CV Analyzer API",
        "version": "2.0.0",
        "description": "AI-powered CV analysis and job matching system",
        "status": "running",
        "endpoints": {
            "cv_management": "/api/cv",
            "jd_management": "/api/jd",
            "matching": "/api/match-cv-jd",
            "health": "/api/health",
            "documentation": "/docs",
            "alternative_docs": "/redoc"
        },
        "features": [
            "Document processing (PDF, DOCX, images)",
            "AI-powered text standardization",
            "Vector embeddings (all-mpnet-base-v2)",
            "Granular skill and responsibility matching",
            "Bulk processing and candidate search",
            "Real-time text matching"
        ]
    }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error","message": "An unexpected error occurred. Please try again later.","type": "internal_error"}
    )

from fastapi import HTTPException as _HTTPException
@app.exception_handler(_HTTPException)
async def http_exception_handler(request, exc):
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail,"status_code": exc.status_code,"type": "http_error"}
    )

@app.get("/health-check")
async def health_check_alternative():
    try:
        qdrant_utils = get_qdrant_utils()
        qdrant_health = qdrant_utils.health_check()
        return {
            "status": "healthy" if qdrant_health["status"] == "healthy" else "degraded",
            "qdrant": qdrant_health,
            "api_version": "2.0.0",
            "environment": {
                "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
                "qdrant_host": os.getenv("QDRANT_HOST", "qdrant"),
                "qdrant_port": os.getenv("QDRANT_PORT", "6333")
            }
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"status":"unhealthy","error":str(e),"api_version":"2.0.0"})

@app.get("/health")
async def health_legacy():
    try:
        qdrant_utils = get_qdrant_utils()
        qdrant_health = qdrant_utils.health_check()
        return {
            "status": "healthy" if qdrant_health["status"] == "healthy" else "degraded",
            "qdrant": qdrant_health,
            "api_version": "2.0.0",
            "environment": {
                "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
                "qdrant_host": os.getenv("QDRANT_HOST", "qdrant"),
                "qdrant_port": os.getenv("QDRANT_PORT", "6333")
            }
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"status":"unhealthy","error":str(e),"api_version":"2.0.0"})

if __name__ == "__main__":
    import uvicorn, os
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    logger.info(f"🚀 Starting server on {host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=False, log_level="info")