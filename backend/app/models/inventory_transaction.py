from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .product import Product
    from .user import User


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product: Mapped["Product"] = relationship(back_populates="inventory_transactions")
    created_by: Mapped["User | None"] = relationship(back_populates="inventory_transactions")
