from __future__ import annotations

import os, hmac, json, urllib.parse, logging
from hashlib import sha256
from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

log = logging.getLogger("initdata")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
DEV_TG_ID = os.environ.get("DEV_TG_ID", "").strip()


def verify_init_data(init_data: str) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN is not set")

    qs = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    hash_str = qs.pop("hash", None)
    if not hash_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="hash missing")

    data_check_string = "\n".join(f"{k}={qs[k]}" for k in sorted(qs.keys()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), sha256).digest()
    calc_hash = hmac.new(secret, data_check_string.encode(), sha256).hexdigest()
    if calc_hash != hash_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bad init data")

    try:
        user = json.loads(qs.get("user", "{}"))
    except Exception:
        user = {}
    return {"user": user, "raw": qs}


class TelegramInitDataMiddleware(BaseHTTPMiddleware):

    """
    ВАЖНО:
    - /admin/*: полностью пропускаем (панель → только cookie)
    - /api/admin/*: тоже пропускаем (админ API → cookie)
    - /api/uploads и /api/files: пропускаем (FormData)
    - /api/_diag/*: пропускаем
    - остальное под /api/* — проверяем initData
    """

    @staticmethod
    def _skip(path: str) -> bool:
        # 1) админка
        if path.startswith("/admin/") or path.startswith("/api/admin/"):
            return True

        # 2) загрузки файлов
        if path.startswith("/api/uploads") or path.startswith("/api/files"):
            return True

        # 3) диагностика
        if path.startswith("/api/_diag/"):
            return True

        # 4) webhook
        if path.startswith("/tg/"):
            return True

        # 5) статика
        if (
            path.startswith("/assets/")
            or path.startswith("/static/")
            or path.endswith(".js")
            or path.endswith(".css")
            or path.endswith(".map")
            or path.endswith(".png")
            or path.endswith(".ico")
            or path.endswith(".svg")
        ):
            return True

        return False

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # НЕ /api/* — пропускаем
        if not path.startswith("/api/"):
            return await call_next(request)

        # /admin/* и другие исключения — пропускаем
        if self._skip(path):
            return await call_next(request)

        # CORS
        if request.method == "OPTIONS":
            return await call_next(request)

        # читаем initData
        init = (
            request.headers.get("x-telegram-init-data")
            or request.headers.get("x-init-data")
            or request.headers.get("X-TELEGRAM-INIT-DATA")
            or request.headers.get("X-INIT-DATA")
            or ""
        ).strip()

        request.state.tg_id = None

        # дев-режим
        if not init and DEV_TG_ID:
            try:
                request.state.tg_id = int(DEV_TG_ID)
                return await call_next(request)
            except:
                pass

        if not init:
            return JSONResponse({"detail": "initData missing"}, status_code=401)

        try:
            data = verify_init_data(init)
            request.state.tg_id = int(data["user"]["id"])
        except HTTPException as e:
            return JSONResponse({"detail": e.detail}, status_code=e.status_code)
        except Exception:
            return JSONResponse({"detail": "initData verify error"}, status_code=401)

        return await call_next(request)