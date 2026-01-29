from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .dish import Dish
    from .menu import Menu


class MenuItem(Base):
    __tablename__ = "menu_items"
    __table_args__ = (UniqueConstraint("menu_id", "dish_id", name="uq_menu_item_menu_dish"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id"), nullable=False, index=True)
    dish_id: Mapped[int] = mapped_column(ForeignKey("dishes.id"), nullable=False, index=True)
    portion_size: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    planned_qty: Mapped[int | None] = mapped_column(Integer)
    remaining_qty: Mapped[int | None] = mapped_column(Integer)

    menu: Mapped["Menu"] = relationship(back_populates="menu_items")
    dish: Mapped["Dish"] = relationship(back_populates="menu_items")
