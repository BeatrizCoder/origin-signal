"""Shared Anthropic client factory.

Built to tolerate unstable client networks (e.g. mobile hotspots): carrier-side
NAT rebinding can silently kill an HTTP keep-alive connection between calls in
a multi-turn tool-use loop, which surfaces as
`httpx.RemoteProtocolError: Server disconnected without sending a response`
on the *next* reused connection, not the one that actually died. Disabling
keep-alive reuse trades a bit of per-call latency (a fresh TLS handshake) for
never reusing a socket that might already be dead.
"""

import logging

import anthropic
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def build_anthropic_client(max_retries: int = 5) -> anthropic.Anthropic | None:
    if not settings.anthropic_api_key:
        return None
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        max_retries=max_retries,
        http_client=httpx.Client(limits=httpx.Limits(max_keepalive_connections=0)),
    )


def create_with_retry_log(client: anthropic.Anthropic, *, log_context: str, **kwargs):
    """anthropic.Anthropic.messages.create(), logging transient network failures.

    The SDK already retries APIConnectionError internally (see max_retries
    above); this only adds visibility so a future failure shows up clearly in
    the backend log instead of as a bare traceback.
    """
    try:
        return client.messages.create(**kwargs)
    except anthropic.APIConnectionError:
        logger.warning("Anthropic API connection failed for %s after retries", log_context, exc_info=True)
        raise
