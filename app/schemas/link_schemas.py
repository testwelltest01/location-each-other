from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LocationDTO(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = Field(default=None, ge=0)
    recorded_at: datetime


class ShareLocationRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = Field(default=None, ge=0)
    recorded_at: Optional[datetime] = None


class LinkAccessResponse(BaseModel):
    session_id: UUID
    session_status: str
    driver_id: UUID
    session_expires_at: datetime
    link_expires_at: datetime
    link_active: bool
    message: str


class ShareLocationResponse(BaseModel):
    point_id: str
    session_id: UUID
    saved_at: datetime


class LinkStatusResponse(BaseModel):
    session_id: UUID
    link_status: str
    session_status: str
    session_expires_at: datetime
    link_expires_at: datetime
    can_access: bool
