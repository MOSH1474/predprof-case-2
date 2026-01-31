from .auth import router as auth_router
from .allergies import router as allergies_router
from .dishes import router as dishes_router
from .menus import router as menus_router
from .preferences import router as preferences_router

__all__ = [
    "auth_router",
    "allergies_router",
    "dishes_router",
    "menus_router",
    "preferences_router",
]
