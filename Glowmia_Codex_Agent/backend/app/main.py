# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware

# from app.api.router import api_router
# from app.core.config import settings


# def create_application() -> FastAPI:
#     app = FastAPI(
#         title=settings.app_name,
#         version="0.1.0",
#         description="Glowmia AI fashion assistant backend",
#     )

#     app.add_middleware(
#         CORSMiddleware,
#         allow_origins=["*"],
#         allow_credentials=True,
#         allow_methods=["*"],
#         allow_headers=["*"],
#     )

#     app.include_router(api_router, prefix="/api/v1")

#     return app


# app = create_application()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Glowmia AI fashion assistant backend",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root():
        return {"message": "Glowmia backend is running"}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_application()