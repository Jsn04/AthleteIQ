"""
Shared Supabase client with automatic reconnection.

Every route file imports `supabase` and `safe_query` from here instead of
creating its own client. This ensures a single connection pool and consistent
error recovery across the entire backend.
"""

import os
import httpx
from supabase import create_client

_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_client = create_client(_SUPABASE_URL, _SUPABASE_KEY)


def _reconnect():
    global _client
    _client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _client


def get_client():
    return _client


def safe_query(query_fn):
    """Run a Supabase query; on stale HTTP/2 connection, reconnect and retry once."""
    global _client
    try:
        return query_fn(_client)
    except (httpx.ReadError, httpx.ConnectError, httpx.RemoteProtocolError,
            httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout):
        _client = _reconnect()
        return query_fn(_client)
