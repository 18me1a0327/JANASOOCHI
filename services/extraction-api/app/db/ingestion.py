from __future__ import annotations

import logging
from typing import Protocol

import httpx

from app.core.config import Settings
from app.core.exceptions import DatabasePersistenceError, PersistenceConfigurationError
from app.db.supabase_contracts import (
    AtomicPagePersistenceRequest,
    AtomicPagePersistenceResult,
)


logger = logging.getLogger("janasoochi.extraction.persistence")


class PageIngestionRepository(Protocol):
    async def persist_page(
        self,
        request: AtomicPagePersistenceRequest,
    ) -> AtomicPagePersistenceResult: ...


class SupabasePageIngestionRepository:
    """Backend-only client for the transactional page-ingestion RPC."""

    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if settings.supabase_url is None or settings.supabase_secret_key is None:
            raise PersistenceConfigurationError()
        self._url = settings.supabase_url.rstrip("/")
        self._secret = settings.supabase_secret_key.get_secret_value()
        self._client = client

    async def persist_page(
        self,
        request: AtomicPagePersistenceRequest,
    ) -> AtomicPagePersistenceResult:
        headers = {
            "apikey": self._secret,
            "content-type": "application/json",
        }
        if not self._secret.startswith("sb_secret_"):
            headers["authorization"] = f"Bearer {self._secret}"
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=30)
        try:
            response = await client.post(
                f"{self._url}/rest/v1/rpc/persist_extracted_page_v1",
                headers=headers,
                json=request.to_rpc_params(),
            )
        except httpx.HTTPError as exc:
            logger.exception("Supabase page persistence request failed", exc_info=exc)
            raise DatabasePersistenceError() from exc
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code >= 400:
            logger.error(
                "Supabase page persistence returned HTTP %s",
                response.status_code,
            )
            raise DatabasePersistenceError(status_code=response.status_code)
        try:
            return AtomicPagePersistenceResult.model_validate(response.json())
        except (ValueError, TypeError) as exc:
            logger.exception("Supabase page persistence returned an invalid contract")
            raise DatabasePersistenceError() from exc

