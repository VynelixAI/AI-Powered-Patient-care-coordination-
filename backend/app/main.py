import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from app.api.router import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.db.indexes import create_indexes
from app.db.mongodb import connect_mongodb

configure_logging()
logger = logging.getLogger("vynelixai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    try:
        settings.validate_security_configuration()
    except ValueError as exc:
        raise RuntimeError(f"Invalid security configuration: {exc}") from exc
    if settings.app_env == "test":
        app.state.database = None
        yield
        return
    client = None
    try:
        client, database = await connect_mongodb(settings.mongodb_uri, settings.mongodb_database)
        await create_indexes(database)
        app.state.mongo_client = client
        app.state.database = database
        logger.info("MongoDB connection and indexes are ready.")
        yield
    except (PyMongoError, OSError) as exc:
        logger.exception("MongoDB startup failed.")
        raise RuntimeError("MongoDB is unavailable; verify MONGODB_URI and ensure MongoDB is running.") from exc
    finally:
        if client is not None:
            await client.close()
            app.state.database = None


settings = get_settings()
app = FastAPI(
    title="VynelixAI Health API",
    description="Authenticated prototype API for synthetic healthcare workflow data. Not a clinical system.",
    version="1.0.0",
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
    openapi_url="/openapi.json" if settings.app_env == "development" else None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)
register_exception_handlers(app)
app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
