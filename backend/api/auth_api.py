from __future__ import annotations

from typing import Optional, Any, Dict, List, Tuple

from fastapi import APIRouter, Request, Header, HTTPException, Response

from utils.telegram import extract_user_from_request
from db import db_cursor

router = APIRouter(prefix="/auth", tags=["auth"])

# =========================
# helpers
# =========================

SESSION_COOKIE = "uv_sid"


def _pick_init_header(request: Request, x_telegram_init_data: Optional[str]) -> Optional[str]:
    """
    Берём initData из заголовка (приоритет) или из вариаций заголовков.
    """
    if x_telegram_init_data:
        return x_telegram_init_data
    h = request.headers
    return (
        h.get("X-Telegram-Init-Data")
        or h.get("x-telegram-init-data")
        or h.get("X-INIT-DATA")
        or h.get("x-init-data")
    )


def _table_has_column(cur, table_name: str, column_name: str) -> bool:
    cur.execute(
        """
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = %s
          and column_name = %s
        limit 1
        """,
        (table_name, column_name),
    )
    return cur.fetchone() is not None


def _view_exists(cur, view_name: str) -> bool:
    cur.execute(
        """
        select 1
        from information_schema.views
        where table_schema = 'public'
          and table_name = %s
        limit 1
        """,
        (view_name,),
    )
    return cur.fetchone() is not None


def _normalize_roles(raw: List[str]) -> List[str]:
    roles = []
    for r in (raw or []):
        if not r:
            continue
        r = str(r).strip().lower()
        if r == "owner":  # safety: owner -> admin
            r = "admin"
        if r in ("resident", "operator", "manager", "admin"):
            roles.append(r)
    # unique, preserve priority admin > manager > operator > resident
    prio = {"admin": 0, "manager": 1, "operator": 2, "resident": 3}
    roles = sorted(list(dict.fromkeys(roles)), key=lambda x: prio.get(x, 99))
    # hide resident if any staff role exists
    if any(r in ("admin", "manager", "operator") for r in roles):
        roles = [r for r in roles if r != "resident"]
    return roles


