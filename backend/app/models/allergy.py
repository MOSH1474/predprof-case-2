from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .associations import dish_allergies, user_allergies

if TYPE_CHECKING:
    from .dish import Dish
    from .user import User


class Allergy(Base):
    __tablename__ = "allergies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    users: Mapped[list["User"]] = relationship(
        secondary=user_allergies, back_populates="allergies"
    )
    dishes: Mapped[list["Dish"]] = relationship(
        secondary=dish_allergies, back_populates="allergies"
    )
