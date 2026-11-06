from typing import Any

from pymongo import ReturnDocument


async def generate_patient_id(database: Any) -> str:
    counter = await database.counters.find_one_and_update(
        {"_id": "hospital_patient_id"},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"VYX-P-{counter['sequence'] + 100000:06d}"
