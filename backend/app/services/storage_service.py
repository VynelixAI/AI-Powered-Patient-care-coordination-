import asyncio
from pathlib import Path
from uuid import uuid4


class LocalStorage:
    def __init__(self, directory: Path):
        self.directory = directory.resolve()

    async def store(self, contents: bytes, extension: str) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        reference = f"{uuid4().hex}{extension}"
        await asyncio.to_thread((self.directory / reference).write_bytes, contents)
        return reference

    async def read(self, reference: str) -> Path:
        path = (self.directory / reference).resolve()
        if path.parent != self.directory or path.name != reference:
            raise ValueError("Invalid storage reference")
        if not await asyncio.to_thread(path.is_file):
            raise FileNotFoundError("Stored document was not found")
        return path
