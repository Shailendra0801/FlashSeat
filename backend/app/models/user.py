import random
import string
from sqlalchemy import Column, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import Base


def generate_userid():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


async def generate_unique_userid(db: AsyncSession):
    while True:
        userid = generate_userid()
        result = await db.execute(select(User).where(User.userid == userid))
        if not result.scalar():
            return userid


class User(Base):
    __tablename__ = "users"

    userid = Column(String(6), primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)