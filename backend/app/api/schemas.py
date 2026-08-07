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


class ProjectOpenedCreate(BaseModel):
    path: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class ProjectOut(BaseModel):
    id: str
    name: str
    path: str
    description: str | None
    created_at: str
    updated_at: str
    last_opened_at: str | None
