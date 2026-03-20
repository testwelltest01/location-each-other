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


@dataclass
class AuthContext:
    driver_token: Optional[str] = None
    link_token: Optional[str] = None


_SESSIONS: Dict[str, Dict] = {}
_LINKS: Dict[str, Dict] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_session(req: CreateSessionRequest, driver_token: Optional[str]) -> CreateSessionResponse:
    if not driver_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authorization token is required",
        )

    now = _now()
    session_id = str(uuid4())
    link_token = str(uuid4())
    session_token = str(uuid4())

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
    is_link_active = not link["is_revoked"] and now <= link["expires_at"]
    is_session_active = session["status"] == "active" and now <= session["expires_at"]
    is_active = bool(is_link_active and is_session_active)

    if is_active:
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
    link = _LINKS.get(link_token)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="link not found",
        )

    now = _now()
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

    if session["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="session not active",
        )

    point_id = str(uuid4())
    recorded_at = req.recorded_at or now
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
    session = _SESSIONS.get(str(session_id))
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    now = _now()
    if session["status"] != "active" or now > session["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="session not active",
        )

    if not actor_context.driver_token and not actor_context.link_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing actor auth context",
        )

    loc = session.get("driver_location")
    if loc is None:
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
    if session["status"] == "ended":
        return EndSessionResponse(
            session_id=session_id,
            status=session["status"],
            ended_at=session["ended_at"] or now,
            link_revoked_count=0,
        )

    session["status"] = "ended"
    session["ended_at"] = now
    session["end_reason"] = req.reason

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
