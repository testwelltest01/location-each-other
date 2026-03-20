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


def get_db_url() -> str:
    """
    환경 변수에서 DB 접속 정보를 가져오되, Vercel/Neon 등에서 제공하는 'postgres://' 형식을 
    SQLAlchemy 2.0과 psycopg v3에 맞게 'postgresql+psycopg://'로 변환합니다.
    """
    url = os.getenv("DATABASE_URL")
    if not url:
        return "postgresql://postgres:postgres@localhost:5433/pickup_mvp"
    
    # SQLAlchemy 2.0 + psycopg2를 사용하기 위해 형식을 맞춥니다.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    # Neon/Vercel Postgres는 SSL 연결을 권장/필수하므로 sslmode를 추가합니다.
    if "sslmode" not in url:
        separator = "&" if "?" in url else "?"
        url += f"{separator}sslmode=require"
    
    # Neon/Vercel Postgres는 SSL 연결을 권장/필수하므로 sslmode를 추가합니다.
    if "sslmode" not in url:
        separator = "&" if "?" in url else "?"
        url += f"{separator}sslmode=require"
    
    return url

DATABASE_URL = get_db_url()
DB_CONNECT_TIMEOUT_SECONDS = int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "5"))

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    connect_args={"connect_timeout": DB_CONNECT_TIMEOUT_SECONDS},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    """앱 기동 시 필요한 테이블을 생성하고 스키마를 보정합니다."""
    logger.info("init_db: start")
    try:
        from app import models  # noqa: F401
        from sqlalchemy import text

        Base.metadata.create_all(bind=engine)
        
        # [수동 마이그레이션] 기존 테이블에 컬럼이 없는 경우 추가
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE session_links ADD COLUMN IF NOT EXISTS display_name VARCHAR(50)"))
            conn.execute(text("ALTER TABLE session_links ADD COLUMN IF NOT EXISTS device_info TEXT"))
            conn.execute(text("ALTER TABLE location_points ADD COLUMN IF NOT EXISTS device_info TEXT"))
            conn.commit()

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
