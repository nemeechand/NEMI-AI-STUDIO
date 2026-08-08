from __future__ import annotations

from app.core.errors import NemiError


class ProviderError(NemiError):
    """Base class for all AI provider failures, normalized across the four
    SDKs so `api/ai.py` has one error shape to translate into an SSE
    `event: error` regardless of which provider raised it. Extends the
    app's existing `NemiError` so it still gets a consistent JSON shape
    from the global exception handlers if it ever escapes the streaming
    generator's own try/except (e.g. from a future non-streaming AI
    endpoint) instead of being silently unhandled."""

    code = "provider_error"


class MissingApiKeyError(ProviderError):
    code = "missing_api_key"


class AuthenticationError(ProviderError):
    code = "authentication_error"


class RateLimitError(ProviderError):
    code = "rate_limit_error"


class InvalidRequestError(ProviderError):
    code = "invalid_request_error"


class ProviderNetworkError(ProviderError):
    code = "network_error"


class UnknownProviderError(ProviderError):
    code = "unknown_provider"
