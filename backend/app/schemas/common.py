from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Page(ApiModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int


class Timestamped(ApiModel):
    created_at: datetime
    updated_at: datetime | None = None
