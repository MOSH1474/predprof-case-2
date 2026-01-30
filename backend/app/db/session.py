from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ..config import settings

DATABASE_URL = settings.database_url

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_async_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = async_sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
