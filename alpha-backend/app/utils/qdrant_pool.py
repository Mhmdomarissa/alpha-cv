"""
Production-Grade Qdrant Connection Pool
======================================

Handles concurrent connections and prevents blocking issues
"""
import asyncio
import logging
import os
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
import threading
import time

logger = logging.getLogger(__name__)

class QdrantConnectionPool:
    """Thread-safe connection pool for Qdrant"""
    
    def __init__(self, host: str = "qdrant", port: int = 6333, max_connections: int = None):
        self.host = host
        self.port = port
        
        # Environment-aware connection limits
        environment = os.getenv("ENVIRONMENT", "development")
        if environment == "production":
            self.max_connections = max_connections or int(os.getenv("QDRANT_MAX_CONNECTIONS", "50"))
        else:
            self.max_connections = max_connections or int(os.getenv("QDRANT_MAX_CONNECTIONS", "10"))
        
        self._pool = asyncio.Queue(maxsize=self.max_connections)
        self._created_connections = 0
        self._lock = threading.Lock()
        self._initialized = False
        
        logger.info(f"🔗 QdrantConnectionPool initialized: {self.max_connections} max connections (environment: {environment})")
        
    async def initialize(self):
        """Initialize the connection pool"""
        if self._initialized:
            return
            
        # Create initial connections - environment-aware
        environment = os.getenv("ENVIRONMENT", "development")
        initial_connections = min(5, self.max_connections) if environment == "development" else min(10, self.max_connections)
        
        for _ in range(initial_connections):
            client = await self._create_client()
            await self._pool.put(client)
            self._created_connections += 1
            
        self._initialized = True
        logger.info(f"🗄 Qdrant connection pool initialized with {self._created_connections} connections")
    
    async def _create_client(self) -> QdrantClient:
        """Create a new Qdrant client"""
        client = QdrantClient(host=self.host, port=self.port)
        
        # Ensure collections exist
        await self._ensure_collections_exist(client)
        return client
    
    async def _ensure_collections_exist(self, client: QdrantClient):
        """Ensure all required collections exist"""
        collections = {
            "cv_documents": VectorParams(size=768, distance=Distance.COSINE),
            "jd_documents": VectorParams(size=768, distance=Distance.COSINE),
            "cv_structured": VectorParams(size=768, distance=Distance.COSINE),
            "jd_structured": VectorParams(size=768, distance=Distance.COSINE),
            "cv_embeddings": VectorParams(size=768, distance=Distance.COSINE),
            "jd_embeddings": VectorParams(size=768, distance=Distance.COSINE),
            "job_postings_structured": VectorParams(size=768, distance=Distance.COSINE),
        }
        
        for name, cfg in collections.items():
            if not client.collection_exists(name):
                logger.info(f"📋 Creating collection: {name}")
                client.create_collection(collection_name=name, vectors_config=cfg)
    
    def get_client(self) -> QdrantClient:
        """Get a client from the pool (sync version)"""
        if not self._initialized:
            # Initialize synchronously
            import asyncio
            asyncio.run(self.initialize())
        
        # Try to get existing connection
        try:
            client = self._pool.get_nowait()
        except asyncio.QueueEmpty:
            # Create new connection if under limit
            with self._lock:
                if self._created_connections < self.max_connections:
                    import asyncio
                    client = asyncio.run(self._create_client())
                    self._created_connections += 1
                    logger.info(f"🔗 Created new Qdrant connection ({self._created_connections}/{self.max_connections})")
                else:
                    # Wait for available connection
                    import asyncio
                    client = asyncio.run(self._pool.get())
        
        return client
    
    def return_client(self, client: QdrantClient):
        """Return a client to the pool"""
        try:
            self._pool.put_nowait(client)
        except asyncio.QueueFull:
            # Pool is full, close this connection
            logger.warning("🔗 Connection pool full, closing excess connection")
            # Note: QdrantClient doesn't have explicit close method
    
    @asynccontextmanager
    async def get_client_async(self):
        """Get a client from the pool (async version)"""
        if not self._initialized:
            await self.initialize()
        
        # Try to get existing connection
        try:
            client = self._pool.get_nowait()
        except asyncio.QueueEmpty:
            # Create new connection if under limit
            with self._lock:
                if self._created_connections < self.max_connections:
                    client = await self._create_client()
                    self._created_connections += 1
                    logger.info(f"🔗 Created new Qdrant connection ({self._created_connections}/{self.max_connections})")
                else:
                    # Wait for available connection
                    client = await self._pool.get()
        
        try:
            yield client
        finally:
            # Return client to pool
            try:
                self._pool.put_nowait(client)
            except asyncio.QueueFull:
                # Pool is full, close this connection
                logger.warning("🔗 Connection pool full, closing excess connection")
                # Note: QdrantClient doesn't have explicit close method
    
    async def health_check(self) -> Dict[str, Any]:
        """Check pool health"""
        try:
            async with self.get_client_async() as client:
                cols = client.get_collections()
                return {
                    "status": "healthy",
                    "collections": [c.name for c in cols.collections],
                    "pool_size": self._pool.qsize(),
                    "max_connections": self.max_connections,
                    "created_connections": self._created_connections
                }
        except Exception as e:
            logger.error(f"❌ Qdrant pool health check failed: {e}")
            return {
                "status": "unhealthy", 
                "error": str(e),
                "pool_size": self._pool.qsize(),
                "max_connections": self.max_connections
            }

# Global connection pool
_qdrant_pool: Optional[QdrantConnectionPool] = None

async def get_qdrant_pool() -> QdrantConnectionPool:
    """Get the global Qdrant connection pool"""
    global _qdrant_pool
    if _qdrant_pool is None:
        # Environment-aware pool creation
        environment = os.getenv("ENVIRONMENT", "development")
        host = os.getenv("QDRANT_HOST", "qdrant")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        
        _qdrant_pool = QdrantConnectionPool(host=host, port=port)
        await _qdrant_pool.initialize()
    return _qdrant_pool
