# backend/main.py
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# --- Middleware ---
# Telegram WebApp initData проверяем ТОЛЬКО для /api/* (логика внутри мидлвари)
from middleware.middleware_initdata import TelegramInitDataMiddleware
# Если хотите защищать /admin/* глобально кукой/Bearer (вместо Depends(require_admin)):
# from middleware.admin_auth import AdminAuthMiddleware

# --- Routers ---
from admin_requests import router as admin_requests_router            # /admin/requests/*
from admin_auth import router as admin_auth_router                    # /admin/auth/*
from api.auth_api import router as auth_router                        # /api/auth/*
from api.requests_api import router as requests_router                # /api/requests/*
from routes.profile import router as profile_router                   # /api/profile/*
from routes.tg_webhook import router as tg_router                     # /tg/*
from routes.uploads import router as uploads_router                   # /api/uploads, /api/files, /api/admin/uploads

# ────────────────────────────────────────────────────────────────────────────────
# Settings
# ────────────────────────────────────────────────────────────────────────────────
load_dotenv()
DEBUG = bool(int(os.getenv("DEBUG", "0")))
API_PREFIX = os.getenv("API_PREFIX", "/api")

_raw_origins = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or [
    "http://localhost:5173",
]

app = FastAPI(debug=DEBUG, title="MiniUrban API")

# ────────────────────────────────────────────────────────────────────────────────
# CORS (до роутеров и мидлварей)
# ────────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "*",
        "Authorization",
        "Content-Type",
        "X-INIT-DATA",
        "X-TELEGRAM-INIT-DATA",
        "X-Requested-With",
    ],
)

# ────────────────────────────────────────────────────────────────────────────────
# Middleware
# ────────────────────────────────────────────────────────────────────────────────
# Проверка initData для /api/* (мидлварь сама игнорирует не-/api пути)
app.add_middleware(TelegramInitDataMiddleware)
# app.add_middleware(AdminAuthMiddleware)  # если нужен глобальный гард на /admin/*

# ────────────────────────────────────────────────────────────────────────────────
# Routers
# ────────────────────────────────────────────────────────────────────────────────
# Админ-аутентификация: /admin/auth/*
app.include_router(admin_auth_router)

# Админ-заявки: /admin/requests/*
app.include_router(admin_requests_router)

# Остальные API под префиксом /api
app.include_router(auth_router,     prefix=API_PREFIX)   # /api/auth/*
app.include_router(requests_router, prefix=API_PREFIX)   # /api/requests/*
app.include_router(profile_router,  prefix=API_PREFIX)   # /api/profile/*
app.include_router(uploads_router,  prefix=API_PREFIX)   # /api/uploads, /api/files, /api/admin/uploads

# Telegram webhook: /tg/*
app.include_router(tg_router)

# ────────────────────────────────────────────────────────────────────────────────
# Static (SPA)
# ────────────────────────────────────────────────────────────────────────────────
FRONTEND_DIST = (Path(__file__).resolve().parent.parent / "frontend" / "dist").resolve()

if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir), html=False), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        return {"ok": True}

# ────────────────────────────────────────────────────────────────────────────────
# Diagnostics
# ────────────────────────────────────────────────────────────────────────────────
@app.get(f"{API_PREFIX}/_diag/health")
def api_health():
    return {"ok": True}

@app.get(f"{API_PREFIX}/_diag/routes")
def api_routes():
    return [
        {"path": r.path, "name": r.name, "methods": sorted([*(r.methods or [])])}
        for r in app.router.routes
    ]