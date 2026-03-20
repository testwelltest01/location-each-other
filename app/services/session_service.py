from __future__ import annotations

from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import and_, desc, select
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# DB 연동을 위한 유틸리티와 모델들을 가져옵니다.
from app.db import get_db_session
from app.models import LocationPoint, PickupSession, SessionLink
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


@dataclass
class AuthContext:
    """인증 컨텍스트: 운전자 혹은 탑승자 링크 토큰 정보를 담습니다."""
    driver_token: Optional[str] = None
    link_token: Optional[str] = None


def _now() -> datetime:
    """현재 시간을 UTC 기준으로 가져오는 헬퍼 함수입니다."""
    return datetime.now(timezone.utc)


def create_session(req: CreateSessionRequest, driver_token: Optional[str]) -> CreateSessionResponse:
    """
    운전자가 세션을 생성하고 DB에 저장합니다.
    [학습 포인트] SQLAlchemy를 이용한 데이터 삽입(Insert)과 트랜잭션 처리
    """
    if not driver_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authorization token is required",
        )

    now = _now()
    # [학습 포인트] contextmanager인 get_db_session()을 사용하여 세션을 관리합니다.
    # 성공 시 자동으로 commit, 에러 발생 시 rollback이 수행됩니다.
    with get_db_session() as db:
        # 1. 세션 객체 생성 (운전자 정보 및 만료 시간 설정)
        session_obj = PickupSession(
            driver_id=req.driver_id,
            driver_token=driver_token,
            status="active",
            created_at=now,
            expires_at=now + timedelta(minutes=req.session_ttl_minutes),
        )
        db.add(session_obj)
        # db.flush()를 통해 DB에 반영은 하되, commit은 하지 않은 상태에서 생성된 ID(session_id)를 확보합니다.
        db.flush()

        # 2. 링크 객체 생성 (위 세션에 종속된 공유 링크)
        link_obj = SessionLink(
            session_id=session_obj.session_id,
            access_token=str(uuid4()),
            created_at=now,
            access_count=0,
            max_access_count=req.max_access_count,
            expires_at=now + timedelta(minutes=req.link_ttl_minutes),
            is_revoked=False,
        )
        db.add(link_obj)
        db.flush()

        # 3. 최종적으로 클라이언트에게 보낼 응답 생성
        return CreateSessionResponse(
            session_id=session_obj.session_id,
            session_token=str(uuid4()), # 이 예제에서는 단순 UUID를 세션 토큰으로 반환
            session_status=session_obj.status,
            link_token=link_obj.access_token,
            link_url=f"/api/v1/links/{link_obj.access_token}",
            expires_at=session_obj.expires_at,
            created_at=session_obj.created_at,
        )


def get_link_state(link_token: str) -> LinkAccessResponse:
    """
    링크 토큰을 통해 현재 링크와 세션의 유효성을 DB에서 조회합니다.
    [학습 포인트] select()와 scalar()를 이용한 데이터 조회
    """
    now = _now()
    with get_db_session() as db:
        # 1. 링크 토큰으로 SessionLink 테이블 조회
        link_obj = db.scalar(
            select(SessionLink).where(SessionLink.access_token == link_token)
        )
        if not link_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="link not found",
            )

        # 2. 링크에 연결된 PickupSession 정보 조회
        session_obj = db.get(PickupSession, link_obj.session_id)
        if not session_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="session not found",
            )

        # 3. 비즈니스 유효성 검사 (만료 시간, 폐기 여부, 접근 횟수 등)
        is_active = (
            not link_obj.is_revoked
            and now <= link_obj.expires_at
            and session_obj.status == "active"
            and now <= session_obj.expires_at
            and (
                link_obj.max_access_count is None
                or link_obj.access_count < link_obj.max_access_count
            )
        )

        if is_active:
            # 유효한 접근일 경우 카운트 증가 및 마지막 접속 시간 업데이트
            link_obj.access_count += 1
            link_obj.last_accessed_at = now

        return LinkAccessResponse(
            session_id=session_obj.session_id,
            session_status=session_obj.status,
            driver_id=session_obj.driver_id,
            session_expires_at=session_obj.expires_at,
            link_expires_at=link_obj.expires_at,
            link_active=is_active,
            message="link is active" if is_active else "link is not active",
        )


def share_passenger_location(
    link_token: str,
    req: ShareLocationRequest,
    token: Optional[str],
) -> ShareLocationResponse:
    """
    탑승자의 위치를 LocationPoint 테이블에 기록합니다.
    """
    now = _now()
    recorded_at = req.recorded_at or now

    with get_db_session() as db:
        # 링크 정보 조회 및 유효성 확인
        link_obj = db.scalar(
            select(SessionLink).where(SessionLink.access_token == link_token)
        )
        if not link_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="link not found")

        if link_obj.is_revoked or now > link_obj.expires_at:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="link expired or revoked")

        if link_obj.max_access_count is not None and link_obj.access_count >= link_obj.max_access_count:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="link access limit exceeded")

        session_obj = db.get(PickupSession, link_obj.session_id)
        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

        if session_obj.status != "active" or now > session_obj.expires_at:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="session not active")

        # 1. 위치 정보 기록 (LocationPoint 모델 생성 및 추가)
        point_obj = LocationPoint(
            session_id=session_obj.session_id,
            actor_type="passenger",
            link_id=link_obj.link_id,
            latitude=req.latitude,
            longitude=req.longitude,
            accuracy_m=req.accuracy_m,
            recorded_at=recorded_at,
        )
        db.add(point_obj)
        db.flush()

        return ShareLocationResponse(
            point_id=str(point_obj.point_id),
            session_id=session_obj.session_id,
            saved_at=point_obj.recorded_at,
        )


