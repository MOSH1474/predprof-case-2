from fastapi import FastAPI

from .docs import public_docs
from .routers import (
    admin_reports_router,
    admin_stats_router,
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

APP_DESCRIPTION = """
API системы управления школьной столовой.

## Роли
- `student` — ученик: просмотр меню, оплата, подтверждение питания, отзывы.
- `cook` — повар: блюда, меню, выдача питания, склад, заявки на закупку.
- `admin` — администратор: доступ ко всем разделам, согласование заявок, статистика, отчеты.

## Авторизация
- Регистрация: `POST /auth/register` (роль ученика).
- Вход: `POST /auth/login`.
- Все защищенные методы требуют заголовок `Authorization: Bearer <token>`.

## Доступ
- В описании каждого метода указан список ролей.
- Администратор имеет доступ ко всем защищенным ресурсам.

## Форматы дат
- `date`: `YYYY-MM-DD`
- `datetime`: ISO 8601, например `2026-02-03T10:30:00Z`

## Сценарий: от оплаты до подтверждения
1. Ученик оплачивает меню: `POST /payments/one-time`.
   - Оплата сразу создает выдачу со статусом `issued` (ожидание выдачи).
2. При оплате абонемента: `POST /payments/subscription`.
   - Для всех меню, попадающих в период абонемента, создаются выдачи со статусом `issued` (если есть остатки).
3. Повар выдает питание: `POST /meal-issues/serve`.
   - Если выдача еще не создана, она создается автоматически при условии оплаты.
4. Ученик подтверждает получение: `POST /meal-issues/me`.
"""

OPENAPI_TAGS = [
    {"name": "admin-reports", "description": "Отчеты по питанию и затратам (админ)"},
    {"name": "admin-stats", "description": "Статистика оплат и посещаемости (админ)"},
    {"name": "auth", "description": "Аутентификация и сессии пользователей"},
    {"name": "allergies", "description": "Аллергии и управление ими"},
    {"name": "dishes", "description": "Блюда и управление ими"},
    {"name": "menus", "description": "Меню и позиции меню"},
    {"name": "preferences", "description": "Пищевые предпочтения студентов"},
    {"name": "payments", "description": "Оплаты: разовые и абонементы"},
    {"name": "meal-issues", "description": "Выдача и подтверждение питания"},
    {"name": "products", "description": "Продукты и каталог склада"},
    {"name": "inventory-transactions", "description": "Движение склада и корректировки"},
    {"name": "purchase-requests", "description": "Заявки на закупку и согласование"},
    {"name": "reviews", "description": "Отзывы и оценки блюд"},
]

app = FastAPI(
    title="API школьной столовой",
    description=APP_DESCRIPTION,
    root_path="/api/v1",
    openapi_tags=OPENAPI_TAGS,
)
app.include_router(admin_reports_router)
app.include_router(admin_stats_router)
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


@app.get(
    "/health",
    **public_docs(notes="Проверка доступности сервиса."),
    summary="Проверка здоровья",
)
def health():
    return {"status": "ok"}
