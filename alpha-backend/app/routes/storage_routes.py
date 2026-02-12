from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
import os
import logging
from app.services.s3_storage import get_s3_storage_service, S3StorageService
from app.utils.qdrant_utils import get_qdrant_utils

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/files/{doc_type}/{doc_id}")
async def get_file(doc_type: str, doc_id: str):
    """
    Serve a file from local storage.
    Automatically detects the correct extension by checking the filesystem.
    """
    try:
        storage_service = get_s3_storage_service()
        base_dir = storage_service.base_dir
        
        # Determine directory (handle both 'cv'/'cvs' and 'jd'/'jds')
        sub_folder = f"{doc_type}s" if not doc_type.endswith('s') else doc_type
        target_dir = os.path.join(base_dir, sub_folder)
        
        if not os.path.exists(target_dir):
            # Try alternate (without 's')
            target_dir = os.path.join(base_dir, doc_type)
            if not os.path.exists(target_dir):
                logger.error(f"❌ Storage directory not found: {base_dir}/{sub_folder}")
                raise HTTPException(status_code=404, detail=f"Directory for {doc_type} not found")
            
        # Since we don't store the extension in some DB records, find by prefix
        matching_files = [f for f in os.listdir(target_dir) if f.startswith(doc_id)]
        
        if not matching_files:
            logger.error(f"❌ File not found with ID {doc_id} in {target_dir}")
            raise HTTPException(status_code=404, detail="File not found")
            
        file_path = os.path.join(target_dir, matching_files[0])
        
        # Get filename for download
        qdrant = get_qdrant_utils()
        collection = f"{doc_type}_documents"
        try:
            doc = qdrant.client.retrieve(collection, ids=[doc_id])
            download_name = doc[0].payload.get("filename", matching_files[0]) if doc else matching_files[0]
        except:
            download_name = matching_files[0]
            
        return FileResponse(
            path=file_path,
            filename=download_name,
            media_type=storage_service._get_content_type(os.path.splitext(file_path)[1])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error serving file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
