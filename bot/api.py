"""HTTP client for gemhog serve.

The bot implements zero grading logic: every answer comes from the local
serve process on 127.0.0.1. This module is the only place the bot talks to
it, and the base URL is configurable solely so tests can point it at a mock.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

BASE_URL = os.environ.get("GEMHOG_SERVE_URL", "http://127.0.0.1:4664")
TIMEOUT = httpx.Timeout(180.0, connect=5.0)


class ServeError(Exception):
    """The serve process answered with an error, or not at all."""


async def _get(path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT) as client:
            response = await client.get(path, params=params)
    except httpx.HTTPError as error:
        raise ServeError(f"gemhog serve is not answering ({error.__class__.__name__}); is it running?") from error
    data = response.json()
    if response.status_code >= 400:
        raise ServeError(data.get("error", f"serve answered {response.status_code}"))
    return data


async def check(token: str) -> dict[str, Any]:
    return await _get(f"/check/{token}")


async def top() -> dict[str, Any]:
    return await _get("/top")


async def holders(wallet: str) -> dict[str, Any]:
    return await _get(f"/holders/{wallet}")


async def alerts(since: str | None = None) -> list[dict[str, Any]]:
    data = await _get("/alerts", params={"since": since} if since else None)
    return data.get("alerts", [])


async def health() -> dict[str, Any]:
    return await _get("/health")