def _fetch_profile_by_tgid(cur, tg_id: int) -> Tuple[Dict[str, Any], List[str]]:
    """
    Возвращает (user_dict, roles) по tg_id.
    user_dict поля: tg_id, username, name, email, phone, language, unit, avatar_url (если есть)
    roles: собраны из admin_users + resident по умолчанию, потом нормализованы и resident скрыт при наличии staff
    """
    # Базовый профиль из users (+ avatar_url если столбец существует)
    has_avatar = _table_has_column(cur, "users", "avatar_url")
    if has_avatar:
        cur.execute(
            """
            select tg_id, username, name, email, phone, language, unit,
                   coalesce(nullif(avatar_url,''), null) as avatar_url
            from users
            where tg_id = %s
            limit 1
            """,
            (tg_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        tg_id_v, username_v, name_v, email_v, phone_v, lang_v, unit_v, avatar_v = row
    else:
        cur.execute(
            """
            select tg_id, username, name, email, phone, language, unit
            from users
            where tg_id = %s
            limit 1
            """,
            (tg_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        tg_id_v, username_v, name_v, email_v, phone_v, lang_v, unit_v = row
        avatar_v = None

    # Роли из admin_users по tg_id
    cur.execute(
        """
        select array_agg(distinct
                 case lower(trim(role))
                   when 'owner' then 'admin'
                   else lower(trim(role))
                 end
               ) filter (where role is not null) as staff_roles
        from admin_users
        where is_active = true and tg_id = %s
        """,
        (tg_id,),
    )
    staff_roles = cur.fetchone()[0] or []

    # Добавим resident “по умолчанию”, затем нормализуем
    raw_roles = (staff_roles or []) + ["resident"]
    roles = _normalize_roles(raw_roles)

    user = {
        "id": tg_id_v,
        "tg_id": tg_id_v,
        "username": username_v,
        "name": name_v,
        "email": email_v,
        "phone": phone_v,
        "language": lang_v,
        "unit": unit_v,
        "avatar_url": avatar_v,
        "roles": roles,
    }
    return user, roles


def _set_session_cookie(response: Response, tg_id: int):
    """
    Ставим простую httpOnly-сессию по tg_id.
    Если хочешь подпись — можно завернуть tg_id в HMAC, но для WebApp этого обычно хватает,
    пока авторизация идёт по подписанному initData на входе.
    """
    # 30 дней
    max_age = 60 * 60 * 24 * 30
    response.set_cookie(
        key=SESSION_COOKIE,
        value=str(tg_id),
        max_age=max_age,
        httponly=True,
        secure=True,          # в проде за прокси/https — безопаснее
        samesite="Lax",
        path="/",
    )


def _cookie_tg_id(request: Request) -> Optional[int]:
    """
    Небольшой fallback: если где-то удобно читать tg_id из куки.
    """
    try:
        raw = request.cookies.get(SESSION_COOKIE)
        if not raw:
            return None
        return int(raw)
    except Exception:
        return None


# =========================
# endpoints
# =========================

@router.post("/me", response_model=Dict[str, Any])
async def me(
    request: Request,
    response: Response,
    x_telegram_init_data: Optional[str] = Header(default=None, alias="X-Telegram-Init-Data"),
):
    """
    Принимаем Telegram initData, валидируем, апсертим пользователя, читаем роли.
    Дополнительно выставляем httpOnly-куку с tg_id, чтобы последующие запросы
    (например, /api/uploads с FormData) не падали из-за отсутствия заголовков.
    """
    init_header = _pick_init_header(request, x_telegram_init_data)
    tg_user = await extract_user_from_request(request, init_header)
    if not tg_user or "id" not in tg_user:
        raise HTTPException(status_code=401, detail="Invalid Telegram user")

    tg_id = int(tg_user["id"])
    username = tg_user.get("username")
    first_name = tg_user.get("first_name")
    last_name = tg_user.get("last_name")
    language_code = tg_user.get("language_code") or None
    photo_url = tg_user.get("photo_url") or None

    display_name = (first_name or username or "User").strip()
    if last_name:
        display_name = f"{display_name} {last_name}".strip()

    # 1) UPSERT в users
    try:
        with db_cursor() as cur:
            has_avatar = _table_has_column(cur, "users", "avatar_url")
            if has_avatar:
                cur.execute(
                    """
                    insert into users (tg_id, username, name, email, phone, language, unit, avatar_url, created_at, updated_at)
                    values (%s, %s, %s, null, null, %s, null, %s, now(), now())
                    on conflict (tg_id) do update
                      set username   = excluded.username,
                          name       = coalesce(excluded.name, users.name),
                          language   = coalesce(excluded.language, users.language),
                          avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
                          updated_at = now()
                    """,
                    (tg_id, username, display_name, language_code, photo_url),
                )
            else:
                cur.execute(
                    """
                    insert into users (tg_id, username, name, email, phone, language, unit, created_at, updated_at)
                    values (%s, %s, %s, null, null, %s, null, now(), now())
                    on conflict (tg_id) do update
                      set username   = excluded.username,
                          name       = coalesce(excluded.name, users.name),
                          language   = coalesce(excluded.language, users.language),
                          updated_at = now()
                    """,
                    (tg_id, username, display_name, language_code),
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upsert failed: {e}")

    # 2) ЧТЕНИЕ профиля + РОЛИ
    try:
        with db_cursor() as cur:
            user, roles = _fetch_profile_by_tgid(cur, tg_id)

        # Выставляем сессию (куку)
        _set_session_cookie(response, tg_id)

        return {"user": user, "roles": roles}

    except HTTPException:
        raise
    except Exception as e:
        # fallback: минимальный профиль, resident
        _set_session_cookie(response, tg_id)
        return {
            "user": {
                "id": tg_id,
                "tg_id": tg_id,
                "username": username,
                "name": display_name,
                "email": None,
                "phone": None,
                "language": language_code,
                "unit": None,
                "avatar_url": photo_url,
                "roles": ["resident"],
            },
            "roles": ["resident"],
            "warning": f"profile read failed: {e}",
        }


@router.get("/check", response_model=Dict[str, Any])
async def check(request: Request):
    """
    Быстрый чек авторизации. Полезно отлаживать аплоады/кросс-ориджин.
    Сначала пробуем initData, иначе смотрим куку `uv_sid`.
    """
    init_header = _pick_init_header(request, None)
    if init_header:
        tg_user = await extract_user_from_request(request, init_header)
        if tg_user and "id" in tg_user:
            return {"ok": True, "via": "initData", "tg_id": int(tg_user["id"])}

    tg_id = _cookie_tg_id(request)
    if tg_id:
        return {"ok": True, "via": "cookie", "tg_id": tg_id}

    raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/logout")
async def logout(response: Response):
    """
    Почистить сессию (куку).
    """
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}