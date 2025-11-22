# backend/api/requests_api.py
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple

from datetime import datetime
import json

from fastapi import APIRouter, Body, Header, HTTPException, Request
from models.requests import (
    RequestCreate,
    RequestCancel,
    AdminUpdateStatus,
    RequestItem,
    RequestMessageCreate,
    RequestMessageItem,
)
from utils.telegram import extract_user_from_request
from db import db_cursor

router = APIRouter(prefix="/requests", tags=["requests"])

# ────────────────────────────────────────────────────────────────────
# Статусы и переходы
# ────────────────────────────────────────────────────────────────────
ALLOWED = ("pending", "confirmed", "done", "cancelled", "cancelled_by_user")
TRANSITIONS = {
    "pending": {"confirmed", "cancelled", "cancelled_by_user"},
    "confirmed": {"done", "cancelled"},
    "done": set(),
    "cancelled": set(),
    "cancelled_by_user": set(),
}


def _ts(v: Any) -> Any:
    """Преобразовать datetime → iso, None оставить None."""
    if v is None:
        return None
    return v.isoformat() if hasattr(v, "isoformat") else v


def _row_to_dict(row: Tuple[Any, ...]) -> Dict[str, Any]:
    # ожидаем порядок колонок:
    # 0: id
    # 1: tg_id
    # 2: category
    # 3: unit
    # 4: details
    # 5: status
    # 6: created_at
    # 7: updated_at
    # 8: preferred_time
    # 9: photos
    return {
        "id": str(row[0]),
        "tg_id": int(row[1]),
        "category": row[2],
        "unit": row[3],
        "details": row[4],
        "status": row[5],
        "created_at": _ts(row[6]),
        "updated_at": _ts(row[7]),
        "preferred_time": _ts(row[8]),
        "photos": row[9],
    }


def _normalize_status(s: Optional[str]) -> str:
    return (s or "").strip().lower()


# helper: получить UUID пользователя по tg_id
def _get_user_uuid_by_tg(cur, tg_id: int) -> str:
    cur.execute("select id from users where tg_id = %s limit 1", (tg_id,))
    r = cur.fetchone()
    if not r:
        raise HTTPException(404, "user not found for tg_id")
    return str(r[0])


