from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LogLevel = Literal["INFO", "WARNING", "ERROR", "DEBUG"]


class LogEntryCreate(BaseModel):
    level: LogLevel
    source: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=4000)
    project_id: str | None = None


class LogEntryOut(BaseModel):
    id: str
    project_id: str | None
    level: str
    source: str
    message: str
    created_at: str
