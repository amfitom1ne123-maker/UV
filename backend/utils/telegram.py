from __future__ import annotations
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Body, Request
from config import settings
from utils.tg_webapp_verify import verify_init_data, InitDataError
import json

async def extract_user_from_request(
    request: Request,
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
):
    # пробуем прочитать сырое тело (если фронт положил initData в body)
    try:
        raw_body = await request.json()
    except Exception:
        raw_body = None
    raw = (x_telegram_init_data or "").strip()
    if not raw and isinstance(raw_body, dict):
        raw = (raw_body.get("initData") or raw_body.get("__initData") or "").strip()
    if not raw:
        raise HTTPException(401, "Missing initData (header/body)")

    try:
        data = verify_init_data(raw, settings()["BOT_TOKEN"], max_age_seconds=24*3600)
    except InitDataError as e:
        raise HTTPException(401, f"initData invalid: {e}")

    user_obj = data.get("user_obj")
    if not user_obj:
        try:
            user_obj = json.loads(data.get("user", "") or "{}")
        except Exception:
            user_obj = None
    if not user_obj or "id" not in user_obj:
        raise HTTPException(401, "initData: user missing")
    return user_obj  # содержит как минимум id, username?, language_code?
