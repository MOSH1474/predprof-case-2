from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .routers import auth_router

app = FastAPI(title="Backend API", root_path="/api/v1")
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "meow"}


@app.get("/db-check")
async def db_check(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"db": "ok"}
