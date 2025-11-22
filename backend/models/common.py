from __future__ import annotations
from pydantic import BaseModel
from typing import Optional

class APIResponse(BaseModel):
    ok: bool = True
