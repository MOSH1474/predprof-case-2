from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum as SAEnum, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .meal_issue import MealIssue
    from .menu_item import MenuItem
    from .payment import Payment
    from .review import Review


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"


class Menu(Base):
    __tablename__ = "menus"
    __table_args__ = (UniqueConstraint("menu_date", "meal_type", name="uq_menu_date_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    menu_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal_type: Mapped[MealType] = mapped_column(
        SAEnum(
            MealType,
            name="meal_type",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255))
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    menu_items: Mapped[list["MenuItem"]] = relationship(
        back_populates="menu", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="menu", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="menu")
    meal_issues: Mapped[list["MealIssue"]] = relationship(
        back_populates="menu", cascade="all, delete-orphan"
    )
