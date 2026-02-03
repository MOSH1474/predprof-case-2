from fastapi import FastAPI

from .docs import public_docs
from .routers import (
    allergies_router,
    auth_router,
    dishes_router,
    inventory_transactions_router,
    meal_issues_router,
    menus_router,
    payments_router,
    preferences_router,
    products_router,
    purchase_requests_router,
    reviews_router,
)

OPENAPI_TAGS = [
    {"name": "auth", "description": "Аутентификация и сессии пользователей"},
    {"name": "allergies", "description": "Аллергии и управление ими"},
    {"name": "dishes", "description": "Блюда и управление ими"},
    {"name": "menus", "description": "Меню и позиции меню"},
    {"name": "preferences", "description": "Предпочтения и аллергия студентов"},
    {"name": "payments", "description": "One-time and subscription payments"},
    {"name": "meal-issues", "description": "Meal issuance and confirmations"},
    {"name": "products", "description": "Products and inventory catalog"},
    {"name": "inventory-transactions", "description": "Inventory movements and adjustments"},
    {"name": "purchase-requests", "description": "Заявки на закупку и согласование"},
    {"name": "reviews", "description": "Dish reviews and ratings"},
]

app = FastAPI(title="Backend API", root_path="/api/v1", openapi_tags=OPENAPI_TAGS)
app.include_router(auth_router)
app.include_router(allergies_router)
app.include_router(dishes_router)
app.include_router(inventory_transactions_router)
app.include_router(meal_issues_router)
app.include_router(menus_router)
app.include_router(payments_router)
app.include_router(preferences_router)
app.include_router(products_router)
app.include_router(purchase_requests_router)
app.include_router(reviews_router)


@app.get("/health", **public_docs())
def health():
    return {"status": "ok"}
