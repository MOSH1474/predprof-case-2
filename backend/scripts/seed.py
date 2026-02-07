from __future__ import annotations

import asyncio
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models import (
    Allergy,
    Dish,
    InventoryDirection,
    InventoryTransaction,
    MealIssue,
    MealIssueStatus,
    MealType,
    Menu,
    MenuItem,
    Notification,
    Payment,
    PaymentStatus,
    PaymentType,
    Product,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseRequestStatus,
    Review,
    User,
    UserNotification,
    UserRole,
)
from app.models.associations import user_allergies
from app.models.utils import utcnow
from app.services.meal_issue_service import confirm_meal, serve_meal
from app.services.payment_service import create_one_time_payment, create_subscription_payment
from app.services.security import hash_password


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    role: UserRole,
    full_name: str,
    password: str = "Password123!",
    dietary_preferences: str | None = None,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password(password),
        role=role,
        dietary_preferences=dietary_preferences,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_or_create_allergy(
    db: AsyncSession, name: str, description: str | None = None
) -> Allergy:
    result = await db.execute(select(Allergy).where(Allergy.name == name))
    allergy = result.scalar_one_or_none()
    if allergy:
        return allergy
    allergy = Allergy(name=name, description=description)
    db.add(allergy)
    await db.commit()
    await db.refresh(allergy)
    return allergy


async def get_or_create_dish(
    db: AsyncSession,
    name: str,
    description: str | None = None,
    is_active: bool = True,
    allergies: list[Allergy] | None = None,
) -> Dish:
    result = await db.execute(select(Dish).where(Dish.name == name))
    dish = result.scalar_one_or_none()
    if dish:
        return dish
    dish = Dish(name=name, description=description, is_active=is_active)
    if allergies:
        dish.allergies = allergies
    db.add(dish)
    await db.commit()
    await db.refresh(dish)
    return dish


async def get_or_create_product(
    db: AsyncSession, name: str, unit: str, category: str | None = None
) -> Product:
    result = await db.execute(select(Product).where(Product.name == name))
    product = result.scalar_one_or_none()
    if product:
        return product
    product = Product(name=name, unit=unit, category=category, is_active=True)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def get_or_create_menu(
    db: AsyncSession,
    menu_date: date,
    meal_type: MealType,
    title: str,
    price: Decimal,
    dish: Dish,
    remaining_qty: int = 30,
) -> Menu:
    result = await db.execute(
        select(Menu).where(Menu.menu_date == menu_date, Menu.meal_type == meal_type)
    )
    menu = result.scalar_one_or_none()
    if menu:
        return menu
    menu = Menu(menu_date=menu_date, meal_type=meal_type, title=title, price=price)
    menu.menu_items = [
        MenuItem(
            dish_id=dish.id,
            portion_size=Decimal("250.00"),
            planned_qty=remaining_qty,
            remaining_qty=remaining_qty,
        )
    ]
    db.add(menu)
    await db.commit()
    await db.refresh(menu)
    return menu


async def ensure_inventory_stock(
    db: AsyncSession, product: Product, quantity: Decimal, created_by_id: int | None
) -> None:
    result = await db.execute(
        select(InventoryTransaction).where(InventoryTransaction.product_id == product.id)
    )
    if result.scalar_one_or_none():
        return
    tx = InventoryTransaction(
        product_id=product.id,
        quantity=quantity,
        direction=InventoryDirection.IN,
        reason="Initial stock",
        created_by_id=created_by_id,
    )
    db.add(tx)
    await db.commit()


async def ensure_purchase_requests(
    db: AsyncSession, cook: User, admin: User, product: Product
) -> None:
    result = await db.execute(
        select(PurchaseRequest).where(
            PurchaseRequest.requested_by_id == cook.id,
            PurchaseRequest.note == "Seed request",
        )
    )
    if result.scalar_one_or_none():
        return

    pending = PurchaseRequest(
        requested_by_id=cook.id,
        status=PurchaseRequestStatus.PENDING,
        note="Seed request",
        items=[
            PurchaseRequestItem(
                product_id=product.id,
                quantity=Decimal("5.000"),
                unit_price=Decimal("42.50"),
            )
        ],
    )
    approved = PurchaseRequest(
        requested_by_id=cook.id,
        status=PurchaseRequestStatus.APPROVED,
        note="Seed approved",
        approved_by_id=admin.id,
        decided_at=utcnow(),
        items=[
            PurchaseRequestItem(
                product_id=product.id,
                quantity=Decimal("10.000"),
                unit_price=Decimal("40.00"),
            )
        ],
    )
    db.add_all([pending, approved])
    await db.commit()


async def ensure_review(
    db: AsyncSession, student: User, dish: Dish, menu: Menu
) -> None:
    result = await db.execute(
        select(Review).where(
            Review.user_id == student.id,
            Review.dish_id == dish.id,
            Review.menu_id == menu.id,
        )
    )
    if result.scalar_one_or_none():
        return
    review = Review(
        user_id=student.id,
        dish_id=dish.id,
        menu_id=menu.id,
        rating=5,
        comment="Отличное блюдо!",
    )
    db.add(review)
    await db.commit()


