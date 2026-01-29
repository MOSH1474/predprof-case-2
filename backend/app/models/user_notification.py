from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .notification import Notification
    from .user import User


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    notification_id: Mapped[int] = mapped_column(
        ForeignKey("notifications.id"), nullable=False, index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="notifications")
    notification: Mapped["Notification"] = relationship(back_populates="recipients")
