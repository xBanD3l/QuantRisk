from __future__ import annotations

import os

import jwt
from fastapi import Header, HTTPException


def _jwt_secret() -> str | None:
    return os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET")


def verify_supabase_token(authorization: str | None) -> str | None:
    """Return authenticated user id from Supabase JWT, or None if unauthenticated."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()
    if not token:
        return None

    secret = _jwt_secret()
    if not secret:
        return None

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session payload.")
    return str(user_id)


def get_user_id(authorization: str | None = Header(default=None)) -> str | None:
    return verify_supabase_token(authorization)


def require_user_id(authorization: str | None = Header(default=None)) -> str:
    user_id = verify_supabase_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user_id
