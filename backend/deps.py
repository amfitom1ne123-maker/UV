# backend/deps.py
from fastapi import Request, HTTPException
import jwt, os
ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "change-me")

def require_admin(req: Request, min_role: str = "operator"):
    token = req.cookies.get(os.getenv("ADMIN_COOKIE_NAME","uv_admin"))
    if not token: raise HTTPException(status_code=401)
    data = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=["HS256"])
    role = data.get("role","operator")
    order = {"operator":1, "manager":2, "admin":3}
    if order.get(role,0) < order.get(min_role,1):
        raise HTTPException(status_code=403)
    return data
