from __future__ import annotations

from contextlib import contextmanager
from typing import Generator
import os
import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/pickup_mvp",
)
DB_CONNECT_TIMEOUT_SECONDS = int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "5"))

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    connect_args={"connect_timeout": DB_CONNECT_TIMEOUT_SECONDS},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    """앱 기동 시 필요한 테이블을 생성합니다."""
    logger.info("init_db: start")
    try:
        from app import models  # noqa: F401

        Base.metadata.create_all(bind=engine)
        logger.info("init_db: complete")
    except Exception as e:
        logger.exception("init_db failed")
        raise RuntimeError(f"Database initialization failed: {e}") from e


@contextmanager
def get_db_session() -> Generator:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
