from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional


# ─────────────────────────────────────────
# USER REGISTRATION REQUEST
# ─────────────────────────────────────────
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


# ─────────────────────────────────────────
# USER LOGIN REQUEST
# ─────────────────────────────────────────
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ─────────────────────────────────────────
# USER RESPONSE
# ─────────────────────────────────────────
class UserResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: EmailStr
    is_admin: bool

    class Config:
        from_attributes = True


# ─────────────────────────────────────────
# JWT TOKEN RESPONSE
# ─────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─────────────────────────────────────────
# TOKEN PAYLOAD DATA
# ─────────────────────────────────────────
class TokenData(BaseModel):
    email: Optional[str] = None