from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow


class Menu(Base):
    __tablename__ = "menus"
    __table_args__ = (UniqueConstraint("menu_date", "meal_type", name="uq_menu_date_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    menu_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    items: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    reviews: Mapped[list["Review"]] = relationship(
        back_populates="menu", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="menu")