async def ensure_notification(
    db: AsyncSession, admin: User, student: User
) -> None:
    result = await db.execute(
        select(Notification).where(
            Notification.title == "Добро пожаловать",
            Notification.created_by_id == admin.id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        notification = Notification(
            title="Добро пожаловать",
            body="Спасибо за регистрацию в системе школьной столовой.",
            created_by_id=admin.id,
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)

    link_result = await db.execute(
        select(UserNotification).where(
            UserNotification.user_id == student.id,
            UserNotification.notification_id == notification.id,
        )
    )
    if link_result.scalar_one_or_none() is None:
        db.add(UserNotification(user_id=student.id, notification_id=notification.id))
        await db.commit()


async def ensure_user_allergy(db: AsyncSession, user_id: int, allergy_id: int) -> None:
    result = await db.execute(
        select(user_allergies.c.user_id).where(
            user_allergies.c.user_id == user_id,
            user_allergies.c.allergy_id == allergy_id,
        )
    )
    if result.scalar_one_or_none() is not None:
        return
    await db.execute(
        insert(user_allergies).values(user_id=user_id, allergy_id=allergy_id)
    )
    await db.commit()


async def ensure_payments_and_issues(
    db: AsyncSession, student: User, cook: User, one_time_menu: Menu, sub_start: date
) -> None:
    result = await db.execute(
        select(Payment).where(
            Payment.user_id == student.id,
            Payment.payment_type == PaymentType.ONE_TIME,
            Payment.menu_id == one_time_menu.id,
            Payment.status == PaymentStatus.PAID,
        )
    )
    if result.scalar_one_or_none() is None:
        await create_one_time_payment(student.id, one_time_menu.id, db)

    period_end = sub_start + timedelta(days=2)
    result = await db.execute(
        select(Payment).where(
            Payment.user_id == student.id,
            Payment.payment_type == PaymentType.SUBSCRIPTION,
            Payment.period_start == sub_start,
            Payment.period_end == period_end,
            Payment.status == PaymentStatus.PAID,
        )
    )
    if result.scalar_one_or_none() is None:
        await create_subscription_payment(student.id, sub_start, period_end, db)

    issue_result = await db.execute(
        select(MealIssue).where(
            MealIssue.user_id == student.id,
            MealIssue.menu_id == one_time_menu.id,
        )
    )
    issue = issue_result.scalar_one_or_none()
    if issue is not None:
        if issue.status == MealIssueStatus.CONFIRMED:
            return
        if issue.status == MealIssueStatus.SERVED:
            await confirm_meal(student.id, one_time_menu.id, db)
            return

    await serve_meal(student.id, one_time_menu.id, cook.id, db)
    await confirm_meal(student.id, one_time_menu.id, db)


async def main() -> None:
    async with SessionLocal() as db:
        admin = await get_or_create_user(
            db, "admin@example.com", UserRole.ADMIN, "Администратор"
        )
        cook = await get_or_create_user(
            db, "cook@example.com", UserRole.COOK, "Повар столовой"
        )
        student = await get_or_create_user(
            db,
            "student@example.com",
            UserRole.STUDENT,
            "Ученик Иванов",
            dietary_preferences="Без сахара",
        )

        allergy_milk = await get_or_create_allergy(db, "Молоко", "Лактоза")
        allergy_gluten = await get_or_create_allergy(db, "Глютен", "Пшеница и злаки")

        dish_oat = await get_or_create_dish(
            db, "Овсяная каша", "С ягодами", allergies=[allergy_milk, allergy_gluten]
        )
        dish_soup = await get_or_create_dish(
            db, "Куриный суп", "Домашний бульон"
        )
        dish_salad = await get_or_create_dish(
            db, "Овощной салат", "Свежие овощи"
        )

        await ensure_user_allergy(db, student.id, allergy_milk.id)

        today = date.today()
        if today.day <= 12:
            sub_start = date(today.year, today.month, 12)
        else:
            next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
            sub_start = date(next_month.year, next_month.month, 12)
        breakfast = await get_or_create_menu(
            db,
            today,
            MealType.BREAKFAST,
            "Завтрак",
            Decimal("120.00"),
            dish_oat,
        )
        await get_or_create_menu(
            db,
            today,
            MealType.LUNCH,
            "Обед",
            Decimal("150.00"),
            dish_soup,
        )
        await get_or_create_menu(
            db,
            today + timedelta(days=1),
            MealType.LUNCH,
            "Обед завтра",
            Decimal("155.00"),
            dish_salad,
        )
        await get_or_create_menu(
            db,
            today + timedelta(days=2),
            MealType.LUNCH,
            "Обед послезавтра",
            Decimal("160.00"),
            dish_soup,
        )

        product_rice = await get_or_create_product(db, "Рис", "кг", "крупы")
        product_milk = await get_or_create_product(db, "Молоко", "л", "молочные")
        product_chicken = await get_or_create_product(db, "Курица", "кг", "мясо")

        await ensure_inventory_stock(db, product_rice, Decimal("25.000"), cook.id)
        await ensure_inventory_stock(db, product_milk, Decimal("15.000"), cook.id)
        await ensure_inventory_stock(db, product_chicken, Decimal("12.000"), cook.id)

        await ensure_purchase_requests(db, cook, admin, product_rice)
        await ensure_review(db, student, dish_oat, breakfast)
        await ensure_notification(db, admin, student)
        await ensure_payments_and_issues(db, student, cook, breakfast, sub_start)

        print("Seed completed.")
        print("Users: admin@example.com / cook@example.com / student@example.com")
        print("Password: Password123!")


if __name__ == "__main__":
    asyncio.run(main())
