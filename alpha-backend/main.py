"""
Root Main Entry Point
Imports and runs the FastAPI application from the app module.
"""

from app.main import app

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False
    )
