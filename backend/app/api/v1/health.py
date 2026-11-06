import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import PyMongoError

from app.core.security import current_principal
from app.db.mongodb import get_database

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/ready")
async def readiness(database: Annotated[Any, Depends(get_database)], _: Any = Depends(current_principal)):
    try:
        await database.command("ping")
    except PyMongoError as exc:
        logging.getLogger("vynelixai.db").error("Readiness database ping failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Database is not ready.") from exc
    return {"status": "ready"}
