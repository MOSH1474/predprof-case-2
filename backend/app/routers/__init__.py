from .auth import router as auth_router
from .allergies import router as allergies_router
from .dishes import router as dishes_router
from .meal_issues import router as meal_issues_router
from .menus import router as menus_router
from .payments import router as payments_router
from .preferences import router as preferences_router

__all__ = [
    "auth_router",
    "allergies_router",
    "dishes_router",
    "meal_issues_router",
    "menus_router",
    "payments_router",
    "preferences_router",
]
