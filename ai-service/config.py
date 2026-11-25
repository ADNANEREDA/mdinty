import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "mdinty-incidents")
    minio_secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"

    clip_model_name: str = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
    blur_threshold: float = float(os.getenv("BLUR_THRESHOLD", "60.0"))
    face_max_area_ratio: float = float(os.getenv("FACE_MAX_AREA_RATIO", "0.35"))

    duplicate_radius_meters: float = float(os.getenv("DUPLICATE_RADIUS_METERS", "50.0"))
    duplicate_hours_window: int = int(os.getenv("DUPLICATE_HOURS_WINDOW", "48"))
    duplicate_similarity_threshold: float = float(os.getenv("DUPLICATE_SIMILARITY_THRESHOLD", "0.88"))

    validated_threshold: float = float(os.getenv("VALIDATED_THRESHOLD", "0.70"))
    verify_threshold: float = float(os.getenv("VERIFY_THRESHOLD", "0.40"))


settings = Settings()