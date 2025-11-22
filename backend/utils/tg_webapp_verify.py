# tg_webapp_verify.py
from __future__ import annotations
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Tuple
from urllib.parse import parse_qsl

# Исключение для удобства
class InitDataError(Exception):
    pass

def _build_data_check_string(pairs: Tuple[Tuple[str, str], ...]) -> str:
    """
    pairs: кортеж (key, value) уже URL-decoded (один раз).
    Из них строим data_check_string, исключая "hash".
    """
    filtered = [(k, v) for (k, v) in pairs if k != "hash"]
    filtered.sort(key=lambda kv: kv[0])  # лексикографическая сортировка по ключу
    return "\n".join(f"{k}={v}" for k, v in filtered)

def _compute_secret_key(bot_token: str) -> bytes:
    # ВАЖНО: секрет для WebApp = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN)
    return hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()

def _compute_signature(secret_key: bytes, data_check_string: str) -> str:
    return hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

def verify_init_data(init_data_raw: str, bot_token: str, max_age_seconds: int = 24 * 3600) -> Dict[str, Any]:
    """
    Проверяет подпись initData и возвращает распарсенный словарь.
    Бросает InitDataError при любой проблеме.
    """
    if not init_data_raw:
        raise InitDataError("Empty initData")

    # parse_qsl ДЕКОДИРУЕТ %xx и '+', НО не трогай результат повторно
    pairs = tuple(parse_qsl(init_data_raw, keep_blank_values=True, strict_parsing=False))
    data = {k: v for k, v in pairs}
    recv_hash = data.get("hash")
    if not recv_hash:
        raise InitDataError("Missing hash")

    # Строим строку проверки
    dcs = _build_data_check_string(pairs)

    # Секрет и подпись
    secret = _compute_secret_key(bot_token)
    calc_hash = _compute_signature(secret, dcs)

    # Сравниваем constant-time, без учета регистра
    if not hmac.compare_digest(calc_hash.lower(), recv_hash.lower()):
        raise InitDataError("Hash mismatch")

    # Проверяем возраст auth_date (если есть)
    if "auth_date" in data:
        try:
            auth_ts = int(data["auth_date"])
        except ValueError:
            raise InitDataError("Invalid auth_date")
        now = int(time.time())
        if max_age_seconds and (now - auth_ts) > max_age_seconds:
            raise InitDataError("initData expired")

    # Можно распарсить user (НЕ для подписи, только для удобства)
    if "user" in data:
        try:
            data["user_obj"] = json.loads(data["user"])
        except Exception:
            # не критично для подписи; оставим как строку
            pass

    return data
