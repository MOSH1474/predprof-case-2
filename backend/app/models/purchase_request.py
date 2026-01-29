from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .purchase_request_item import PurchaseRequestItem
    from .user import User


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(String(255))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    requested_by: Mapped["User"] = relationship(
        foreign_keys=[requested_by_id], back_populates="purchase_requests"
    )
    approved_by: Mapped["User | None"] = relationship(
        foreign_keys=[approved_by_id], back_populates="approved_purchase_requests"
    )
    items: Mapped[list["PurchaseRequestItem"]] = relationship(
        back_populates="purchase_request", cascade="all, delete-orphan"
    )
