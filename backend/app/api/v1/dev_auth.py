
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.security import create_access_token

router = APIRouter(tags=["Development Authentication"])


class DevLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/dev-auth/token")
async def create_dev_token(payload: DevLoginRequest):
    settings = get_settings()

    if settings.app_env != "development":
        raise HTTPException(status_code=404, detail="Not found")

    expected_username = os.getenv("DEV_AUTH_USERNAME", "")
    expected_password = os.getenv("DEV_AUTH_PASSWORD", "")

    if (
        not expected_username
        or not expected_password
        or payload.username != expected_username
        or payload.password != expected_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid development credentials",
        )

    token = create_access_token(
        subject="local-admin",
        role="administrator",
        settings=settings,
        expires_in_seconds=3600,
    )

    return {"access_token": token, "token_type": "bearer"}
