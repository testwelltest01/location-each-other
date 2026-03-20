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
)
from app.services import session_service

router = APIRouter(prefix="/api/v1")


def _extract_bearer_token(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    value = raw.strip()
    if value.lower().startswith("bearer "):
        return value.split(" ", 1)[1].strip() or None
    return value


@router.post("/sessions", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: CreateSessionRequest,
    authorization: Optional[str] = Header(default=None),
) -> CreateSessionResponse:
    token = _extract_bearer_token(authorization)
    return session_service.create_session(payload, token)


@router.get(
    "/sessions/{session_id}/driver-location",
    response_model=DriverLocationResponse,
)
def get_driver_location(
    session_id: UUID,
    authorization: Optional[str] = Header(default=None),
    x_link_token: Optional[str] = Header(default=None, alias="X-Link-Token"),
) -> DriverLocationResponse:
    actor_context = session_service.AuthContext(
        driver_token=_extract_bearer_token(authorization),
        link_token=x_link_token,
    )
    return session_service.get_driver_location(session_id, actor_context)


@router.post("/sessions/{session_id}/end", response_model=EndSessionResponse)
def end_session(
    session_id: UUID,
    payload: EndSessionRequest,
    authorization: Optional[str] = Header(default=None),
) -> EndSessionResponse:
    token = _extract_bearer_token(authorization)
    return session_service.end_session(session_id, payload, token)
