from sqlalchemy import Column, ForeignKey, Table

from ..db import Base

user_allergies = Table(
    "user_allergies",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("allergy_id", ForeignKey("allergies.id"), primary_key=True),
)

dish_allergies = Table(
    "dish_allergies",
    Base.metadata,
    Column("dish_id", ForeignKey("dishes.id"), primary_key=True),
    Column("allergy_id", ForeignKey("allergies.id"), primary_key=True),
)
