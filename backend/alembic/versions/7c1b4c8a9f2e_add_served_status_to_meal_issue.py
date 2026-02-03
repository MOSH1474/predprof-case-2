"""add served status to meal_issue_status enum"""

from alembic import op
import sqlalchemy as sa


revision = "7c1b4c8a9f2e"
down_revision = "40132aad1e8a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE meal_issue_status ADD VALUE IF NOT EXISTS 'served'")
        return

    with op.batch_alter_table("meal_issues") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.Enum("issued", "confirmed", name="meal_issue_status"),
            type_=sa.Enum("issued", "served", "confirmed", name="meal_issue_status"),
            existing_nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("UPDATE meal_issues SET status='issued' WHERE status='served'")
        op.execute("ALTER TYPE meal_issue_status RENAME TO meal_issue_status_old")
        op.execute("CREATE TYPE meal_issue_status AS ENUM ('issued', 'confirmed')")
        op.execute(
            "ALTER TABLE meal_issues ALTER COLUMN status TYPE meal_issue_status "
            "USING status::text::meal_issue_status"
        )
        op.execute("DROP TYPE meal_issue_status_old")
        return

    with op.batch_alter_table("meal_issues") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.Enum("issued", "served", "confirmed", name="meal_issue_status"),
            type_=sa.Enum("issued", "confirmed", name="meal_issue_status"),
            existing_nullable=False,
        )
