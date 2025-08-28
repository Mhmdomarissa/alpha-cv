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
from app.routes import cv_routes, jd_routes, special_routes

# Services init
from app.utils.qdrant_utils import get_qdrant_utils
from app.services.embedding_service import get_embedding_service
from app.utils.cache import get_cache_service

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

        # Required envs
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.error("❌ OPENAI_API_KEY environment variable is required")
            raise RuntimeError("OPENAI_API_KEY not configured")

        qdrant_host = os.getenv("QDRANT_HOST", "qdrant")
        qdrant_port = os.getenv("QDRANT_PORT", "6333")
        logger.info(f"🔧 Qdrant: {qdrant_host}:{qdrant_port}")

        # Initialize core dependencies
        logger.info("🗄 Initializing Qdrant client & collections...")
        get_qdrant_utils()  # ensures collections exist
        logger.info("✅ Qdrant ready")

        logger.info("🧠 Warming embedding service...")
        get_embedding_service()
        logger.info("✅ Embedding service ready")

        logger.info("🧰 Initializing cache service...")
        get_cache_service()
        logger.info("✅ Cache ready")

        logger.info("🎉 Startup complete")
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

    # Hand over control to FastAPI
    yield

    # Shutdown
    try:
        logger.info("🛑 Shutting down...")
        get_cache_service().cleanup_expired()
        logger.info("🧹 Cache cleaned")
        logger.info("✅ Shutdown complete")
    except Exception as e:
        logger.error(f"❌ Shutdown error: {e}")


app = FastAPI(
    title="CV Analyzer API",
    description="AI-powered CV analysis and job matching with explainable, deterministic scoring.",
    version="2.0.0",
    lifespan=lifespan,
)

# --------------------
# CORS
# --------------------
# Allow a specific origin if provided, otherwise allow all (dev)
frontend_origin = os.getenv("FRONTEND_ORIGIN")
allow_origins = [frontend_origin] if frontend_origin else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# Routes
# --------------------
app.include_router(cv_routes.router, prefix="/api/cv", tags=["CV Management"])
app.include_router(jd_routes.router, prefix="/api/jd", tags=["Job Description Management"])
app.include_router(special_routes.router, prefix="/api", tags=["Matching & System"])

# Keep legacy aliases for FE compatibility (can remove later)
app.include_router(cv_routes.router, prefix="/api/jobs", tags=["Legacy CV Routes"])
app.include_router(jd_routes.router, prefix="/api/jobs", tags=["Legacy JD Routes"])
app.include_router(special_routes.router, prefix="/api/jobs", tags=["Legacy Matching Routes"])


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
            "matching_explainable": "/api/match-cv-jd",
            "matching_deterministic": "/api/match",
            "text_match": "/api/match-text",
            "health": "/api/health",
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
        ],
        "qdrant_collections": [
            "cv_documents", "cv_structured", "cv_embeddings",
            "jd_documents", "jd_structured", "jd_embeddings",
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
