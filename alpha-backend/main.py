import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings, get_cors_config
from app.core.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware, RateLimitMiddleware
from app.api.routes import upload_routes, job_routes, optimized_routes
from app.utils.qdrant_utils import create_collections, get_qdrant_client
from app.services.performance_optimized_service import get_optimized_service

# Configure logging with settings
logging.basicConfig(
    level=getattr(logging, settings.log_level.value),
    format=settings.log_format
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    try:
        logger.info(f"Starting {settings.app_name} v{settings.app_version} in {settings.environment} mode...")
        
        # Log configuration summary
        logger.info(f"Configuration: Host={settings.host}:{settings.port}, Debug={settings.debug}")
        logger.info(f"OpenAI configured: {settings.openai_configured}")
        logger.info(f"Qdrant URL: {settings.qdrant_url}")
        
        # Initialize Qdrant collections
        try:
            create_collections()
            logger.info("Qdrant collections initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant collections: {str(e)}")
            if settings.is_production:
                raise  # Fail fast in production
        
        # Test Qdrant connection
        try:
            client = get_qdrant_client()
            collections = client.get_collections()
            logger.info(f"Qdrant connection successful. Found {len(collections.collections)} collections")
        except Exception as e:
            logger.error(f"Qdrant connection test failed: {str(e)}")
            if settings.is_production:
                raise  # Fail fast in production
        
        # Initialize and warm up optimized service
        try:
            logger.info("🔥 Initializing performance-optimized service...")
            optimized_service = get_optimized_service()
            logger.info("✅ Performance-optimized service ready")
        except Exception as e:
            logger.error(f"Failed to initialize optimized service: {str(e)}")
            # Don't fail startup if optimization fails
        
        logger.info(f"{settings.app_name} started successfully")
        
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    try:
        logger.info("Shutting down CV Job Matching API...")
        # Add any cleanup code here if needed
        logger.info("CV Job Matching API shutdown complete")
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")

# Create FastAPI app with lifespan
app = FastAPI(
    title=settings.app_name,
    description="AI-powered CV analysis and job matching system with advanced vector similarity matching",
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Add custom middleware (order matters!)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    calls=settings.rate_limit_requests,
    period=settings.rate_limit_window
)

# Configure CORS with settings
cors_config = get_cors_config()
app.add_middleware(
    CORSMiddleware,
    **cors_config
)

# Include routers
app.include_router(upload_routes.router, prefix="/api/upload", tags=["upload"])
app.include_router(job_routes.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(optimized_routes.router, prefix="/api/optimized", tags=["optimized-analysis"])

# Include enhanced analysis endpoints (temporarily disabled for compatibility)
# from app.api.endpoints import enhanced_analysis
# app.include_router(enhanced_analysis.router, prefix="/api/enhanced", tags=["enhanced-analysis"])

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "status": "running",
        "endpoints": {
            "upload": "/api/upload",
            "jobs": "/api/jobs",
            "health": "/health",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint."""
    try:
        # Test Qdrant connection
        client = get_qdrant_client()
        collections = client.get_collections()
        
        # Check environment variables
        openai_key = os.getenv("OPENAI_API_KEY")
        qdrant_host = os.getenv("QDRANT_HOST", "qdrant")
        qdrant_port = os.getenv("QDRANT_PORT", "6333")
        
        health_status = {
            "status": "healthy",
            "qdrant": {
                "status": "connected",
                "collections": len(collections.collections),
                "host": qdrant_host,
                "port": qdrant_port
            },
            "environment": {
                "openai_key": "configured" if openai_key else "missing",
                "qdrant_host": qdrant_host,
                "qdrant_port": qdrant_port
            },
            "version": "1.0.0"
        }

        # Check for critical issues
        if not openai_key:
            health_status["status"] = "degraded"
            health_status["warnings"] = ["OPENAI_API_KEY not configured"]
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "version": "1.0.0"
        }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred. Please try again later."
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handler for HTTP exceptions."""
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting server on {settings.host}:{settings.port}")
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.value.lower(),
        workers=1 if settings.reload else settings.workers
    )
