from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Header, status

from app.schemas.session_schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    EndSessionRequest,
    DriverLocationResponse,
    EndSessionResponse,
    UpdateDriverLocationRequest,
    CreateLinkResponse,
    PassengerLocationsResponse,
    SessionLinksResponse,
    UpdateLinkRequest,
)
from app.schemas.link_schemas import ShareLocationResponse
from app.services import session_service

# [공부 포인트 1] APIRouter
# API 경로를 그룹화하여 관리합니다. prefix="/api/v1"을 통해 이 라우터의 모든 경로는 
# "/api/v1"으로 시작하게 됩니다. (예: /api/v1/sessions)
router = APIRouter(prefix="/api/v1")


def _extract_bearer_token(raw: Optional[str]) -> Optional[str]:
    """
    HTTP Header에서 'Bearer {token}' 형태의 문자열 중 토큰 부분만 추출하는 헬퍼 함수입니다.
    """
    if not raw:
        return None
    value = raw.strip()
    if value.lower().startswith("bearer "):
        # 'Bearer ' 문자열을 제외한 실제 토큰 값만 잘라냅니다.
        return value.split(" ", 1)[1].strip() or None
    return value


@router.post("/sessions", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: CreateSessionRequest,
    # [공부 포인트 2] Header 의존성 주입
    # FastAPI는 매개변수 이름을 기반으로 HTTP 요청 헤더를 자동으로 찾아 주입해줍니다.
    authorization: Optional[str] = Header(default=None),
) -> CreateSessionResponse:
    """
    운전자가 새로운 위치 공유 세션을 생성합니다.
    """
    token = _extract_bearer_token(authorization)
    # 실제 비즈니스 로직은 service 레이어에서 처리하도록 위임합니다.
    return session_service.create_session(payload, token)


@router.get(
    "/sessions/{session_id}/driver-location",
    response_model=DriverLocationResponse,
)
def get_driver_location(
    session_id: UUID,
    authorization: Optional[str] = Header(default=None),
    # Header('X-Link-Token')는 커스텀 헤더 'X-Link-Token'을 이 변수에 바인딩합니다.
    x_link_token: Optional[str] = Header(default=None, alias="X-Link-Token"),
) -> DriverLocationResponse:
    """
    특정 세션의 운전자 현재 위치를 조회합니다.
    (운전자 본인 또는 유효한 링크를 가진 탑승자만 가능)
    """
    print("sessions.py의 def get_driver_location 실행됨.")
    actor_context = session_service.AuthContext(
        driver_token=_extract_bearer_token(authorization),
        link_token=x_link_token,
    )
    return session_service.get_driver_location(session_id, actor_context)


@router.post(
    "/sessions/{session_id}/driver-location",
    response_model=ShareLocationResponse,
)
def update_driver_location(
    session_id: UUID,
    payload: UpdateDriverLocationRequest,
    authorization: Optional[str] = Header(default=None),
) -> ShareLocationResponse:
    """
    운전자가 자신의 현재 위치 정보를 업데이트합니다.
    """
    token = _extract_bearer_token(authorization)
    return session_service.update_driver_location(session_id, payload, token)


@router.post("/sessions/{session_id}/end", response_model=EndSessionResponse)
def end_session(
    session_id: UUID,
    payload: EndSessionRequest,
    authorization: Optional[str] = Header(default=None),
) -> EndSessionResponse:
    """
    운전자가 세션을 명시적으로 종료합니다.
    """
    token = _extract_bearer_token(authorization)
    return session_service.end_session(session_id, payload, token)


@router.post("/sessions/{session_id}/links", response_model=CreateLinkResponse)
def create_link(
    session_id: UUID,
    authorization: Optional[str] = Header(default=None),
) -> CreateLinkResponse:
    """
    운전자가 새로운 탑승자용 공유 링크를 추가로 생성합니다.
    """
    token = _extract_bearer_token(authorization)
    return session_service.create_session_link(session_id, token)


@router.delete("/sessions/{session_id}/links")
def revoke_links(
    session_id: UUID,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """
    세션의 모든 링크를 무효화합니다.
    """
    token = _extract_bearer_token(authorization)
    return session_service.revoke_all_session_links(session_id, token)


@router.get("/sessions/{session_id}/passengers", response_model=PassengerLocationsResponse)
def get_passengers(
    session_id: UUID,
    authorization: Optional[str] = Header(default=None),
) -> PassengerLocationsResponse:
    """
    모든 탑승자의 최신 위치 목록을 조회합니다 (운전자용).
    """
    token = _extract_bearer_token(authorization)
    return session_service.get_passenger_locations(session_id, token)


@router.get("/sessions/{session_id}/links", response_model=SessionLinksResponse)
def get_session_links(
    session_id: UUID,
    authorization: Optional[str] = Header(default=None),
) -> SessionLinksResponse:
    """
    세션에 속한 모든 공유 링크 목록을 조회합니다.
    """
    token = _extract_bearer_token(authorization)
    return session_service.get_session_links(session_id, token)


@router.delete("/sessions/{session_id}/links/{link_token}")
def revoke_session_link(
    session_id: UUID,
    link_token: str,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """
    특정 공유 링크 하나를 삭제(무효화)합니다.
    """
    token = _extract_bearer_token(authorization)
    return session_service.revoke_session_link(session_id, link_token, token)


@router.patch("/sessions/{session_id}/links/{link_token}")
def update_session_link(
    session_id: UUID,
    link_token: str,
    payload: UpdateLinkRequest,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """
    특정 공유 링크의 정보를 수정합니다 (예: 이름 변경).
    """
    token = _extract_bearer_token(authorization)
    return session_service.update_session_link(
        session_id, link_token, payload.display_name, token
    )

