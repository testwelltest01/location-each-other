from __future__ import annotations

from fastapi import APIRouter, Header

from app.schemas.link_schemas import (
    LinkAccessResponse,
    ShareLocationRequest,
    ShareLocationResponse,
    LinkStatusResponse,
)
from app.services import session_service

router = APIRouter(prefix="/api/v1")


@router.get("/links/{link_token}", response_model=LinkAccessResponse)
def access_link(link_token: str) -> LinkAccessResponse:
    return session_service.get_link_state(link_token)


@router.post(
    "/links/{link_token}/locations",
    response_model=ShareLocationResponse,
)
def share_passenger_location(
    link_token: str,
    payload: ShareLocationRequest,
    authorization: str | None = Header(default=None),
) -> ShareLocationResponse:
    token = authorization if authorization is None else str(authorization)
    return session_service.share_passenger_location(link_token, payload, token)


@router.get("/links/{link_token}/status", response_model=LinkStatusResponse)
def get_link_status(link_token: str) -> LinkStatusResponse:
    return session_service.check_link_status(link_token)
