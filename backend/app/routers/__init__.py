from .auth import router as auth_router
from .allergies import router as allergies_router
from .preferences import router as preferences_router

__all__ = ["auth_router", "allergies_router", "preferences_router"]
