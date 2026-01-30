import importlib
import os
import sys

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
async def test_app():
    import app.db as db_module
    import app.db.deps as deps_module
    import app.db.session as session_module
    import app.db.base as base_module
    import app.main as main_module

    importlib.reload(session_module)
    importlib.reload(base_module)
    importlib.reload(deps_module)
    importlib.reload(db_module)

    for name in list(sys.modules):
        if name.startswith("app.models."):
            del sys.modules[name]
    import app.models as models_module
    importlib.reload(models_module)
    importlib.reload(main_module)

    test_db_path = "./test.db"
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    engine = create_async_engine(f"sqlite+aiosqlite:///{test_db_path}", pool_pre_ping=True)
    SessionLocal = async_sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    session_module.engine = engine
    session_module.SessionLocal = SessionLocal
    deps_module.SessionLocal = SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = SessionLocal

    from app.db import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield main_module.app

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest.fixture()
async def client(test_app):
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
        yield ac
