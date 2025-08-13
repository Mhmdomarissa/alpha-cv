"""
Custom exception classes following best practices
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status

class CVAnalyzerException(Exception):
    """Base exception for CV Analyzer application"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

class ValidationError(CVAnalyzerException):
    """Raised when input validation fails"""
    pass

class ProcessingError(CVAnalyzerException):
    """Raised when file processing fails"""
    pass

class AIServiceError(CVAnalyzerException):
    """Raised when AI services (OpenAI, embeddings) fail"""
    pass

class VectorDatabaseError(CVAnalyzerException):
    """Raised when Qdrant operations fail"""
    pass

class FileError(CVAnalyzerException):
    """Raised when file operations fail"""
    pass

# HTTP Exception helpers
class HTTPExceptionFactory:
    """Factory for creating standardized HTTP exceptions"""
    
    @staticmethod
    def bad_request(message: str, details: Optional[Dict[str, Any]] = None) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Bad Request",
                "message": message,
                "details": details or {}
            }
        )
    
    @staticmethod
    def not_found(resource: str, resource_id: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Not Found",
                "message": f"{resource} not found",
                "resource_id": resource_id
            }
        )
    
    @staticmethod
    def internal_server_error(message: str = "Internal server error") -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal Server Error",
                "message": message
            }
        )
    
    @staticmethod
    def service_unavailable(service: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Service Unavailable",
                "message": f"{service} is currently unavailable",
                "service": service
            }
        )
    
    @staticmethod
    def file_too_large(max_size: int) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "File Too Large",
                "message": f"File size exceeds maximum allowed size of {max_size} bytes",
                "max_size": max_size
            }
        )
    
    @staticmethod
    def unsupported_file_type(file_type: str, supported_types: list) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": "Unsupported File Type",
                "message": f"File type '{file_type}' is not supported",
                "file_type": file_type,
                "supported_types": supported_types
            }
        )