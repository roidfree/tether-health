import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import auth, calls, carer, logs, medications, profile
from app.scheduler import run_scheduler_loop

logger = logging.getLogger("tether.main")


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

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Default Starlette behavior returns a plain-text body, which breaks
    # clients that assume every response is JSON (e.g. the mobile app).
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(medications.router)
app.include_router(logs.router)
app.include_router(calls.router)
app.include_router(carer.router)


@app.get("/health")
def health():
    return {"status": "ok"}
