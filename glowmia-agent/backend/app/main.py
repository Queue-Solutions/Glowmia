# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from app.config import get_settings
# from app.routes.dresses import router as dresses_router
# from app.routes.recommend import router as recommend_router
# from app.routes import edit
# from app.routes.chat import router as chat_router

# settings = get_settings()

# app = FastAPI(
#     title=settings.app_name,
#     version="0.1.0",
# )

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# app.include_router(dresses_router)
# app.include_router(recommend_router)
# app.include_router(edit.router)
# app.include_router(chat_router)


# @app.get("/")
# def root():
#     return {
#         "message": f"{settings.app_name} is running",
#         "environment": settings.app_env,
#         "status": "ok",
#     }


# @app.get("/health")
# def health_check():
#     return {"status": "healthy"}

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes.dresses import router as dresses_router
from app.routes.recommend import router as recommend_router
from app.routes import edit
from app.routes.chat import router as chat_router
import traceback

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

# Temporary broader CORS for debugging production.
# Later you can restrict this to exact domains only.
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://glowmia.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        print(f"[REQ] {request.method} {request.url.path}")
        response = await call_next(request)
        print(f"[RES] {request.method} {request.url.path} -> {response.status_code}")
        return response
    except Exception as e:
        print(f"[ERR] {request.method} {request.url.path} -> {e}")
        traceback.print_exc()
        raise


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