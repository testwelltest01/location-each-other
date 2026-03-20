from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

# Pydantic을 이용한 데이터 스키마 정의 섹션입니다.
# 클라이언트와 서버 간에 주고받는 데이터의 형식을 정의하고 자동으로 검증(Validation)합니다.

class CreateSessionRequest(BaseModel):
    """
    운전자가 새로운 세션을 생성할 때 보내는 요청 데이터 스키마입니다.
    """
    driver_id: UUID  # 운전자의 고유 식별자 (UUID 형식)
    session_ttl_minutes: int = Field(default=120, ge=1)  # 세션 유효 시간 (분 단위, 최소 1분)
    link_ttl_minutes: int = Field(default=120, ge=1)     # 생성될 링크의 유효 시간 (분 단위, 최소 1분)
    max_access_count: Optional[int] = Field(default=None, ge=1)  # 링크 최대 접속 허용 횟수 (선택 사항)


class EndSessionRequest(BaseModel):
    """
    세션을 종료할 때 보내는 요청 데이터 스키마입니다.
    """
    reason: str = "driver_end"  # 종료 사유 (기본값: 'driver_end')


# 순환 참조를 피하기 위해 LocationDTO는 다른 파일에서 가져오거나 나중에 임포트합니다.
from app.schemas.link_schemas import LocationDTO


class CreateSessionResponse(BaseModel):
    """
    세션 생성 성공 시 클라이언트에게 반환되는 데이터 스키마입니다.
    """
    session_id: UUID       # 생성된 세션의 ID
    session_token: str     # 세션 관리를 위한 토큰 (운전자용)
    session_status: str    # 현재 세션 상태 (예: active)
    link_token: str        # 탑승자에게 공유할 링크 토큰
    link_url: str          # 탑승자가 접속할 전체 URL (또는 경로)
    expires_at: datetime   # 세션 만료 일시
    created_at: datetime   # 세션 생성 일시


class EndSessionResponse(BaseModel):
    """
    세션 종료 성공 시 반환되는 데이터 스키마입니다.
    """
    session_id: UUID           # 종료된 세션 ID
    status: str                # 종료 후 상태 (예: ended)
    ended_at: datetime         # 종료 처리된 일시
    link_revoked_count: int    # 이 세션 종료로 인해 무효화된 링크의 개수


class DriverLocationResponse(BaseModel):
    """
    운전자의 위치 정보를 조회할 때 반환되는 데이터 스키마입니다.
    """
    session_id: UUID
    session_status: str
    location: Optional[LocationDTO] = None  # 운전자의 현재 위치 정보 (없을 수 있음)
