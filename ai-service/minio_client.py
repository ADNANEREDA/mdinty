from io import BytesIO
from urllib.parse import urlparse
from minio import Minio
from minio.error import S3Error
from PIL import Image, UnidentifiedImageError
from config import settings


class MinioStorageClient:
    def __init__(self) -> None:
        self.client = Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket = settings.minio_bucket

    def _extract_object_name(self, photo_ref: str) -> str:
        """Extrait le chemin d'objet dans le bucket à partir d'une clé ou d'une URL MinIO."""
        cleaned = photo_ref.strip()
        if cleaned.startswith("http://") or cleaned.startswith("https://"):
            parsed = urlparse(cleaned)
            path = parsed.path.lstrip("/")
            prefix = f"{self.bucket}/"
            if path.startswith(prefix):
                return path[len(prefix):]
            return path
        return cleaned.lstrip("/")

    def download_image(self, photo_ref: str) -> Image.Image:
        """Télécharge une image depuis MinIO et la retourne en objet PIL RGB."""
        object_name = self._extract_object_name(photo_ref)
        response = None
        try:
            response = self.client.get_object(self.bucket, object_name)
            data = response.read()
            image = Image.open(BytesIO(data))
            return image.convert("RGB")
        except S3Error as exc:
            raise RuntimeError(f"Erreur MinIO lors de la récupération de '{object_name}': {exc}") from exc
        except UnidentifiedImageError as exc:
            raise ValueError(f"Le fichier '{object_name}' dans MinIO n'est pas une image valide.") from exc
        finally:
            if response is not None:
                response.close()
                response.release_conn()