# backend/models/requests.py
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, Any


# ─── Requests (заявки) ─────────────────────────────────────────────────────────

class RequestCreate(BaseModel):
    category: str = Field(..., min_length=1)
    unit: Optional[str] = None
    details: Optional[str] = None

    # новое: предпочтительное время (ISO-строка, например "2025-11-19T15:30")
    preferred_time: Optional[str] = None

    # новое: фото/вложения — любая JSON-совместимая структура
    # (список объектов {url|path,name} или массив путей и т.п.)
    photos: Optional[Any] = None


class RequestCancel(BaseModel):
    id: str = Field(..., min_length=1)


class AdminUpdateStatus(BaseModel):
    id: str = Field(..., min_length=1)
    status: str = Field(..., min_length=1)


class RequestItem(BaseModel):
    id: str
    tg_id: int
    category: str
    unit: Optional[str] = None
    details: Optional[str] = None
    status: str
    created_at: str
    updated_at: str

    # чтобы API /requests/my и остальные могли вернуть то,
    # что реально лежит в таблице requests
    preferred_time: Optional[str] = None
    photos: Optional[Any] = None


# ─── Chat / request_messages ───────────────────────────────────────────────────

class RequestMessageCreate(BaseModel):
    """
    Payload для создания сообщения в чате по заявке.
    request_id обычно берём из URL (/requests/{id}/messages),
    поэтому в теле достаточно только body.
    """
    body: str = Field(..., min_length=1)


class RequestMessageItem(BaseModel):
    """
    Сообщение из чата по заявке.

    Должно совпадать с тем, что выбирается из таблицы request_messages
    (id, request_id, author_id, author_role, body, created_at).
    """
    id: str
    request_id: str
    author_id: str
    author_role: Optional[str] = None
    body: str
    created_at: str


# На всякий случай алиасы, если где-то уже используются другие имена
RequestMessageOut = RequestMessageItem
RequestMessage = RequestMessageItem