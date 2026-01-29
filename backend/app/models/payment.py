from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .menu import Menu
    from .user import User


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    menu_id: Mapped[int | None] = mapped_column(ForeignKey("menus.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB")
    payment_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="paid")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="payments")
    menu: Mapped["Menu | None"] = relationship(back_populates="payments")
