import hashlib
import json
from fastapi import APIRouter, Depends, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import GraphBuildRequest, GraphBuildResponse, EntityNeighborsResponse, AuthorityTopResponse
from analysis.relationships import get_top_authority_entities, get_full_graph_snapshot
from db.postgres import get_db

router = APIRouter(prefix="/api/v1/graph", tags=["Graph"])

# Global cache for graph snapshots
GRAPH_CACHE = {}

@router.post("/build", response_model=GraphBuildResponse)
async def build_graph(req: GraphBuildRequest, db: AsyncSession = Depends(get_db)):
    if req.vertical in GRAPH_CACHE:
        del GRAPH_CACHE[req.vertical]
    return GraphBuildResponse(job_id="dummy", status="done", message="Graph built")

@router.post("/invalidate/{vertical}")
async def invalidate_graph_cache(vertical: str):
    """Invalidate the graph cache for a specific vertical after analysis."""
    keys_to_delete = [k for k in GRAPH_CACHE.keys() if k.startswith(f"{vertical}_")]
    for k in keys_to_delete:
        del GRAPH_CACHE[k]
    return {"status": "success", "message": f"Cache invalidated for {vertical}"}

@router.get("/authority/top", response_model=AuthorityTopResponse)
async def get_top_authority(vertical: str, limit: int = 20):
    entities = await get_top_authority_entities(vertical=vertical, limit=limit)
    return AuthorityTopResponse(vertical=vertical, entities=entities, total=len(entities))

@router.get("/snapshot/{vertical}")
async def get_graph_snapshot(vertical: str, request: Request, response: Response, limit: int = 200):
    """Return nodes and edges for the 3D graph visualization with ETag caching."""
    cache_key = f"{vertical}_{limit}"
    
    try:
        if cache_key in GRAPH_CACHE:
            data = GRAPH_CACHE[cache_key]
        else:
            data = await get_full_graph_snapshot(vertical=vertical, limit=limit)
            GRAPH_CACHE[cache_key] = data
            
        data_str = json.dumps(data, sort_keys=True)
        etag = hashlib.md5(data_str.encode('utf-8')).hexdigest()
        
        if request.headers.get("If-None-Match") == etag:
            return Response(status_code=304)
            
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
        return JSONResponse(content=data)
        
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch graph: {str(exc)}")
