import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime

from app.utils.qdrant_utils import get_qdrant_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/system-status")
async def get_system_status() -> JSONResponse:
    """Get comprehensive system status and statistics."""
    try:
        client = get_qdrant_client()
        collections = client.get_collections()
        
        # Get collection stats
        cvs_count = 0
        jds_count = 0
        
        try:
            # Count CVs
            cv_points = client.scroll(collection_name="cvs", limit=1000)
            cvs_count = len(cv_points[0]) if cv_points[0] else 0
        except Exception as e:
            logger.warning(f"Could not count CVs: {e}")
        
        try:
            # Count JDs
            jd_points = client.scroll(collection_name="jds", limit=1000)
            jds_count = len(jd_points[0]) if jd_points[0] else 0
        except Exception as e:
            logger.warning(f"Could not count JDs: {e}")
        
        # Check environment
        import os
        openai_key = os.getenv("OPENAI_API_KEY")
        qdrant_host = os.getenv("QDRANT_HOST", "qdrant")
        qdrant_port = os.getenv("QDRANT_PORT", "6333")
        
        status = {
            "status": "operational",
            "timestamp": datetime.now().isoformat(),
            "system_stats": {
                "total_cvs": cvs_count,
                "total_jds": jds_count,
                "api_status": "operational",
                "mock_mode": not bool(openai_key),
                "collections_available": [col.name for col in collections.collections]
            },
            "environment": {
                "openai_configured": bool(openai_key),
                "qdrant_host": qdrant_host,
                "qdrant_port": qdrant_port,
                "collections_count": len(collections.collections)
            }
        }
        
        return JSONResponse(status)
        
    except Exception as e:
        logger.error(f"System status check failed: {str(e)}")
        return JSONResponse({
            "status": "degraded",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }, status_code=500)