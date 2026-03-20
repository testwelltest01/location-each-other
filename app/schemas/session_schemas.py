from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    driver_id: UUID
    session_ttl_minutes: int = Field(default=120, ge=1)
    link_ttl_minutes: int = Field(default=120, ge=1)
    max_access_count: Optional[int] = Field(default=None, ge=1)


class EndSessionRequest(BaseModel):
    reason: str = "driver_end"


from app.schemas.link_schemas import LocationDTO


class CreateSessionResponse(BaseModel):
    session_id: UUID
    session_token: str
    session_status: str
    link_token: str
    link_url: str
    expires_at: datetime
    created_at: datetime


class EndSessionResponse(BaseModel):
    session_id: UUID
    status: str
    ended_at: datetime
    link_revoked_count: int


class DriverLocationResponse(BaseModel):
    session_id: UUID
    session_status: str
    location: Optional[LocationDTO] = None
