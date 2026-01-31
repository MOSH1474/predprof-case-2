"""add meal_type enum"""

from alembic import op
import sqlalchemy as sa


revision = "e025509e2ca1"
down_revision = "fa8d232d0568"
branch_labels = None
depends_on = None


def upgrade() -> None:
    meal_type_enum = sa.Enum("breakfast", "lunch", name="meal_type")
    bind = op.get_bind()
    meal_type_enum.create(bind, checkfirst=True)
    op.execute(
        "UPDATE menus SET meal_type = lower(meal_type) "
        "WHERE meal_type IN ('BREAKFAST', 'LUNCH')"
    )
    op.alter_column(
        "menus",
        "meal_type",
        existing_type=sa.VARCHAR(length=20),
        type_=meal_type_enum,
        existing_nullable=False,
        postgresql_using="meal_type::meal_type",
    )


def downgrade() -> None:
    meal_type_enum = sa.Enum("breakfast", "lunch", name="meal_type")
    op.alter_column(
        "menus",
        "meal_type",
        existing_type=meal_type_enum,
        type_=sa.VARCHAR(length=20),
        existing_nullable=False,
        postgresql_using="meal_type::text",
    )
    bind = op.get_bind()
    meal_type_enum.drop(bind, checkfirst=True)
