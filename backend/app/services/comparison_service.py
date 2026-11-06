from typing import Any


def compare_current_and_historical_data(current: list[dict], historical: list[dict]) -> list[dict]:
    historical_by_type: dict[str, list[dict]] = {}
    for observation in historical:
        historical_by_type.setdefault(observation["measurement_type"], []).append(observation)

    comparisons = []
    for current_observation in sorted(current, key=lambda value: value["recorded_at"]):
        candidates = historical_by_type.get(current_observation["measurement_type"], [])
        compatible = [
            item for item in candidates
            if item.get("unit", "").strip().casefold() == current_observation.get("unit", "").strip().casefold()
            and item.get("verification_status") == "VERIFIED"
        ]
        current_verified = current_observation.get("verification_status") == "VERIFIED"
        previous = max(compatible, key=lambda item: item["recorded_at"]) if compatible and current_verified else None
        comparisons.append(
            {
                "measurement_type": current_observation["measurement_type"],
                "current": _observation_evidence(current_observation),
                "historical": _observation_evidence(previous) if previous else None,
                "change": _numeric_change(current_observation, previous) if previous else None,
                "comparison_status": "COMPARED" if previous else "NO_COMPATIBLE_VERIFIED_HISTORY",
            }
        )
    return comparisons


def _observation_evidence(observation: dict) -> dict:
    return {
        "id": observation["id"],
        "value": observation["value"],
        "unit": observation["unit"],
        "recorded_at": observation["recorded_at"],
        "verification_status": observation["verification_status"],
        "source_record_id": observation.get("source_record_id"),
    }


def _numeric_change(current: dict, previous: dict) -> dict | None:
    try:
        current_value = float(current["value"])
        previous_value = float(previous["value"])
    except (TypeError, ValueError):
        return None
    return {"absolute": current_value - previous_value, "unit": current["unit"]}


async def compare_observations(database: Any, patient_id: str, visit_id: str, current: list[dict] | None = None) -> list[dict]:
    if current is None:
        current = await database.health_observations.find(
            {"patient_id": patient_id, "visit_id": visit_id}
        ).to_list(length=500)
    historical = await database.health_observations.find(
        {"patient_id": patient_id, "visit_id": {"$ne": visit_id}}
    ).to_list(length=2000)
    return compare_current_and_historical_data(current, historical)
