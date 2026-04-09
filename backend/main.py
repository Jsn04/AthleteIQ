import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

from routes import athletes, wellness, ai, auth, session_planner, injuries, attendance, reports, payments

app = FastAPI()

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

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"status": "AthleteIQ backend running"}