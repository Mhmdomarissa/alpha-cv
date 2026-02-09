"""
Local Storage Service - File storage for CVs and JDs
Handles all file operations with local filesystem instead of S3.
"""
import os
import shutil
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class S3StorageService:
    """
    Service for storing and retrieving CV/JD files from local storage.
    Replaced S3 implementation to work without AWS credentials.
    """
    
    def __init__(self):
        """Initialize Local storage with base directory."""
        # Use a path relative to the app root or as specified by env
        self.base_dir = os.getenv('LOCAL_STORAGE_DIR', os.path.join(os.getcwd(), 'uploads'))
        
        # Ensure base directories exist
        os.makedirs(os.path.join(self.base_dir, 'cvs'), exist_ok=True)
        os.makedirs(os.path.join(self.base_dir, 'jds'), exist_ok=True)
        
        logger.info(f"✅ LocalStorageService initialized at: {self.base_dir}")
    
    def upload_file(self, local_file_path: str, doc_id: str, doc_type: str, file_ext: str) -> str:
        """
        Copy a file to local storage.
        
        Args:
            local_file_path: Path to local temporary file
            doc_id: Unique document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension (e.g., '.pdf', '.docx')
            
        Returns:
            Absolute path to stored file
        """
        try:
            # Create subfolder path
            sub_folder = f"{doc_type}s"
            dest_dir = os.path.join(self.base_dir, sub_folder)
            os.makedirs(dest_dir, exist_ok=True)
            
            # Destination path
            dest_filename = f"{doc_id}{file_ext}"
            dest_path = os.path.join(dest_dir, dest_filename)
            
            # Copy file
            shutil.copy2(local_file_path, dest_path)
            
            logger.info(f"✅ Stored file locally: {dest_path}")
            return dest_path
            
        except Exception as e:
            logger.error(f"❌ Local storage upload failed: {e}")
            raise Exception(f"Failed to copy file to local storage: {str(e)}")
    
    def get_download_url(self, doc_id: str, doc_type: str, file_ext: str, expires_in: int = 3600) -> str:
        """
        Generate a URL for downloading a file.
        For local storage, this returns an internal API path.
        """
        # We will create an endpoint /api/storage/files/{doc_type}/{doc_id}
        # For now, return a path that the frontend can use with the base API URL
        return f"/api/storage/files/{doc_type}/{doc_id}{file_ext}"
    
    def download_file(self, doc_id: str, doc_type: str, file_ext: str, local_path: str) -> str:
        """
        Copy a file from storage to a local path.
        """
        try:
            source_path = os.path.join(self.base_dir, f"{doc_type}s", f"{doc_id}{file_ext}")
            
            if not os.path.exists(source_path):
                raise FileNotFoundError(f"File not found: {source_path}")
                
            shutil.copy2(source_path, local_path)
            logger.info(f"✅ Copied file: {source_path} -> {local_path}")
            return local_path
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve file: {e}")
            raise Exception(f"Failed to retrieve file: {str(e)}")
    
    def delete_file(self, doc_id: str, doc_type: str, file_ext: str) -> bool:
        """
        Delete a file from local storage.
        """
        try:
            file_path = os.path.join(self.base_dir, f"{doc_type}s", f"{doc_id}{file_ext}")
            
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"✅ Deleted local file: {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete local file: {e}")
            raise Exception(f"Failed to delete local file: {str(e)}")
    
    def file_exists(self, doc_id: str, doc_type: str, file_ext: str) -> bool:
        """
        Check if a file exists locally.
        """
        file_path = os.path.join(self.base_dir, f"{doc_type}s", f"{doc_id}{file_ext}")
        return os.path.exists(file_path)
    
    def get_file_metadata(self, doc_id: str, doc_type: str, file_ext: str) -> dict:
        """
        Get metadata for a local file.
        """
        try:
            file_path = os.path.join(self.base_dir, f"{doc_type}s", f"{doc_id}{file_ext}")
            
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
                
            stats = os.stat(file_path)
            
            return {
                'size': stats.st_size,
                'last_modified': datetime.fromtimestamp(stats.st_mtime),
                'content_type': self._get_content_type(file_ext),
                'metadata': {
                    'doc_id': doc_id,
                    'doc_type': doc_type,
                    'original_extension': file_ext
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get file metadata: {e}")
            raise Exception(f"Failed to get file metadata: {str(e)}")
    
    def _get_content_type(self, file_ext: str) -> str:
        """Get MIME content type based on file extension."""
        content_types = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.txt': 'text/plain',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
        }
        return content_types.get(file_ext.lower(), 'application/octet-stream')
    
    def health_check(self) -> dict:
        """
        Check storage health.
        """
        try:
            # Check if directory is writable
            test_file = os.path.join(self.base_dir, '.health_check')
            with open(test_file, 'w') as f:
                f.write('ok')
            os.remove(test_file)
            
            return {
                'service': 'local_storage',
                'status': 'healthy',
                'base_dir': self.base_dir
            }
        except Exception as e:
            logger.error(f"❌ Storage health check failed: {e}")
            return {
                'service': 'local_storage',
                'status': 'unhealthy',
                'error': str(e),
                'base_dir': self.base_dir
            }


# Global instance
_s3_storage_service: Optional[S3StorageService] = None

def get_s3_storage_service() -> S3StorageService:
    """Get global storage service instance (Kept name S3 for compatibility)."""
    global _s3_storage_service
    if _s3_storage_service is None:
        _s3_storage_service = S3StorageService()
    return _s3_storage_service

