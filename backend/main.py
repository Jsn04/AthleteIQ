from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import athletes, wellness, ai, auth, session_planner  # ← add
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://athlete-iq-git-main-jineshnanal04-gmailcoms-projects.vercel.app",
        "https://athlete-iq-dun.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(athletes.router, prefix="/athletes")
app.include_router(wellness.router, prefix="/wellness")
app.include_router(ai.router, prefix="/ai")
app.include_router(auth.router, prefix="/auth")
app.include_router(session_planner.router, prefix="/session-planner") 

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"status": "AthleteIQ backend running"}