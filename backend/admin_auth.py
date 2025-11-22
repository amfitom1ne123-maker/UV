# backend/admin_auth.py
from __future__ import annotations

import os, secrets, httpx, jwt, logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Response, Request, status
from pydantic import BaseModel
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("admin_auth")

# -------- ENV --------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "change-me")
ADMIN_COOKIE_NAME = os.getenv("ADMIN_COOKIE_NAME", "uv_admin")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "")
ENV = os.getenv("ENV", "").lower()  # "" (dev) | "prod"

# dev-флаг (можно выключить, но с нашим новым require_admin он уже не обязателен)
DEV_ADMIN = os.getenv("DEV_ADMIN", "0") == "1"

# Схемы-кандидаты для служебных таблиц (через .env можно задать свой порядок)
ADMIN_SCHEMAS = [
    s.strip() for s in os.getenv("ADMIN_SCHEMAS", "public,admin,private").split(",") if s.strip()
]

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_ANON_KEY:
    raise RuntimeError("Supabase env is missing")

# Cookie/security
# ---- COOKIE FIX ----
# В DEV режиме всегда работать без secure/samesite=none
if ENV == "prod":
    COOKIE_SECURE = True
    COOKIE_SAMESITE = "none"
else:
    COOKIE_SECURE = False          # главная правка
    COOKIE_SAMESITE = "lax"        # главная правка

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


# ---------- utils ----------
def _issue_session_cookie(res: Response, payload: dict, hours=24):
    exp = datetime.now(timezone.utc) + timedelta(hours=hours)
    token = jwt.encode({**payload, "exp": exp}, ADMIN_JWT_SECRET, algorithm="HS256")
    res.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=hours * 3600,
        path="/",
    )


