from fastapi import FastAPI

from .docs import public_docs
from .routers import (
    allergies_router,
    auth_router,
    dishes_router,
    meal_issues_router,
    menus_router,
    preferences_router,
)

OPENAPI_TAGS = [
    {"name": "auth", "description": "Аутентификация и сессии пользователей"},
    {"name": "allergies", "description": "Аллергии и управление ими"},
    {"name": "dishes", "description": "Блюда и управление ими"},
    {"name": "menus", "description": "Меню и позиции меню"},
    {"name": "preferences", "description": "Предпочтения и аллергия студентов"},
    {"name": "meal-issues", "description": "Meal issuance and confirmations"},
]

app = FastAPI(title="Backend API", root_path="/api/v1", openapi_tags=OPENAPI_TAGS)
app.include_router(auth_router)
app.include_router(allergies_router)
app.include_router(dishes_router)
app.include_router(meal_issues_router)
app.include_router(menus_router)
app.include_router(preferences_router)


@app.get("/health", **public_docs())
def health():
    return {"status": "ok"}
