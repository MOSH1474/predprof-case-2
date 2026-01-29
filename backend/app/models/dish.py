from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .associations import dish_allergies

if TYPE_CHECKING:
    from .allergy import Allergy
    from .menu_item import MenuItem
    from .review import Review


class Dish(Base):
    __tablename__ = "dishes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    allergies: Mapped[list["Allergy"]] = relationship(
        secondary=dish_allergies, back_populates="dishes"
    )
    menu_items: Mapped[list["MenuItem"]] = relationship(back_populates="dish")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="dish", cascade="all, delete-orphan"
    )
