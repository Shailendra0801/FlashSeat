"""
Security utilities for FlashSeat
Modern password hashing using pwdlib
"""

from datetime import timedelta
from typing import Optional

from pwdlib import PasswordHash


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
def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None
):
    """
    Placeholder for JWT token creation.
    """
    pass