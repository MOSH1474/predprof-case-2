from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .utils import utcnow

if TYPE_CHECKING:
    from .menu import Menu
    from .user import User


class MealIssueStatus(str, Enum):
    ISSUED = "issued"
    CONFIRMED = "confirmed"


class MealIssue(Base):
    __tablename__ = "meal_issues"
    __table_args__ = (UniqueConstraint("user_id", "menu_id", name="uq_meal_issue_user_menu"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id"), nullable=False, index=True)
    served_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[MealIssueStatus] = mapped_column(
        SAEnum(
            MealIssueStatus,
            name="meal_issue_status",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
        default=MealIssueStatus.ISSUED,
    )
    served_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(
        back_populates="meal_issues", foreign_keys=[user_id]
    )
    served_by: Mapped["User | None"] = relationship(
        back_populates="served_meal_issues", foreign_keys=[served_by_id]
    )
    menu: Mapped["Menu"] = relationship(back_populates="meal_issues")
