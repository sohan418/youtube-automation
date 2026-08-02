from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.storage import storage_service

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_ROOTS = (
    storage_service.root,
    storage_service.exports_root,
    storage_service.assets_root,
    storage_service.templates_root,
)


@router.get("/{path:path}")
def serve_media(path: str):
    workspace = storage_service.root.parent.resolve()
    file_path = (workspace / path).resolve()

    if not any(str(file_path).startswith(str(root.resolve())) for root in ALLOWED_ROOTS):
        raise HTTPException(status_code=404, detail="Not found")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(file_path)
