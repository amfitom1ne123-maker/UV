from __future__ import annotations
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class RegisterInput(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=64)
    language: Optional[str] = Field(default=None, max_length=8)
    # unit оставлен опциональным, если ты решишь хранить его в users
    unit: Optional[str] = None

class UserOut(BaseModel):
    id: str | int  # в твоей схеме users PK = tg_id (bigint)
    tg_id: int
    username: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    unit: Optional[str] = None
