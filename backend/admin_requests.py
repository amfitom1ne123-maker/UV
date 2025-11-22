# backend/admin_requests.py
from __future__ import annotations

import os
from typing import Optional, List, Literal, Any, Tuple
from datetime import datetime
import logging
import json
import httpx

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field, validator
from supabase import create_client, Client

# главная защита админки
from admin_auth import require_admin

log = logging.getLogger("admin_requests")

# ─── env / supabase ─────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Supabase env is missing")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Telegram notifications (optional)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

# ───────────────────────────────────────────────────────────────────────────────
# ✔ ГЛАВНОЕ: глобальная защита ВСЕЙ админки
# Все роуты теперь всегда авторизованы (dev-mode уже работает в require_admin)
# ───────────────────────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/admin/requests",
    tags=["admin-requests"],
    dependencies=[Depends(require_admin)]
)


# ─── utils ──────────────────────────────────────────────────────────────────────
def _resp_data(resp):
    if resp is None:
        return None, "empty response"
    if hasattr(resp, "data") or hasattr(resp, "error"):
        return getattr(resp, "data", None), getattr(resp, "error", None)
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return None, f"unexpected response type: {type(resp)}"


def _row_or_none(data):
    if data is None:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


def _to_jsonb(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(str(value))
    except Exception:
        return value


def _parse_iso(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.isoformat()
    except Exception:
        return None


StatusDB = Literal["pending", "confirmed", "done", "cancelled", "cancelled_by_user", "in_progress"]
StatusWritable = Literal["pending", "confirmed", "done", "cancelled", "cancelled_by_user", "in_progress"]
StatusView = Literal["pending", "confirmed", "in_progress", "done", "cancelled", "cancelled_by_user"]


_STATUS_WRITE_MAP = {
    "confirmed": "in_progress",
    "in_progress": "in_progress",
}


def _to_db_status(status: str) -> str:
    key = (status or "").strip().lower()
    return _STATUS_WRITE_MAP.get(key, key)


async def _send_tg(chat_id: int, text: str):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
        )


def _parse_tg_id(resident: Optional[str]) -> Optional[int]:
    if not resident:
        return None
    r = str(resident)
    if r.startswith("tg_"):
        num = r[3:]
        if num.isdigit():
            return int(num)
    return None


def _human_status(s: str) -> str:
    s = (s or "").lower()
    mapping = {
        "pending": "New",
        "confirmed": "Confirmed",
        "in_progress": "Confirmed",
        "done": "Done",
        "cancelled": "Canceled",
        "cancelled_by_user": "Canceled by user",
    }
    return mapping.get(s, s)


# ─── models ─────────────────────────────────────────────────────────────────────
class AdminRequestMessageIn(BaseModel):
    body: str = Field(..., min_length=1)


class AdminRequestMessageOut(BaseModel):
    id: str
    request_id: str
    author_id: str
    author_role: str
    body: str
    created_at: datetime


# ─── list requests ───────────────────────────────────────────────────────────────
@router.get("", response_model=List[Any])
def list_requests(
    status: Optional[StatusView | Literal["all"]] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    try:
        qr = sb.table("admin_requests_v").select("*").order("created_at", desc=True)

        if status and status != "all":
            qr = qr.eq("status", status)

        if q:
            like = f"%{q}%"
            qr = qr.or_(
                "name.ilike.{0},address.ilike.{0},resident.ilike.{0},category.ilike.{0}".format(
                    like
                )
            )

        qr = qr.range(offset, offset + limit - 1)
        data, err = _resp_data(qr.execute())
        if err:
            raise HTTPException(status_code=500, detail=str(err))
        return data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


# ─── get one ────────────────────────────────────────────────────────────────────
@router.get("/{id}")
def get_request(id: str):
    data, err = _resp_data(
        sb.table("admin_requests_v").select("*").eq("id", id).maybe_single().execute()
    )
    row = _row_or_none(data)
    if err:
        raise HTTPException(status_code=500, detail=str(err))
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


# ─── update status ───────────────────────────────────────────────────────────────
@router.post("/{id}/status")
def update_status(id: str, body: dict):
    target_status = _to_db_status(body.get("status"))
    data, err = _resp_data(
        sb.table("requests")
        .update({"status": target_status, "updated_at": datetime.utcnow().isoformat()})
        .eq("id", id).execute()
    )
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")
    if not _row_or_none(data):
        raise HTTPException(status_code=404, detail="Not found")

    data2, err2 = _resp_data(
        sb.table("admin_requests_v").select("*").eq("id", id).maybe_single().execute()
    )
    row2 = _row_or_none(data2)
    if err2:
        raise HTTPException(status_code=500, detail=str(err2))
    if not row2:
        raise HTTPException(status_code=404, detail="Not found (view)")
    return row2


# ─── assign ─────────────────────────────────────────────────────────────────────
@router.post("/{id}/assign")
def assign_request(id: str, body: dict):
    payload = {"assignee": body.get("assignee"), "updated_at": datetime.utcnow().isoformat()}
    data, err = _resp_data(sb.table("requests").update(payload).eq("id", id).execute())
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")
    data2, err2 = _resp_data(
        sb.table("admin_requests_v").select("*").eq("id", id).maybe_single().execute()
    )
    row2 = _row_or_none(data2)
    if err2:
        raise HTTPException(status_code=500, detail=str(err2))
    return row2


# ─── chat: list messages ────────────────────────────────────────────────────────
@router.get("/{id}/messages", response_model=List[AdminRequestMessageOut])
def list_request_messages_admin(id: str):
    data, err = _resp_data(
        sb.table("request_messages")
        .select("*")
        .eq("request_id", id)
        .order("created_at", desc=False)
        .execute()
    )
    if err:
        raise HTTPException(status_code=500, detail=str(err))
    return data or []


# ─── chat: create message ───────────────────────────────────────────────────────
@router.post("/{id}/messages", response_model=AdminRequestMessageOut)
def create_request_message_admin(id: str, body: AdminRequestMessageIn, user=Depends(require_admin)):
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="body required")

    author_id = str(user.get("sub"))
    author_role = user.get("role", "admin")

    payload = {
        "request_id": id,
        "author_id": author_id,
        "author_role": author_role,
        "body": text,
        "created_at": datetime.utcnow().isoformat(),
    }

    data, err = _resp_data(sb.table("request_messages").insert(payload).execute())
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")

    row = _row_or_none(data)
    return row


# ─── delete ─────────────────────────────────────────────────────────────────────
@router.delete("/{id}")
def delete_request(id: str):
    data, err = _resp_data(sb.table("requests").delete().eq("id", id).execute())
    if err:
        raise HTTPException(status_code=500, detail=f"DB error: {err}")
    return {"ok": True, "id": id}