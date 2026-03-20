from __future__ import annotations

from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Dict, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from app.schemas.link_schemas import (
    LinkAccessResponse,
    LinkStatusResponse,
    ShareLocationRequest,
    ShareLocationResponse,
    LocationDTO,
)
from app.schemas.session_schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    DriverLocationResponse,
    EndSessionRequest,
    EndSessionResponse,
)

# [공부 포인트 1] AuthContext 데이터 클래스
# 인증과 인가에 필요한 정보를 담는 가벼운 데이터 컨테이너입니다.
@dataclass
class AuthContext:
    driver_token: Optional[str] = None
    link_token: Optional[str] = None


# [공부 포인트 2] In-memory Mock DB
# 실제 데이터베이스를 연결하기 전, 파이썬의 딕셔너리를 이용해 데이터를 임시로 저장합니다.
# 서버가 재시작되면 데이터가 초기화되지만, API의 로직을 검증하기에 충분합니다.
_SESSIONS: Dict[str, Dict] = {}  # 세션 정보를 관리하는 딕셔너리
_LINKS: Dict[str, Dict] = {}     # 링크 정보를 관리하는 딕셔너리


def _now() -> datetime:
    """UTF-8 기준 현재 시간을 반환하는 유틸리티 함수입니다."""
    return datetime.now(timezone.utc)


def create_session(req: CreateSessionRequest, driver_token: Optional[str]) -> CreateSessionResponse:
    """
    운전자가 새로운 세션을 시작하고, 공유할 링크를 생성하는 비즈니스 로직입니다.
    """
    # 1. 간단한 인증 검증
    if not driver_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authorization token is required",
        )

    now = _now()
    session_id = str(uuid4()) # 고유 세션 ID 생성
    link_token = str(uuid4()) # 고유 링크 토큰 생성
    session_token = str(uuid4()) # 운전자용 토큰(관리를 위한 용도)

    # 2. 세션 정보 저장 (In-memory DB)
    _SESSIONS[session_id] = {
        "session_id": session_id,
        "driver_id": str(req.driver_id),
        "driver_token": driver_token,
        "status": "active",
        "created_at": now,
        "ended_at": None,
        "expires_at": now + timedelta(minutes=req.session_ttl_minutes),
        "end_reason": None,
        "driver_location": None,
        "links": [link_token],
    }

    # 3. 링크 정보 저장 (In-memory DB)
    _LINKS[link_token] = {
        "link_token": link_token,
        "session_id": session_id,
        "created_at": now,
        "last_accessed_at": None,
        "access_count": 0,
        "max_access_count": req.max_access_count,
        "expires_at": now + timedelta(minutes=req.link_ttl_minutes),
        "is_revoked": False,
    }

    # 4. 응답 스키마 반환
    return CreateSessionResponse(
        session_id=UUID(session_id),
        session_token=session_token,
        session_status="active",
        link_token=link_token,
        link_url=f"/api/v1/links/{link_token}",
        expires_at=_SESSIONS[session_id]["expires_at"],
        created_at=now,
    )


def get_link_state(link_token: str) -> LinkAccessResponse:
    """
    탑승자가 공유 링크를 클릭했을 때 링크의 생존 여부와 세션 정보를 조회합니다.
    """
    # 1. 링크 존재 여부 확인
    link = _LINKS.get(link_token)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="link not found",
        )

    # 2. 연결된 세션 존재 여부 확인
    session = _SESSIONS.get(link["session_id"])
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    now = _now()
    # 3. 링크와 세션의 유효성 검사 (만료 시간 비교 및 상태 확인)
    is_link_active = not link["is_revoked"] and now <= link["expires_at"]
    is_session_active = session["status"] == "active" and now <= session["expires_at"]
    is_active = bool(is_link_active and is_session_active)

    if is_active:
        # 데이터 업데이트 (조회 횟수 및 마지막 접속 시간)
        link["access_count"] += 1
        link["last_accessed_at"] = now

    return LinkAccessResponse(
        session_id=UUID(session["session_id"]),
        session_status=session["status"],
        driver_id=UUID(session["driver_id"]),
        session_expires_at=session["expires_at"],
        link_expires_at=link["expires_at"],
        link_active=is_active,
        message="link is active" if is_active else "link is not active",
    )


