from __future__ import annotations

from contextlib import contextmanager
from typing import Generator
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# [학습 포인트] SQLAlchemy의 기본 클래스
# 모든 모델의 부모 클래스가 됩니다.
class Base(DeclarativeBase):
    pass


# 환경 변수에서 DB 정보를 가져오거나 기본값을 사용합니다.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/pickup_mvp",
)

# [학습 포인트] create_engine
# 실제 데이터베이스와의 물리적인 연결 통로를 생성합니다.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True, # 끊긴 연결을 자동으로 다시 시도하는 옵션
    future=True,       # SQLAlchemy 2.0 스타일 사용
)

# [학습 포인트] sessionmaker
# 데이터베이스와의 논리적인 통신(세션)을 만드는 공장 역할을 합니다.
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    """DB 테이블 정보를 바탕으로 실제 테이블을 생성합니다."""
    # models를 여기서 임포트해야 MetaData에 테이블 정보가 등록됩니다.
    from app import models  
    Base.metadata.create_all(bind=engine)


# [학습 포인트] contextmanager를 이용한 DB 세션 관리
# API 호출 시마다 DB 세션을 열고, 작업이 끝나면 안전하게 닫아줍니다.
@contextmanager
def get_db_session() -> Generator:
    db = SessionLocal()
    try:
        yield db
        db.commit()   # 성공 시 변경사항 확정
    except Exception:
        db.rollback() # 에러 발생 시 원상복구
        raise
    finally:
        db.close()    # 연결 해제