def _ensure_request_owner(cur, req_id: str, tg_id: int) -> Tuple[str, str]:
    """
    Проверяем, что заявка принадлежит пользователю с данным tg_id.
    Возвращаем (request_uuid, user_uuid), иначе 404/403.
    """
    cur.execute(
        """
        select r.id, r.user_id, u.tg_id
        from requests r
        join users u on u.id = r.user_id
        where r.id = %s
        """,
        (req_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "request not found")
    req_uuid, user_uuid, owner_tg = str(row[0]), str(row[1]), int(row[2])
    if owner_tg != tg_id:
        raise HTTPException(403, "not your request")
    return req_uuid, user_uuid


# ────────────────────────────────────────────────────────────────────
# Endpoints: заявки
# ────────────────────────────────────────────────────────────────────
@router.get("/my", response_model=List[RequestItem])
async def my_requests(
    request: Request,
    x_telegram_init_data: Optional[str] = Header(
        default=None, alias="X-Telegram-Init-Data"
    ),
):
    tg = await extract_user_from_request(request, x_telegram_init_data)
    tg_id = int(tg["id"])
    with db_cursor() as cur:
        cur.execute(
            """
            select
                r.id,
                u.tg_id,
                r.category,
                r.unit,
                r.details,
                r.status,
                r.created_at,
                r.updated_at,
                r.preferred_time,
                r.photos
            from requests r
            join users u on u.id = r.user_id
            where u.tg_id = %s
            order by r.created_at desc
            """,
            (tg_id,),
        )
        rows = cur.fetchall()
    return [_row_to_dict(r) for r in rows]


@router.get("/{request_id}", response_model=RequestItem)
async def get_request(
    request_id: str,
    request: Request,
    x_telegram_init_data: Optional[str] = Header(
        default=None, alias="X-Telegram-Init-Data"
    ),
):
    """
    Одна заявка для резидента.
    Возвращает тот же shape, что и /requests/my:
    id, tg_id, category, unit, details, status, created_at, updated_at,
    preferred_time, photos.

    Плюс проверка, что заявка принадлежит текущему пользователю.
    """
    tg = await extract_user_from_request(request, x_telegram_init_data)
    tg_id = int(tg["id"])

    req_id = (request_id or "").strip()
    if not req_id:
        raise HTTPException(400, "request_id required")

    with db_cursor() as cur:
        req_uuid, user_uuid = _ensure_request_owner(cur, req_id, tg_id)

        cur.execute(
            """
            select
                r.id,
                u.tg_id,
                r.category,
                r.unit,
                r.details,
                r.status,
                r.created_at,
                r.updated_at,
                r.preferred_time,
                r.photos
            from requests r
            join users u on u.id = r.user_id
            where r.id = %s
            """,
            (req_uuid,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "request not found")

    return _row_to_dict(row)


@router.post("/create", response_model=RequestItem)
async def create_request(
    request: Request,
    payload: RequestCreate = Body(...),
    x_telegram_init_data: Optional[str] = Header(
        default=None, alias="X-Telegram-Init-Data"
    ),
):
    tg = await extract_user_from_request(request, x_telegram_init_data)
    tg_id = int(tg["id"])

    category = (payload.category or "").strip()
    unit = (payload.unit or "").strip() or None
    details = (payload.details or "").strip() or None
    if not category:
        raise HTTPException(400, "category required")

    # preferred_time: ISO-строка → datetime (для timestamptz)
    preferred_dt = None
    if getattr(payload, "preferred_time", None):
        try:
            preferred_dt = datetime.fromisoformat(
                payload.preferred_time.replace("Z", "+00:00")
            )
        except Exception:
            preferred_dt = None

    # photos: json-совместимая структура → jsonb
    photos_json = None
    if getattr(payload, "photos", None) is not None:
        try:
            photos_json = json.dumps(payload.photos)
        except Exception:
            photos_json = json.dumps([])

    with db_cursor() as cur:
        user_uuid = _get_user_uuid_by_tg(cur, tg_id)
        cur.execute(
            """
            insert into requests (
                id,
                user_id,
                category,
                unit,
                details,
                status,
                created_at,
                updated_at,
                preferred_time,
                photos
            )
            values (
                gen_random_uuid(),
                %s,
                %s,
                %s,
                %s,
                %s,
                now(),
                now(),
                %s,
                %s
            )
            returning id
            """,
            (user_uuid, category, unit, details, "pending", preferred_dt, photos_json),
        )
        new_id = cur.fetchone()[0]

        cur.execute(
            """
            select
                r.id,
                u.tg_id,
                r.category,
                r.unit,
                r.details,
                r.status,
                r.created_at,
                r.updated_at,
                r.preferred_time,
                r.photos
            from requests r
            join users u on u.id = r.user_id
            where r.id = %s
            """,
            (new_id,),
        )
        row = cur.fetchone()
    return _row_to_dict(row)


@router.post("/cancel", response_model=RequestItem)
async def cancel_request_by_user(
    request: Request,
    payload: RequestCancel = Body(...),
    x_telegram_init_data: Optional[str] = Header(
        default=None, alias="X-Telegram-Init-Data"
    ),
):
    tg = await extract_user_from_request(request, x_telegram_init_data)
    tg_id = int(tg["id"])
    req_id = (payload.id or "").strip()
    if not req_id:
        raise HTTPException(400, "id required")

    with db_cursor() as cur:
        # здесь оставляем старый селект, потому что нужен r.user_id (индексы важны)
        cur.execute(
            """
            select
                r.id,
                u.tg_id,
                r.category,
                r.unit,
                r.details,
                r.status,
                r.created_at,
                r.updated_at,
                r.user_id
            from requests r
            join users u on u.id = r.user_id
            where r.id = %s
            """,
            (req_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "request not found")

        owner_tg = int(row[1])
        old_status = _normalize_status(row[5])
        owner_uuid = str(row[8])

        if owner_tg != tg_id:
            raise HTTPException(403, "not your request")
        if old_status != "pending":
            raise HTTPException(400, f"cannot cancel from '{old_status}'")

        new_status = "cancelled_by_user"
        cur.execute(
            """
            update requests
               set status = %s, updated_at = now()
             where id = %s and user_id = %s
         returning id
            """,
            (new_status, req_id, owner_uuid),
        )

        # а вот тут уже возвращаем расширенный набор полей
        cur.execute(
            """
            select
                r.id,
                u.tg_id,
                r.category,
                r.unit,
                r.details,
                r.status,
                r.created_at,
                r.updated_at,
                r.preferred_time,
                r.photos
            from requests r
            join users u on u.id = r.user_id
            where r.id = %s
            """,
            (req_id,),
        )
        row2 = cur.fetchone()
    return _row_to_dict(row2)


@router.post("/update_status", response_model=RequestItem)
async def admin_update_status(
    request: Request,
    payload: AdminUpdateStatus = Body(...),
    x_api_key: Optional[str] = Header(default=None),
):
    from config import settings

    if not x_api_key or x_api_key.strip() != settings()["API_SECRET"]:
        raise HTTPException(401, "invalid api key")

    req_id = (payload.id or "").strip()
    new_status = _normalize_status(payload.status)
    if new_status not in ALLOWED:
        raise HTTPException(422, f"invalid status '{new_status}'")

    with db_cursor() as cur:
        cur.execute("select status from requests where id = %s", (req_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "request not found")

        old_status = _normalize_status(row[0])
        if old_status == new_status:
            # сразу возвращаем заявку с расширенными полями
            cur.execute(
                """
                select
                    r.id,
                    u.tg_id,
                    r.category,
                    r.unit,
                    r.details,
                    r.status,
                    r.created_at,
                    r.updated_at,
                    r.preferred_time,
                    r.photos
                from requests r
                join users u on u.id = r.user_id
                where r.id = %s
                """,
                (req_id,),
            )
            return _row_to_dict(cur.fetchone())

        if new_status not in TRANSITIONS.get(old_status, set()):
            raise HTTPException(409, f"transition {old_status} -> {new_status} not allowed")

        cur.execute(
            "update requests set status = %s, updated_at = now() where id = %s",
            (new_status, req_id),
        )
        cur.execute(
            """
            select
                r.id,
                u.tg_id,
                r.category,
                r.unit,
                r.details,
                r.status,
                r.created_at,
                r.updated_at,
                r.preferred_time,
                r.photos
            from requests r
            join users u on u.id = r.user_id
            where r.id = %s
            """,
            (req_id,),
        )
        return _row_to_dict(cur.fetchone())


# ────────────────────────────────────────────────────────────────────
# Endpoints: чат по заявке (резидент)
# ────────────────────────────────────────────────────────────────────
@router.get("/{request_id}/messages", response_model=List[RequestMessageItem])
async def list_request_messages(
    request_id: str,
    request: Request,
    x_telegram_init_data: Optional[str] = Header(
        default=None, alias="X-Telegram-Init-Data"
    ),
):
    """Список сообщений по заявке для резидента (только владелец заявки)."""
    tg = await extract_user_from_request(request, x_telegram_init_data)
    tg_id = int(tg["id"])
    req_id = (request_id or "").strip()
    if not req_id:
        raise HTTPException(400, "request_id required")

    with db_cursor() as cur:
        _ensure_request_owner(cur, req_id, tg_id)
        cur.execute(
            """
            select id, request_id, author_id, author_role, body, created_at
            from request_messages
            where request_id = %s
            order by created_at asc
            """,
            (req_id,),
        )
        rows = cur.fetchall()

    items: List[RequestMessageItem] = []
    for r in rows:
        items.append(
            RequestMessageItem(
                id=str(r[0]),
                request_id=str(r[1]),
                author_id=str(r[2]),
                author_role=str(r[3]),
                body=r[4],
                created_at=_ts(r[5]),  # iso-строка
            )
        )
    return items


@router.post("/{request_id}/messages", response_model=RequestMessageItem)
async def create_request_message(
    request_id: str,
    request: Request,
    payload: RequestMessageCreate = Body(...),
    x_telegram_init_data: Optional[str] = Header(
        default=None, alias="X-Telegram-Init-Data"
    ),
):
    """Отправка сообщения в чат по заявке от резидента (владельца заявки)."""
    tg = await extract_user_from_request(request, x_telegram_init_data)
    tg_id = int(tg["id"])
    req_id = (request_id or "").strip()
    if not req_id:
        raise HTTPException(400, "request_id required")

    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(400, "body required")

    with db_cursor() as cur:
        req_uuid, user_uuid = _ensure_request_owner(cur, req_id, tg_id)
        cur.execute(
            """
            insert into request_messages (id, request_id, author_id, author_role, body, created_at)
            values (gen_random_uuid(), %s, %s, %s, %s, now())
            returning id, request_id, author_id, author_role, body, created_at
            """,
            (req_uuid, user_uuid, "resident", body),
        )
        r = cur.fetchone()

    return RequestMessageItem(
        id=str(r[0]),
        request_id=str(r[1]),
        author_id=str(r[2]),
        author_role=str(r[3]),
        body=r[4],
        created_at=_ts(r[5]),  # iso-строка
    )