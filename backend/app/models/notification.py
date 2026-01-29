from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .user import User
    from .user_notification import UserNotification


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    created_by: Mapped["User | None"] = relationship(back_populates="created_notifications")
    recipients: Mapped[list["UserNotification"]] = relationship(
        back_populates="notification", cascade="all, delete-orphan"
    )
