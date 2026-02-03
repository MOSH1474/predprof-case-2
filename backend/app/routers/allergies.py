from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import UserRole
from ..schemas.allergy import AllergyCreate, AllergyListResponse, AllergyPublic, AllergyUpdate
from ..services.allergy_service import (
    create_allergy,
    delete_allergy,
    get_allergy,
    list_allergies,
    update_allergy,
)
from ..services.authorization import require_roles

router = APIRouter(
    prefix="/allergies",
    tags=["allergies"],
    dependencies=[Depends(require_roles(UserRole.STUDENT, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=AllergyListResponse,
    **roles_docs("student", "admin", notes="Справочник аллергенов."),
    summary="Список аллергенов",
)
async def list_allergies_endpoint(db: AsyncSession = Depends(get_db)) -> AllergyListResponse:
    allergies = await list_allergies(db)
    return AllergyListResponse(
        items=[AllergyPublic.model_validate(item) for item in allergies]
    )


@router.get(
    "/{allergy_id}",
    response_model=AllergyPublic,
    **roles_docs(
        "student",
        "admin",
        notes="Возвращает аллерген по идентификатору.",
        extra_responses={
            404: error_response("Allergy not found", "Not found"),
        },
    ),
    summary="Аллерген по id",
)
async def get_allergy_endpoint(
    allergy_id: int, db: AsyncSession = Depends(get_db)
) -> AllergyPublic:
    allergy = await get_allergy(allergy_id, db)
    return AllergyPublic.model_validate(allergy)


@router.post(
    "/",
    response_model=AllergyPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "admin",
        notes="Создает новый аллерген в справочнике.",
        extra_responses={
            400: error_response("Allergy already exists", "Bad request"),
        },
    ),
    summary="Создать аллерген",
)
async def create_allergy_endpoint(
    payload: AllergyCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.ADMIN)),
) -> AllergyPublic:
    allergy = await create_allergy(payload, db)
    return AllergyPublic.model_validate(allergy)


@router.put(
    "/{allergy_id}",
    response_model=AllergyPublic,
    **roles_docs(
        "admin",
        notes="Обновляет аллерген по идентификатору.",
        extra_responses={
            400: error_response("Allergy already exists", "Bad request"),
            404: error_response("Allergy not found", "Not found"),
        },
    ),
    summary="Обновить аллерген",
)
async def update_allergy_endpoint(
    allergy_id: int,
    payload: AllergyUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.ADMIN)),
) -> AllergyPublic:
    allergy = await get_allergy(allergy_id, db)
    allergy = await update_allergy(allergy, payload, db)
    return AllergyPublic.model_validate(allergy)


@router.delete(
    "/{allergy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    **roles_docs(
        "admin",
        notes="Удаляет аллерген по идентификатору.",
        extra_responses={
            404: error_response("Allergy not found", "Not found"),
        },
    ),
    summary="Удалить аллерген",
)
async def delete_allergy_endpoint(
    allergy_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    allergy = await get_allergy(allergy_id, db)
    await delete_allergy(allergy, db)
