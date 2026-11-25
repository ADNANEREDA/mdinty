from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from minio_client import MinioStorageClient
from vision_pipeline import IncidentVisionPipeline, NearbyIncidentCandidate


class NearbyIncidentRequest(BaseModel):
    incident_id: int
    latitude: float
    longitude: float
    embedding: List[float] = Field(default_factory=list)
    hours_ago: float = 0.0
    duplicate_count: int = 1


class AnalyzeIncidentRequest(BaseModel):
    incident_id: int
    photo_url: str
    category: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    nearby_incidents: List[NearbyIncidentRequest] = Field(default_factory=list)


class AnalyzeIncidentResponse(BaseModel):
    incident_id: int
    ai_status: str
    confidence: float
    is_valid: bool
    category_consistent: bool
    predicted_category: str
    severity: str
    priority_score: int
    is_duplicate: bool
    duplicate_of_id: Optional[int] = None
    merged_report_count: int
    reason: str
    embedding: List[float]


storage_client: Optional[MinioStorageClient] = None
vision_pipeline: Optional[IncidentVisionPipeline] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global storage_client, vision_pipeline
    storage_client = MinioStorageClient()
    vision_pipeline = IncidentVisionPipeline()
    yield


app = FastAPI(
    title="Mdinty AI Service",
    description="Modération silencieuse : cohérence catégorie, gravité, fusion des doublons et score de priorité",
    lifespan=lifespan,
)


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "pipeline_ready": storage_client is not None and vision_pipeline is not None,
    }


@app.post("/api/v1/analyze-incident", response_model=AnalyzeIncidentResponse)
def analyze_incident(payload: AnalyzeIncidentRequest) -> AnalyzeIncidentResponse:
    if storage_client is None or vision_pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline IA non initialisé.")

    try:
        image = storage_client.download_image(payload.photo_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    candidates = [
        NearbyIncidentCandidate(
            incident_id=item.incident_id,
            latitude=item.latitude,
            longitude=item.longitude,
            embedding=item.embedding,
            hours_ago=item.hours_ago,
            duplicate_count=item.duplicate_count,
        )
        for item in payload.nearby_incidents
    ]

    result = vision_pipeline.analyze(
        image=image,
        category=payload.category,
        latitude=payload.latitude,
        longitude=payload.longitude,
        nearby_incidents=candidates,
    )

    return AnalyzeIncidentResponse(
        incident_id=payload.incident_id,
        ai_status=result.ai_status,
        confidence=result.confidence,
        is_valid=result.is_valid,
        category_consistent=result.category_consistent,
        predicted_category=result.predicted_category,
        severity=result.severity,
        priority_score=result.priority_score,
        is_duplicate=result.is_duplicate,
        duplicate_of_id=result.duplicate_of_id,
        merged_report_count=result.merged_report_count,
        reason=result.reason,
        embedding=result.embedding,
    )