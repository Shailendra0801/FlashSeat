from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token
)
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token
)
from app.core.dependencies import get_current_user, is_admin

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


# ─────────────────────────────────────────
# REGISTER USER
# ─────────────────────────────────────────
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db_session)
):
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_in.email)
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_admin=False
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


# ─────────────────────────────────────────
# USER LOGIN
# ─────────────────────────────────────────
@router.post(
    "/login",
    response_model=Token
)
async def login(
    user_in: UserLogin,
    db: AsyncSession = Depends(get_db_session)
):
    # Find user
    result = await db.execute(
        select(User).where(User.email == user_in.email)
    )

    user = result.scalar_one_or_none()

    # Validate credentials
    if not user or not verify_password(
        user_in.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token
    access_token = create_access_token(
        data={"sub": user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
    

# Get current users required data
@router.get(
    "/me",
    response_model=UserResponse
)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Get all users (admin only)
@router.get(
    "/users",
    response_model=list[UserResponse]
)
async def list_users(
    current_user: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(User))
    return result.scalars().all()