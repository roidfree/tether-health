from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_service_client() -> Client:
    """Client authenticated with the service role key.

    Bypasses RLS - only used for server-side operations like the scheduler
    and the LiveKit agent writing call outcomes.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_client(access_token: str) -> Client:
    """Client scoped to a single user's JWT, so RLS policies apply."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client


def get_auth_client() -> Client:
    """Fresh, uncached client for sign up / sign in.

    gotrue's sign_up/sign_in_with_password establish a session on the client
    they're called on as a side effect. Never call these on the cached
    get_service_client() singleton - it's shared across all requests, and
    that side effect would leak one user's session into every other
    request's "service role" DB calls.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)
