from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.core.config import settings

# Ensure installers directory exists
os.makedirs("static/installers", exist_ok=True)

# Import API routers
from app.api.v1.auth import router as auth_router
from app.api.v1.organizations import router as org_router
from app.api.v1.questions import router as questions_router
from app.api.v1.imports import router as imports_router
from app.api.v1.assessments import router as assessments_router
from app.api.v1.proctoring import router as proctoring_router
from app.api.v1.sap import router as sap_router
from app.api.v1.billing import router as billing_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this in production environment configs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach Routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(org_router, prefix=f"{settings.API_V1_STR}/organizations", tags=["Organizations"])
app.include_router(questions_router, prefix=f"{settings.API_V1_STR}/questions", tags=["Question Bank"])
app.include_router(imports_router, prefix=f"{settings.API_V1_STR}/imports", tags=["Import Engine"])
app.include_router(assessments_router, prefix=f"{settings.API_V1_STR}/assessments", tags=["Assessment Management"])
app.include_router(proctoring_router, prefix=f"{settings.API_V1_STR}/proctoring", tags=["AI Proctoring"])
app.include_router(sap_router, prefix=f"{settings.API_V1_STR}/sap", tags=["SAP Integration"])
app.include_router(billing_router, prefix=f"{settings.API_V1_STR}/billing", tags=["Billing & Subscription"])

app.mount(f"{settings.API_V1_STR}/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "documentation": "/docs"
    }
