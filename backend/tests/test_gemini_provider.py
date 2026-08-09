from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import pytest

from app.ai.providers import gemini_provider


@dataclass
class _FakeModel:
    name: str | None


class _FakeModelsList:
    """Mimics the real `models.list()` async iterator the Gemini SDK
    returns — each real entry's `.name` is the full resource name
    (`models/<id>`), the shape `list_models()` must handle."""

    def __init__(self, names: list[str | None]) -> None:
        self._names = names

    def __aiter__(self) -> _FakeModelsList:
        self._iter = iter(self._names)
        return self

    async def __anext__(self) -> _FakeModel:
        try:
            return _FakeModel(name=next(self._iter))
        except StopIteration:
            raise StopAsyncIteration from None


class _FakeModels:
    def __init__(self, names: list[str | None]) -> None:
        self._names = names

    async def list(self) -> _FakeModelsList:
        return _FakeModelsList(self._names)


class _FakeAio:
    def __init__(self, names: list[str | None]) -> None:
        self.models = _FakeModels(names)

    async def aclose(self) -> None:
        pass


class _FakeClient:
    def __init__(self, names: list[str | None]) -> None:
        self.aio = _FakeAio(names)


def _patch_client(monkeypatch: pytest.MonkeyPatch, names: list[str | None]) -> None:
    def _fake_client(api_key: str, base_url: str | None) -> Any:
        return _FakeClient(names)

    monkeypatch.setattr(gemini_provider, "_client", _fake_client)


def test_list_models_strips_the_models_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    """Real Gemini API behavior: `Model.name` is a full resource name
    (`models/gemini-2.5-flash`), not the bare id `stream_chat`'s `model=`
    and every other part of the app (SUGGESTED_MODELS, pricing.ts, the
    Chat model field) use — this must come back bare so it's directly
    comparable/usable, not silently useless for model validation."""
    _patch_client(monkeypatch, ["models/gemini-3.6-flash", "models/gemini-2.5-pro"])
    provider = gemini_provider.GeminiProvider()

    models = asyncio.run(provider.list_models(api_key="fake-key"))

    assert models == ["gemini-2.5-pro", "gemini-3.6-flash"]


def test_list_models_returns_empty_without_api_key() -> None:
    provider = gemini_provider.GeminiProvider()

    models = asyncio.run(provider.list_models(api_key=None))

    assert models == []


def test_list_models_ignores_entries_with_no_name(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_client(monkeypatch, ["models/gemini-3.6-flash", None])
    provider = gemini_provider.GeminiProvider()

    models = asyncio.run(provider.list_models(api_key="fake-key"))

    assert models == ["gemini-3.6-flash"]