def share_passenger_location(
    link_token: str,
    req: ShareLocationRequest,
    token: Optional[str],
) -> ShareLocationResponse:
    """
    탑승자의 실시간 위치를 서버에 보고(저장)합니다.
    """
    link = _LINKS.get(link_token)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="link not found",
        )

    now = _now()
    # 링크가 만료되었는지 확인
    if now > link["expires_at"] or link["is_revoked"]:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="link expired or revoked",
        )

    session = _SESSIONS.get(link["session_id"])
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    # 세션 상태가 활성인지 확인
    if session["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="session not active",
        )

    point_id = str(uuid4()) # 기록 고유 ID 생성
    recorded_at = req.recorded_at or now
    # 세션 내부 리스트에 위치 정보 추가 (간단한 형태의 위치 추적 구현)
    session.setdefault("passenger_locations", []).append(
        {
            "point_id": point_id,
            "link_token": link_token,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "accuracy_m": req.accuracy_m,
            "recorded_at": recorded_at,
        }
    )

    return ShareLocationResponse(
        point_id=point_id,
        session_id=UUID(session["session_id"]),
        saved_at=now,
    )


def get_driver_location(session_id: UUID, actor_context: AuthContext) -> DriverLocationResponse:
    """
    운전자의 현재 위치 정보를 조회합니다.
    (운전자 자신의 앱 또는 공유 받은 탑승자 앱에서 호출 가능)
    """
    session = _SESSIONS.get(str(session_id))
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    now = _now()
    # 세션 유효성 확인
    if session["status"] != "active" or now > session["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="session not active",
        )

    # [공부 포인트 3] 다중 권한 확인
    # 운전자 토큰이 있거나, 링크 토큰이 있을 경우에만 조회를 허용합니다. (둘 다 없으면 권한 없음)
    if not actor_context.driver_token and not actor_context.link_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing actor auth context",
        )

    loc = session.get("driver_location")
    if loc is None:
        # 아직 위치 기록이 없다면 location을 None(null)으로 응답
        return DriverLocationResponse(
            session_id=session_id,
            session_status=session["status"],
            location=None,
        )

    return DriverLocationResponse(
        session_id=session_id,
        session_status=session["status"],
        location=LocationDTO(
            latitude=loc["latitude"],
            longitude=loc["longitude"],
            accuracy_m=loc.get("accuracy_m"),
            recorded_at=loc["recorded_at"],
        ),
    )


def end_session(
    session_id: UUID,
    req: EndSessionRequest,
    driver_token: Optional[str],
) -> EndSessionResponse:
    """
    운전자가 세션을 명시적으로 종료합니다.
    """
    session = _SESSIONS.get(str(session_id))
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    if not driver_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authorization token is required",
        )

    now = _now()
    # 이미 종료된 세션이라면 현재 상태 그대로 반환 (멱등성 확보)
    if session["status"] == "ended":
        return EndSessionResponse(
            session_id=session_id,
            status=session["status"],
            ended_at=session["ended_at"] or now,
            link_revoked_count=0,
        )

    # 1. 세션 상태 변경
    session["status"] = "ended"
    session["ended_at"] = now
    session["end_reason"] = req.reason

    # 2. 관련 정보 무효화 처리 (이 세션에 연결된 모든 공유 링크 비활성화)
    revoked_count = 0
    for link_token in session.get("links", []):
        link = _LINKS.get(link_token)
        if link and not link["is_revoked"]:
            link["is_revoked"] = True
            revoked_count += 1

    return EndSessionResponse(
        session_id=session_id,
        status="ended",
        ended_at=now,
        link_revoked_count=revoked_count,
    )


def check_link_status(link_token: str) -> LinkStatusResponse:
    """
    탑승자 앱에서 현재 링크가 여전히 유효한지(만료되지 않았는지) 확인하는 전용 API입니다.
    """
    link = _LINKS.get(link_token)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="link not found",
        )

    session = _SESSIONS.get(link["session_id"])
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    now = _now()
    # 만료된 이유를 구분하여 상태값을 계산합니다.
    link_expired = now > link["expires_at"] or link["is_revoked"]
    session_expired = now > session["expires_at"] or session["status"] != "active"

    if link_expired:
        link_status = "expired"
    elif session["status"] == "ended":
        link_status = "revoked"
    else:
        link_status = "active"

    return LinkStatusResponse(
        session_id=UUID(session["session_id"]),
        link_status=link_status,
        session_status="ended" if session_expired else session["status"],
        session_expires_at=session["expires_at"],
        link_expires_at=link["expires_at"],
        can_access=not link_expired and not session_expired,
    )
