from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes.dresses import router as dresses_router
from app.routes.recommend import router as recommend_router
from app.routes import edit
from app.routes.chat import router as chat_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dresses_router)
app.include_router(recommend_router)
app.include_router(edit.router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {
        "message": f"{settings.app_name} is running",
        "environment": settings.app_env,
        "status": "ok",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}