import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv()

from limiter import limiter
from routes import athletes, wellness, ai, auth, session_planner, injuries, attendance, reports, payments, vitals

app = FastAPI()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://athlete-iq-git-main-jineshnanal04-gmailcoms-projects.vercel.app",
        "https://athlete-iq-dun.vercel.app",
        "https://athleteiq.in",
        "https://www.athleteiq.in",
    ],
    allow_origin_regex=r"https://athlete-iq.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Runs inside the middleware stack, so CORSMiddleware attaches headers
    # to the error response instead of stripping them (Starlette gotcha).
    logging.error("Unhandled error on %s: %s\n%s", request.url.path, exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "path": request.url.path},
    )

app.include_router(athletes.router, prefix="/athletes")
app.include_router(wellness.router, prefix="/wellness")
app.include_router(ai.router, prefix="/ai")
app.include_router(auth.router, prefix="/auth")
app.include_router(session_planner.router, prefix="/session-planner") 
app.include_router(injuries.router, prefix="/injuries") 
app.include_router(attendance.router, prefix="/attendance")
app.include_router(reports.router, prefix="/reports")
app.include_router(payments.router, prefix="/payments")
app.include_router(vitals.router, prefix="/vitals")

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    # HEAD support is required so uptime monitors (UptimeRobot, etc.)
    # that default to HEAD requests don't get a 405 and flag the
    # service as down.
    return {"status": "ok"}

@app.get("/")
def root():
    return {"status": "AthleteIQ backend running"}