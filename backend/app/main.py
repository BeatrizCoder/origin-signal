from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title="OriginSignal",
    description="Trade Risk Intelligence Platform — BR→EU",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "product": "OriginSignal",
        "version": app.version,
        "status": "running",
        "mongo_uri": settings.mongo_uri,
    }

app.include_router(router)