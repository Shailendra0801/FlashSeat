"""
Seed Admin User Script
Run once to create the first admin user.

Usage (from backend/ directory):
    python -m scripts.seed_admin
"""

import asyncio
import sys
import os
import uuid

# ── Ensure project root is on sys.path ───────────────────────────────────────
# Required when running the script directly so `app.*` imports resolve.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from pwdlib import PasswordHash

from app.database import AsyncSessionFactory

# ── Password hashing (self-contained, no dependency on security module) ───────
password_hash = PasswordHash.recommended()

def get_password_hash(password: str) -> str:
    return password_hash.hash(password)


# ── Seed ──────────────────────────────────────────────────────────────────────
async def seed_admin_user() -> None:
    admin_email = "admin@flashseat.com"
    admin_password = "Admin@12345"

    async with AsyncSessionFactory() as session:
        # ── Check if admin already exists ─────────────────────────────────────
        result = await session.execute(
            text("SELECT user_id FROM users WHERE email = :email LIMIT 1"),
            {"email": admin_email},
        )
        if result.scalar_one_or_none():
            print("✅ Admin user already exists. Skipping.")
            return

        # ── Insert admin user ─────────────────────────────────────────────────
        await session.execute(
            text("""
                INSERT INTO users (
                    user_id, email, full_name, hashed_password,
                    is_admin, is_active, created_at, updated_at
                )
                VALUES (
                    :user_id, :email, :full_name, :hashed_password,
                    :is_admin, :is_active, NOW(), NOW()
                )
            """),
            {
                "user_id": str(uuid.uuid4()),
                "email": admin_email,
                "full_name": "FlashSeat Administrator",
                "hashed_password": get_password_hash(admin_password),
                "is_admin": True,
                "is_active": True,
            },
        )

        await session.commit()

    print("🎉 Admin user created successfully!")
    print("=" * 45)
    print(f"  Email    : {admin_email}")
    print(f"  Password : {admin_password}")
    print("=" * 45)
    print("⚠️  Change this password after first login!")


if __name__ == "__main__":
    asyncio.run(seed_admin_user())