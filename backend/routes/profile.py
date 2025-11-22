# backend/routes/profile.py
from __future__ import annotations

import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from supabase import create_client, Client

# Роутер с локальным префиксом /profile
router = APIRouter(prefix="/profile", tags=["profile"])

# === Настройка подключения к Supabase ===
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# === Модель входных данных профиля ===
class ProfileIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    unit: Optional[str] = None
    username: Optional[str] = None  # если нужно сохранять username

# === Получение профиля пользователя ===
def fetch_profile(tg_id: int) -> Optional[Dict[str, Any]]:
    res = (
        sb.table("users")
        .select("*")               # берём все поля (tg_id, email, phone, username, name, language, unit, created_at, updated_at)
        .eq("tg_id", tg_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None

# === Обновление или вставка профиля ===
def upsert_profile(tg_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    clean = {k: v for k, v in payload.items() if v is not None}
    clean["tg_id"] = tg_id
    # on_conflict по tg_id, чтобы обновляло существующую запись
    sb.table("users").upsert(clean, on_conflict="tg_id", ignore_duplicates=False).execute()
    row = fetch_profile(tg_id)
    return row or {"tg_id": tg_id, **clean}

# === GET: получить профиль ===
@router.get("", summary="Получить профиль")      # → /api/profile
@router.get("/", include_in_schema=False)         # → /api/profile/
def get_profile(request: Request):
    tg_id = getattr(request.state, "tg_id", None)
    if not tg_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no telegram id")

    row = fetch_profile(int(tg_id))
    if not row:
        # Возвращаем пустую «болванку» профиля, если записи ещё нет
        row = {
            "tg_id": int(tg_id),
            "name": None,
            "email": None,
            "phone": None,
            "language": None,
            "unit": None,
            "username": None,
        }
    return {"user": row}

# === POST: сохранить или обновить профиль ===
@router.post("", summary="Сохранить/обновить профиль")   # → /api/profile
def save_profile(p: ProfileIn, request: Request):
    tg_id = getattr(request.state, "tg_id", None)
    if not tg_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no telegram id")

    # нормализуем язык
    lang = (p.language or "").upper().strip()
    allowed = {"EN", "RU", "KM", "ZH"}

    # формируем payload
    payload = p.dict()
    if lang:
        payload["language"] = lang if lang in allowed else "EN"

    # обновляем или создаем профиль
    row = upsert_profile(int(tg_id), payload)
    return {"ok": True, "user": row}
