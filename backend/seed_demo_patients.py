
import asyncio
from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.config import get_settings
from app.core.security import Principal
from app.db.mongodb import connect_mongodb
from app.schemas.patient import PatientCreate
from app.services.patient_service import create_patient

TARGET_PATIENTS = 100

FIRST_NAMES = [
    "Ava", "Noah", "Mia", "Liam", "Isla", "Oliver", "Amelia", "Lucas",
    "Grace", "Ethan", "Chloe", "Arjun", "Priya", "Ravi", "Ananya",
    "Daniel", "Sofia", "Aiden", "Meera", "Samuel", "Zara", "Leo",
    "Nina", "Ishaan", "Ella", "Ryan", "Kavya", "Mason", "Diya", "Adam",
]
LAST_NAMES = [
    "Morgan", "Taylor", "Wilson", "Brown", "Patel", "Sharma", "Reddy",
    "Chen", "Martin", "Thomas", "Clarke", "Singh", "Rao", "Walker",
    "Davis", "Young", "Hall", "Lewis", "King", "Scott",
]


async def main():
    settings = get_settings()
    client = None

    try:
        client, database = await connect_mongodb(
            settings.mongodb_uri,
            settings.mongodb_database,
        )

        existing = await database.patients.count_documents({})
        print(f"Current patients: {existing}")

        if existing >= TARGET_PATIENTS:
            print("Target already reached. No records added.")
            return

        principal = Principal(subject="demo_seed", role="administrator")
        needed = TARGET_PATIENTS - existing
        created = 0

        for serial in range(existing + 1, TARGET_PATIENTS + 1):
            first = FIRST_NAMES[(serial - 1) % len(FIRST_NAMES)]
            last = LAST_NAMES[((serial - 1) // len(FIRST_NAMES)) % len(LAST_NAMES)]

            payload = PatientCreate(
                name=f"{first} {last} Demo{serial}",
                date_of_birth=date(1980 + serial % 25, serial % 12 + 1, serial % 27 + 1),
                gender="Other",
                phone=f"90000{serial:05d}",
                email=f"demo.patient.{serial}@example.com",
                address="Synthetic demo address",
                emergency_contact="Synthetic demo contact",
                allergies=[],
                conditions=[],
                medications=[],
                medical_history="Synthetic data for demonstration only.",
            )

            await create_patient(database, payload, principal)
            created += 1
            print(f"Created {created}/{needed}")

        patients_total = await database.patients.count_documents({})
        visits_total = await database.visits.count_documents({})

        print("\nCompleted.")
        print(f"Patients: {patients_total}")
        print(f"Visits: {visits_total}")

    finally:
        if client is not None:
            await client.close()


if __name__ == "__main__":
    asyncio.run(main())