def get_driver_location(session_id: UUID, actor_context: AuthContext) -> DriverLocationResponse:
    """
    DB에서 해당 세션의 운전자 최신 위치 정보를 하나 가져옵니다.
    [학습 포인트] order_by와 desc()를 이용한 최신 데이터 정렬 및 limit(1) 처리
    """
    now = _now()

    with get_db_session() as db:
        session_obj = db.get(PickupSession, session_id)
        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

        # 권한 확인 (운전자 정보 대조 혹은 링크 토큰 대조)
        if not actor_context.driver_token and not actor_context.link_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing actor auth context")

        if actor_context.driver_token:
            if session_obj.driver_token != actor_context.driver_token:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid driver token")
        elif actor_context.link_token:
            link_obj = db.scalar(
                select(SessionLink).where(
                    and_(
                        SessionLink.access_token == actor_context.link_token,
                        SessionLink.session_id == session_obj.session_id,
                    )
                )
            )
            if not link_obj or link_obj.is_revoked or now > link_obj.expires_at:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid link token")

        if session_obj.status != "active" or now > session_obj.expires_at:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="session not active")

        # 1. 최신 위치 정보 조회 (기록 시간 기준 내림차순 정렬 후 최상단 1개)
        point_obj = db.scalar(
            select(LocationPoint)
            .where(
                and_(
                    LocationPoint.session_id == session_obj.session_id,
                    LocationPoint.actor_type == "driver",
                )
            )
            .order_by(desc(LocationPoint.recorded_at))
            .limit(1)
        )

        if not point_obj:
            return DriverLocationResponse(
                session_id=session_obj.session_id,
                session_status=session_obj.status,
                location=None,
            )

        return DriverLocationResponse(
            session_id=session_obj.session_id,
            session_status=session_obj.status,
            location=LocationDTO(
                latitude=float(point_obj.latitude),
                longitude=float(point_obj.longitude),
                accuracy_m=point_obj.accuracy_m if point_obj.accuracy_m is not None else None,
                recorded_at=point_obj.recorded_at,
            ),
        )


def end_session(
    session_id: UUID,
    req: EndSessionRequest,
    driver_token: Optional[str],
) -> EndSessionResponse:
    """
    운전자의 명령으로 세션을 종료하고 관련 링크들을 일괄 무효화 처리합니다.
    """
    if not driver_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authorization token is required")

    now = _now()
    with get_db_session() as db:
        session_obj = db.get(PickupSession, session_id)
        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

        if session_obj.driver_token != driver_token:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid driver token")

        if session_obj.status == "ended":
            return EndSessionResponse(
                session_id=session_obj.session_id,
                status=session_obj.status,
                ended_at=session_obj.ended_at or now,
                link_revoked_count=0,
            )

        # 1. 세션 상태 업데이트
        session_obj.status = "ended"
        session_obj.ended_at = now
        session_obj.end_reason = req.reason

        # 2. 관련 정보 일괄 조회 (scalars().all() 활용)
        links = db.scalars(
            select(SessionLink).where(SessionLink.session_id == session_obj.session_id)
        ).all()

        revoked_count = 0
        for link_obj in links:
            if not link_obj.is_revoked:
                link_obj.is_revoked = True
                revoked_count += 1

        return EndSessionResponse(
            session_id=session_obj.session_id,
            status="ended",
            ended_at=now,
            link_revoked_count=revoked_count,
        )


def check_link_status(link_token: str) -> LinkStatusResponse:
    """링크의 상태를 확인하여 접근 가능 여부를 반환합니다."""
    now = _now()
    with get_db_session() as db:
        link_obj = db.scalar(
            select(SessionLink).where(SessionLink.access_token == link_token)
        )
        if not link_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="link not found")

        session_obj = db.get(PickupSession, link_obj.session_id)
        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

        # 시간 및 상태 기반의 만료 여부 판별
        session_expired = now > session_obj.expires_at or session_obj.status != "active"
        link_expired = now > link_obj.expires_at or link_obj.is_revoked

        if link_expired:
            link_status = "expired"
        elif session_obj.status == "ended":
            link_status = "revoked"
        else:
            link_status = "active"

        return LinkStatusResponse(
            session_id=session_obj.session_id,
            link_status=link_status,
            session_status="ended" if session_expired else session_obj.status,
            session_expires_at=session_obj.expires_at,
            link_expires_at=link_obj.expires_at,
            can_access=not link_expired and not session_expired,
        )

