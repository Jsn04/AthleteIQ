from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import athletes, wellness, ai
from dotenv import load_dotenv
from routes import athletes, wellness, ai, auth 

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://athlete-iq.vercel.app",  # ← replace with your actual Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(athletes.router, prefix="/athletes")
app.include_router(wellness.router, prefix="/wellness")
app.include_router(ai.router, prefix="/ai")
app.include_router(auth.router, prefix='/auth')

@app.get("/")
def root():
    return {"status": "AthleteIQ backend running"}