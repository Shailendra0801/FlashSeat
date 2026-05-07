"""
Security utilities for FlashSeat
Modern password hashing using pwdlib
"""

from datetime import timedelta, datetime, timezone
from typing import Optional

from pwdlib import PasswordHash
import jwt
from app.core.config import settings


# Password hashing configuration
password_hash = PasswordHash.recommended()


def get_password_hash(password: str) -> str:
    """
    Hash a plain password securely.
    """
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against stored hash.
    """
    return password_hash.verify(
        plain_password,
        hashed_password
    )


# Optional: Token utilities (implement later)
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.
    expires_delta overrides the default from settings if provided.
    """
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )