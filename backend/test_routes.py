import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from routes import athletes, wellness, ai
from fastapi import FastAPI

app = FastAPI()
app.include_router(athletes.router, prefix='/athletes')
app.include_router(wellness.router, prefix='/wellness')
app.include_router(ai.router, prefix='/ai')

print('Routes:')
for r in app.routes:
    print(r.path)