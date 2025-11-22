from __future__ import annotations
import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

@lru_cache
def settings():
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        raise RuntimeError("SUPABASE_DB_URL is required")
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise RuntimeError("BOT_TOKEN is required")
    api_secret = (os.getenv("API_SECRET") or "").strip()
    if not api_secret:
        raise RuntimeError("API_SECRET is required")
    origins = [o.strip() for o in (os.getenv("CORS_ORIGINS") or "").split(",") if o.strip()]
    debug = os.getenv("DEBUG", "0") == "1"
    return {
        "DB_URL": db_url,
        "BOT_TOKEN": bot_token,
        "API_SECRET": api_secret,
        "CORS_ORIGINS": origins,
        "DEBUG": debug,
        "API_PREFIX": "/api",
    }
