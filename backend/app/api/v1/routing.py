from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.security import Principal, current_principal, require_roles
from app.db.mongodb import get_database
from app.schemas.routing import RoutingCreate
from app.services.routing_service import create_care_route, get_care_route

router = APIRouter(tags=["Care Routing"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/visits/{visit_id}/routing", status_code=201)
async def route_create(
    visit_id: str,
    payload: RoutingCreate,
    database: Database,
    principal: Annotated[Principal, Depends(require_roles("triage_staff", "clinician", "administrator"))],
):
    return await create_care_route(database, visit_id, payload, principal)


@router.get("/visits/{visit_id}/routing")
async def route_get(visit_id: str, database: Database, _: Principal = Depends(current_principal)):
    return await get_care_route(database, visit_id)
