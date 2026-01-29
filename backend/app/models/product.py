from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .inventory_transaction import InventoryTransaction
    from .purchase_request_item import PurchaseRequestItem


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    inventory_transactions: Mapped[list["InventoryTransaction"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    purchase_request_items: Mapped[list["PurchaseRequestItem"]] = relationship(
        back_populates="product"
    )
