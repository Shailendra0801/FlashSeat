from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models.user import User   # noqa: F401

app = FastAPI(title="Flashseat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    print(">>> Tables known to Base:", Base.metadata.tables.keys())
    print(">>> Connecting to DB and creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(">>> Done!")

@app.get("/")
def root():
    return {"message": "Flashseat API is running"}