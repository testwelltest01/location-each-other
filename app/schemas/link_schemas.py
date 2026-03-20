from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

# Pydantic 라이브러리를 사용한 데이터 검증 스키마 목록입니다.
# 클라이언트로부터 받는 데이터(Request)와 클라이언트에게 주는 데이터(Response)를 정의합니다.

class LocationDTO(BaseModel):
    """
    공통으로 사용되는 좌표(위치) 데이터 정보를 정의하는 객체입니다.
    Data Transfer Object (DTO) 역할을 합니다.
    """
    latitude: float         # 위도
    longitude: float        # 경도
    accuracy_m: Optional[float] = Field(default=None, ge=0)  # 위치 정확도(미터), 음수값은 허용하지 않음
    recorded_at: datetime   # 좌표 기록 시점
    device_info: Optional[str] = None # 기기 정보 (userAgent)


class ShareLocationRequest(BaseModel):
    """
    탑승자가 자신의 위치를 보낼 때 사용하는 데이터 명세입니다.
    """
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = Field(default=None, ge=0)
    recorded_at: Optional[datetime] = None  # 클라이언트가 기록 시간을 제공하지 않을 수 있으므로 Optional 처리
    device_info: Optional[str] = None


class LinkAccessResponse(BaseModel):
    """
    탑승자가 공유 링크에 처음 접속했을 때 받게 되는 응답 정보입니다.
    """
    session_id: UUID
    session_status: str       # 세션의 현재 상태 (active, ended 등)
    driver_id: UUID
    session_expires_at: datetime
    link_expires_at: datetime
    link_active: bool         # 링크가 여전히 유효한지 여부
    driver_location: Optional[LocationDTO] = None  # 운전자의 최신 위치 정보 추가
    device_info: Optional[str] = None              # 링크에 저장된 기기 정보
    message: str


class ShareLocationResponse(BaseModel):
    """
    위치 정보 저장 성공 시 반환되는 응답 명세입니다.
    """
    point_id: str             # 저장된 위치 데이터의 고유 ID
    session_id: UUID
    saved_at: datetime        # 서버에서 저장 처리된 시간


class LinkStatusResponse(BaseModel):
    """
    링크의 만료/상태를 주기적으로 확인할 때 사용되는 응답 정보입니다.
    """
    session_id: UUID
    link_status: str          # 링크의 구체적인 상태 (active, expired, revoked)
    session_status: str       # 연결된 세션의 상태
    session_expires_at: datetime
    link_expires_at: datetime
    can_access: bool          # 클라이언트에서 접근 허용 여부를 판단하기 위한 플래그
