from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .associations import user_allergies
from .utils import utcnow

if TYPE_CHECKING:
    from .allergy import Allergy
    from .inventory_transaction import InventoryTransaction
    from .meal_issue import MealIssue
    from .notification import Notification
    from .payment import Payment
    from .purchase_request import PurchaseRequest
    from .review import Review
    from .user_notification import UserNotification


class UserRole(str, Enum):
    STUDENT = "student"
    COOK = "cook"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.STUDENT
    )
    dietary_preferences: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    allergies: Mapped[list["Allergy"]] = relationship(
        secondary=user_allergies, back_populates="users"
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    meal_issues: Mapped[list["MealIssue"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", foreign_keys="MealIssue.user_id"
    )
    served_meal_issues: Mapped[list["MealIssue"]] = relationship(
        foreign_keys="MealIssue.served_by_id"
    )
    purchase_requests: Mapped[list["PurchaseRequest"]] = relationship(
        back_populates="requested_by",
        cascade="all, delete-orphan",
        foreign_keys="PurchaseRequest.requested_by_id",
    )
    approved_purchase_requests: Mapped[list["PurchaseRequest"]] = relationship(
        back_populates="approved_by",
        foreign_keys="PurchaseRequest.approved_by_id",
    )
    inventory_transactions: Mapped[list["InventoryTransaction"]] = relationship(
        back_populates="created_by"
    )
    created_notifications: Mapped[list["Notification"]] = relationship(
        back_populates="created_by"
    )
    notifications: Mapped[list["UserNotification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
