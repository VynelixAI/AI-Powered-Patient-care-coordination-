from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

from app.core.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)
VALID_ROLES = {"triage_staff", "clinician", "specialist", "pharmacy", "administrator"}


@dataclass(frozen=True)
class Principal:
    subject: str
    role: str


def create_access_token(subject: str, role: str, settings: Settings, expires_in_seconds: int = 3600) -> str:
    if role not in VALID_ROLES:
        raise ValueError("Unsupported role")
    now = int(datetime.now(timezone.utc).timestamp())
    return jwt.encode(
        {"sub": subject, "role": role, "iss": settings.auth_jwt_issuer, "iat": now, "exp": now + expires_in_seconds},
        settings.auth_jwt_secret,
        algorithm="HS256",
    )


async def current_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Principal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer authentication is required.")
    try:
        settings.validate_security_configuration()
        claims = jwt.decode(
            credentials.credentials,
            settings.auth_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.auth_jwt_issuer,
            options={"require": ["sub", "role", "exp", "iss"]},
        )
    except (InvalidTokenError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.") from exc
    role = claims.get("role")
    subject = claims.get("sub")
    if role not in VALID_ROLES or not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token claims.")
    return Principal(subject=subject, role=role)


def require_roles(*roles: str):
    async def role_dependency(
        principal: Annotated[Principal, Depends(current_principal)],
    ) -> Principal:
        if principal.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your role cannot perform this operation.")
        return principal

    return role_dependency
