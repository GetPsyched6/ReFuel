"""
ReFuel - Competitive Intelligence Platform
FastAPI main application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from models.database import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await db.init_schema()
    print("✅ Database initialized")
    
    yield
    
    # Shutdown
    print("👋 Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


# Import and include routers
from api.routes import scraper, comparison, history, ai
app.include_router(scraper.router, prefix=f"{settings.API_PREFIX}/scraper", tags=["scraper"])
app.include_router(comparison.router, prefix=f"{settings.API_PREFIX}/comparison", tags=["comparison"])
app.include_router(history.router, prefix=f"{settings.API_PREFIX}/history", tags=["history"])
app.include_router(ai.router, prefix=f"{settings.API_PREFIX}/ai", tags=["ai"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )

