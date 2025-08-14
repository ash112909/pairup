from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_db
from app.routes import auth, users, matches, projects
from app.core.config import settings

app = FastAPI(title="PairUp Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CLIENT_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.on_event("startup")
def startup_db():
    connect_db()

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])

@app.get("/api/health")
def health():
    return {
        "status": "OK",
        "timestamp": settings.current_time(),
        "uptime": settings.uptime()
    }
