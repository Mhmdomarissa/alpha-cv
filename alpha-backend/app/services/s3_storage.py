"""
S3 Storage Service - File storage for CVs and JDs
Handles all file operations with AWS S3 for unlimited, scalable storage.
"""
import boto3
import os
import logging
from typing import Optional
from datetime import datetime
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class S3StorageService:
    """
    Service for storing and retrieving CV/JD files from S3.
    Replaces local EBS storage to prevent disk space issues.
    """
    
    def __init__(self):
        """Initialize S3 client with AWS credentials from environment."""
        self.s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION', 'eu-north-1'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'alphacv-files-eu-north-1')
        logger.info(f"✅ S3StorageService initialized with bucket: {self.bucket_name}")
    
    def upload_file(self, local_file_path: str, doc_id: str, doc_type: str, file_ext: str) -> str:
        """
        Upload a file to S3.
        
        Args:
            local_file_path: Path to local file
            doc_id: Unique document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension (e.g., '.pdf', '.docx')
            
        Returns:
            S3 URI (e.g., 's3://bucket/cvs/uuid.pdf')
        """
        try:
            # Create S3 key with organized structure
            s3_key = f"{doc_type}s/{doc_id}{file_ext}"
            
            # Upload file with metadata
            self.s3_client.upload_file(
                local_file_path,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'Metadata': {
                        'doc_id': doc_id,
                        'doc_type': doc_type,
                        'upload_date': datetime.utcnow().isoformat(),
                        'original_extension': file_ext
                    },
                    'ServerSideEncryption': 'AES256',  # Encrypt at rest
                    'ContentType': self._get_content_type(file_ext)
                }
            )
            
            s3_uri = f"s3://{self.bucket_name}/{s3_key}"
            logger.info(f"✅ Uploaded file to S3: {s3_uri}")
            return s3_uri
            
        except ClientError as e:
            logger.error(f"❌ S3 upload failed: {e}")
            raise Exception(f"Failed to upload file to S3: {str(e)}")
    
    def get_download_url(self, doc_id: str, doc_type: str, file_ext: str, expires_in: int = 3600) -> str:
        """
        Generate a pre-signed URL for downloading a file.
        
        Args:
            doc_id: Document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension
            expires_in: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            Pre-signed URL for downloading
        """
        try:
            s3_key = f"{doc_type}s/{doc_id}{file_ext}"
            
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expires_in
            )
            
            logger.info(f"✅ Generated download URL for {s3_key} (expires in {expires_in}s)")
            return url
            
        except ClientError as e:
            logger.error(f"❌ Failed to generate download URL: {e}")
            raise Exception(f"Failed to generate download URL: {str(e)}")
    
    def download_file(self, doc_id: str, doc_type: str, file_ext: str, local_path: str) -> str:
        """
        Download a file from S3 to local storage.
        
        Args:
            doc_id: Document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension
            local_path: Local path to save file
            
        Returns:
            Local file path
        """
        try:
            s3_key = f"{doc_type}s/{doc_id}{file_ext}"
            
            self.s3_client.download_file(
                self.bucket_name,
                s3_key,
                local_path
            )
            
            logger.info(f"✅ Downloaded file from S3: {s3_key} -> {local_path}")
            return local_path
            
        except ClientError as e:
            logger.error(f"❌ Failed to download file from S3: {e}")
            raise Exception(f"Failed to download file from S3: {str(e)}")
    
    def delete_file(self, doc_id: str, doc_type: str, file_ext: str) -> bool:
        """
        Delete a file from S3.
        
        Args:
            doc_id: Document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension
            
        Returns:
            True if successful
        """
        try:
            s3_key = f"{doc_type}s/{doc_id}{file_ext}"
            
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            logger.info(f"✅ Deleted file from S3: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"❌ Failed to delete file from S3: {e}")
            raise Exception(f"Failed to delete file from S3: {str(e)}")
    
    def file_exists(self, doc_id: str, doc_type: str, file_ext: str) -> bool:
        """
        Check if a file exists in S3.
        
        Args:
            doc_id: Document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension
            
        Returns:
            True if file exists
        """
        try:
            s3_key = f"{doc_type}s/{doc_id}{file_ext}"
            
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            else:
                logger.error(f"❌ Error checking file existence: {e}")
                raise
    
    def get_file_metadata(self, doc_id: str, doc_type: str, file_ext: str) -> dict:
        """
        Get metadata for a file in S3.
        
        Args:
            doc_id: Document ID
            doc_type: Type of document ('cv' or 'jd')
            file_ext: File extension
            
        Returns:
            Dictionary with file metadata
        """
        try:
            s3_key = f"{doc_type}s/{doc_id}{file_ext}"
            
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            return {
                'size': response['ContentLength'],
                'last_modified': response['LastModified'],
                'content_type': response.get('ContentType'),
                'metadata': response.get('Metadata', {})
            }
            
        except ClientError as e:
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
        Check S3 connection health.
        
        Returns:
            Health status dictionary
        """
        try:
            # Try to list bucket (lightweight operation)
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            
            return {
                'service': 's3_storage',
                'status': 'healthy',
                'bucket': self.bucket_name,
                'region': os.getenv('AWS_REGION', 'eu-north-1')
            }
        except ClientError as e:
            logger.error(f"❌ S3 health check failed: {e}")
            return {
                'service': 's3_storage',
                'status': 'unhealthy',
                'error': str(e),
                'bucket': self.bucket_name
            }


# Global instance
_s3_storage_service: Optional[S3StorageService] = None

def get_s3_storage_service() -> S3StorageService:
    """Get global S3 storage service instance."""
    global _s3_storage_service
    if _s3_storage_service is None:
        _s3_storage_service = S3StorageService()
    return _s3_storage_service

