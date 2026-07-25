import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, calls, logs, medications, profile
from app.scheduler import run_scheduler_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_task = asyncio.create_task(run_scheduler_loop())
    try:
        yield
    finally:
        scheduler_task.cancel()


app = FastAPI(title="Tether Health API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(medications.router)
app.include_router(logs.router)
app.include_router(calls.router)


@app.get("/health")
def health():
    return {"status": "ok"}
