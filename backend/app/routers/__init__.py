from .auth import router as auth_router
from .admin_reports import router as admin_reports_router
from .admin_stats import router as admin_stats_router
from .allergies import router as allergies_router
from .dishes import router as dishes_router
from .inventory_transactions import router as inventory_transactions_router
from .meal_issues import router as meal_issues_router
from .menus import router as menus_router
from .payments import router as payments_router
from .preferences import router as preferences_router
from .products import router as products_router
from .purchase_requests import router as purchase_requests_router
from .reviews import router as reviews_router
from .notifications import router as notifications_router
from .users import router as users_router

__all__ = [
    "auth_router",
    "admin_reports_router",
    "admin_stats_router",
    "allergies_router",
    "dishes_router",
    "inventory_transactions_router",
    "meal_issues_router",
    "menus_router",
    "payments_router",
    "preferences_router",
    "products_router",
    "purchase_requests_router",
    "reviews_router",
    "notifications_router",
    "users_router",
]