def _read_session(req: Request):
    token = req.cookies.get(ADMIN_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No session")
    try:
        return jwt.decode(token, ADMIN_JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


def _parse_ts(ts):
    """Принимает str или datetime; возвращает tz-aware UTC datetime."""
    if ts is None:
        raise ValueError("empty timestamp")
    if isinstance(ts, datetime):
        dt = ts
    else:
        s = str(ts)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _resp_data(resp):
    """
    Универсально достаёт (data, error) из supabase execute().
    Поддерживает PostgrestResponse, dict, None.
    """
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


# --- обёртки над supabase с автоподбором схемы ---
def _table(schema: str, name: str):
    return sb.schema(schema).table(name)


def _find_admin_by_email(email: str):
    last_err = None
    for schema in ADMIN_SCHEMAS:
        try:
            data, err = _resp_data(
                _table(schema, "admin_users").select("*").eq("email", email).execute()
            )
            if err:
                last_err = f"{schema}: {err}"
                continue
            row = _row_or_none(data)
            if row:
                log.info("admin_users hit schema=%s", schema)
                return row
        except Exception as e:
            last_err = f"{schema}: {e}"
    if last_err:
        log.error("admin_users(by email) not found; last_err=%s", last_err)
    return None


def _find_admin_by_tg_id(tg_id: int):
    last_err = None
    for schema in ADMIN_SCHEMAS:
        try:
            data, err = _resp_data(
                _table(schema, "admin_users").select("*").eq("tg_id", tg_id).execute()
            )
            if err:
                if "406" in str(err).lower() or "not acceptable" in str(err).lower():
                    last_err = f"{schema}: 406"
                    continue
                last_err = f"{schema}: {err}"
                continue
            row = _row_or_none(data)
            if row:
                log.info("admin_users hit schema=%s", schema)
                return row
        except Exception as e:
            last_err = f"{schema}: {e}"
    if last_err:
        log.error("admin_users(by tg_id) not found; last_err=%s", last_err)
    return None


# ---------- dependency: require_admin ----------
# РОВНО три разрешённые роли:
ALLOWED_ADMIN_ROLES = {"admin", "manager", "operator"}


def require_admin(req: Request):
    """
    Достаёт и валидирует нашу админ-сессию из httpOnly cookie.
    Разрешаем только роли из ALLOWED_ADMIN_ROLES.
    Возвращает payload (dict) при успехе.

    В DEV-режиме (ENV != prod) НЕ ломаемся из-за куки:
    - если сессия ок — используем её;
    - если сессии нет/битая/просрочена — логируем и пускаем как dev-admin.
    """
    # Не-prod: максимально дружелюбный режим разработки
    if ENV != "prod":
        try:
            data = _read_session(req)
            role = data.get("role") or "admin"
            if role not in ALLOWED_ADMIN_ROLES:
                role = "admin"
            data["role"] = role
            return data
        except HTTPException as e:
            log.warning("DEV require_admin: session error (%s), fallback to dev-admin", e.detail)
            return {
                "sub": "dev-admin",
                "email": None,
                "tg_id": None,
                "role": "admin",
                "kind": "dev",
            }

    # Прод: строгая проверка
    try:
        data = _read_session(req)
    except HTTPException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin session",
        ) from e

    role = data.get("role")
    if role not in ALLOWED_ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    return data


# ---------- email/password via Supabase ----------
class EmailLoginIn(BaseModel):
    email: str
    password: str


@router.post("/email-session")
async def email_session(body: EmailLoginIn, res: Response):
    # 1) проверяем в Supabase Auth пароль
    async with httpx.AsyncClient(timeout=10) as client:
        url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        r = await client.post(
            url,
            json={"email": body.email, "password": body.password},
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    auth = r.json()
    supa_user_id = (auth.get("user") or {}).get("id")
    if not supa_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth failed")

    # 2) проверяем, что email — админ и активен (автоподбор схемы)
    row = _find_admin_by_email(body.email)
    if not row or not row.get("is_active", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin or inactive")

    # 3) выдаём сессию
    payload = {
        "sub": supa_user_id,
        "email": body.email,
        "role": row["role"],
        "kind": "email",
        "tg_id": row.get("tg_id"),  # опционально
    }
    _issue_session_cookie(res, payload, hours=24)
    return {"ok": True, "user": {"email": body.email, "role": row["role"], "tg_id": row.get("tg_id")}}


# ---------- Telegram deep-link / nonce ----------
class StartOut(BaseModel):
    nonce: str
    deep_link: str


@router.get("/telegram/start", response_model=StartOut)
async def telegram_start():
    if not TELEGRAM_BOT_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bot username not configured",
        )
    nonce = secrets.token_urlsafe(24)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    try:
        resp = sb.table("telegram_nonces").insert({
            "nonce": nonce,
            "expires_at": expires_at.isoformat(),
            "used": False
        }).execute()
        _, err = _resp_data(resp)
        if err:
            log.error("Supabase insert error: telegram_nonces: %s", err)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error")
    except HTTPException:
        raise
    except Exception:
        log.exception("Supabase insert exception: telegram_nonces")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error")
    deep_link = f"https://t.me/{TELEGRAM_BOT_USERNAME}?start={nonce}"
    return {"nonce": nonce, "deep_link": deep_link}


class TgCallbackIn(BaseModel):
    nonce: str
    tg_id: int
    tg_username: str | None = None


@router.post("/telegram/callback")
async def telegram_callback(body: TgCallbackIn):
    # 1) читаем nonce
    try:
        resp = (
            sb.table("telegram_nonces")
            .select("*")
            .eq("nonce", body.nonce)
            .maybe_single()
            .execute()
        )
        data, err = _resp_data(resp)
        q = _row_or_none(data)
    except Exception:
        log.exception("Supabase read telegram_nonces failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (read nonce)")
    if err:
        log.error("Supabase error telegram_nonces (read): %s", err)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (read nonce)")
    if not q:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="nonce not found")

    # 2) проверяем срок/состояние
    try:
        expires_at = _parse_ts(q.get("expires_at"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="bad expires_at")
    now = datetime.now(timezone.utc)
    if q.get("used"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="nonce already used")
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="nonce expired")

    # 3) ищем админа по tg_id (автоподбор схемы)
    adm = _find_admin_by_tg_id(body.tg_id)
    if not adm or not adm.get("is_active", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Telegram ID is not allowed")

    # 4) помечаем nonce как used; если нет admin_user_id — фоллбэк
    update_payload = {"used": True, "tg_id": body.tg_id}
    try:
        resp = sb.table("telegram_nonces").update({
            **update_payload, "admin_user_id": adm.get("id")
        }).eq("nonce", body.nonce).execute()
        _, err = _resp_data(resp)
        if err:
            # попробуем без admin_user_id
            resp2 = sb.table("telegram_nonces").update(update_payload).eq("nonce", body.nonce).execute()
            _, err2 = _resp_data(resp2)
            if err2:
                log.error("Supabase update nonce failed (without admin_user_id): %s", err2)
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (update nonce)")
    except HTTPException:
        raise
    except Exception as e:
        log.warning("Update with admin_user_id failed, retrying without: %s", e)
        try:
            resp2 = sb.table("telegram_nonces").update(update_payload).eq("nonce", body.nonce).execute()
            _, err2 = _resp_data(resp2)
            if err2:
                log.error("Supabase update nonce failed (without admin_user_id): %s", err2)
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (update nonce)")
        except Exception:
            log.exception("Supabase update nonce exception (without admin_user_id)")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (update nonce)")

    # 5) (опционально) exchange_token
    exchange_token = None
    try:
        exchange_token = secrets.token_urlsafe(32)
        resp = sb.table("telegram_nonces").update({"exchange_token": exchange_token}).eq("nonce", body.nonce).execute()
        _, err = _resp_data(resp)
        if err:
            log.warning("Failed to store exchange_token: %s", err)
    except Exception as e:
        log.warning("Exchange token update exception: %s", e)

    log.info("TG login confirmed: tg_id=%s admin_id=%s", body.tg_id, adm.get("id"))
    return {"ok": True, "exchange_token": exchange_token, "role": adm["role"]}


class WaitIn(BaseModel):
    nonce: str


@router.post("/telegram/wait")
async def telegram_wait(body: WaitIn, res: Response):
    # читаем nonce
    try:
        resp = (
            sb.table("telegram_nonces")
            .select("*")
            .eq("nonce", body.nonce)
            .maybe_single()
            .execute()
        )
        data, err = _resp_data(resp)
        row = _row_or_none(data)
    except Exception:
        log.exception("Supabase read telegram_nonces (wait) failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (read nonce)")
    if err:
        log.error("Supabase error telegram_nonces (wait): %s", err)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB error (read nonce)")
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown nonce")

    # Не подтверждён — просто ждём (и мягко отмечаем просрочку)
    if not row.get("used"):
        try:
            if _parse_ts(row.get("expires_at")) < datetime.now(timezone.utc):
                return {"ready": False, "expired": True}
        except Exception:
            pass
        return {"ready": False}

    # Подтверждён — найдём админа по admin_user_id или tg_id (автоподбор схемы)
    adm = None
    if row.get("admin_user_id"):
        for schema in ADMIN_SCHEMAS:
            try:
                data, err = _resp_data(
                    sb.schema(schema).table("admin_users").select("*").eq("id", row["admin_user_id"]).execute()
                )
                cand = _row_or_none(data)
                if cand:
                    adm = cand
                    log.info("admin_users hit schema=%s (by id)", schema)
                    break
            except Exception:
                continue

    if not adm:
        adm = _find_admin_by_tg_id(row.get("tg_id"))

    if not adm:
        log.error("Admin not found on wait: nonce=%s tg_id=%s", body.nonce, row.get("tg_id"))
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin record not found")

    payload = {
        "sub": str(adm.get("id")),
        "tg_id": row.get("tg_id"),
        "role": adm["role"],
        "kind": "telegram",
        "email": adm.get("email"),
    }
    _issue_session_cookie(res, payload, hours=24)
    return {"ready": True, "user": {"tg_id": row.get("tg_id"), "role": adm["role"]}}


@router.post("/logout")
def logout(res: Response):
    res.delete_cookie(ADMIN_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(req: Request):
    """
    /admin/auth/me НЕ использует dev-fallback, чтобы ты видел реальную сессию.
    Если нужно, можно заменить на require_admin(req).
    """
    data = _read_session(req)
    return {
        "user": {
            "email": data.get("email"),
            "tg_id": data.get("tg_id"),
            "role": data.get("role"),
            "kind": data.get("kind"),
            "sub": data.get("sub"),
        }
    }


__all__ = ["router", "require_admin"]