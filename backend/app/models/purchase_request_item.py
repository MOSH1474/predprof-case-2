from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class PurchaseRequestItem(Base):
    __tablename__ = "purchase_request_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_request_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_requests.id"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    purchase_request: Mapped["PurchaseRequest"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="purchase_request_items")
