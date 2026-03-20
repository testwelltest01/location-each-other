from __future__ import annotations

from fastapi import APIRouter, Header

from app.schemas.link_schemas import (
    LinkAccessResponse,
    ShareLocationRequest,
    ShareLocationResponse,
    LinkStatusResponse,
)
from app.services import session_service

# 공유 링크와 관련된 API들을 정의하는 라우터입니다.
router = APIRouter(prefix="/api/v1")


@router.get("/links/{link_token}", response_model=LinkAccessResponse)
def access_link(link_token: str) -> LinkAccessResponse:
    """
    탑승자가 공유 링크를 통해 세션 정보 및 현재 유효성을 처음으로 확인(접근)합니다.
    URL 경로의 'link_token'을 통해 식별합니다.
    """
    return session_service.get_link_state(link_token)


@router.post(
    "/links/{link_token}/locations",
    # [공부 포인트 1] response_model
    # 이 API가 성공했을 때 클라이언트에게 반환할 데이터의 '형식'을 선언합니다.
    response_model=ShareLocationResponse,
)
def share_passenger_location(
    link_token: str,
    payload: ShareLocationRequest,
    authorization: str | None = Header(default=None),
) -> ShareLocationResponse:
    """
    탑승자가 자신의 위치 정보를 공유(서버에 업로드)합니다.
    명시적인 토큰 대신 'link_token'을 주된 인증 수단으로 사용합니다.
    """
    token = authorization if authorization is None else str(authorization)
    return session_service.share_passenger_location(link_token, payload, token)


@router.get("/links/{link_token}/status", response_model=LinkStatusResponse)
def get_link_status(link_token: str) -> LinkStatusResponse:
    """
    현재 링크가 여전히 유효한지(접근 가능한지) 상태만 간단히 조회합니다.
    """
    return session_service.check_link_status(link_token)

