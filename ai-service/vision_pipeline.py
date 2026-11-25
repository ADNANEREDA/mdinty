import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from config import settings


@dataclass
class NearbyIncidentCandidate:
    incident_id: int
    latitude: float
    longitude: float
    embedding: List[float] = field(default_factory=list)
    hours_ago: float = 0.0
    duplicate_count: int = 1


@dataclass
class VisionAnalysisResult:
    ai_status: str                 # VALIDATED | SPAM | DOUBLON | A_VERIFIER
    confidence: float
    is_valid: bool
    category_consistent: bool
    predicted_category: str
    severity: str                  # FAIBLE | MOYENNE | URGENTE
    priority_score: int            # Score calculé selon gravité + nombre de doublons
    is_duplicate: bool
    duplicate_of_id: Optional[int]
    merged_report_count: int       # Nombre total de signalements regroupés (1 si nouveau)
    reason: str
    embedding: List[float]


CATEGORY_PROMPTS: Dict[str, List[str]] = {
    "VOIRIE": [
        "a photo of a pothole, cracked asphalt, or damaged road in a city",
        "a photo of a broken sidewalk or collapsed street pavement",
    ],
    "ECLAIRAGE": [
        "a photo of a broken street light or unlit street lamp at night",
        "a photo of a damaged or fallen public lighting pole",
    ],
    "PROPRETE": [
        "a photo of uncollected garbage bags or trash pile on a city street",
        "a photo of an overflowing public trash bin or illegal waste dump",
    ],
    "EAU_ASSAINISSEMENT": [
        "a photo of a water leak, flooded street, or broken water pipe",
        "a photo of an overflowing sewer drain or stagnant water on a road",
    ],
    "ESPACES_VERTS": [
        "a photo of a fallen tree branch or overgrown neglected public park",
        "a photo of damaged urban greenery or broken park bench",
    ],
}

SPAM_PROMPTS: List[str] = [
    "a selfie or close-up portrait of a person",
    "a photo of food, a pet, indoor room, or a meme",
    "a screenshot, company logo, or random object unrelated to city streets",
]

SEVERITY_PROMPTS: Dict[str, List[str]] = {
    "URGENTE": [
        "a photo of a severe road collapse, deep dangerous pothole, major street flooding, or fallen electrical pole",
        "a critical urban hazard blocking traffic or threatening public safety",
    ],
    "MOYENNE": [
        "a photo of a moderate street crack, broken street lamp, or uncollected garbage pile",
        "a clear urban maintenance problem requiring municipal intervention",
    ],
    "FAIBLE": [
        "a photo of minor surface wear, small litter, faded paint, or minor park bench damage",
        "a low-urgency cosmetic urban maintenance issue",
    ],
}


class IncidentVisionPipeline:
    def __init__(self) -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = CLIPProcessor.from_pretrained(settings.clip_model_name)
        self.model = CLIPModel.from_pretrained(settings.clip_model_name).to(self.device)
        self.model.eval()

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            raise RuntimeError(f"Impossible de charger le classificateur Haar : {cascade_path}")

    @staticmethod
    def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        earth_radius = 6371000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lambda = math.radians(lon2 - lon1)
        a = (
            math.sin(d_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
        )
        return earth_radius * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    @staticmethod
    def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        a = np.asarray(vec_a, dtype=np.float32)
        b = np.asarray(vec_b, dtype=np.float32)
        norm_a, norm_b = float(np.linalg.norm(a)), float(np.linalg.norm(b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    @staticmethod
    def compute_priority_score(severity: str, merged_count: int = 1) -> int:
        base = {"URGENTE": 10, "MOYENNE": 5, "FAIBLE": 2}.get(severity, 5)
        extra_citizens = max(0, merged_count - 1)
        return base + (extra_citizens * 3)

    def _check_image_quality(self, image: Image.Image) -> Optional[str]:
        width, height = image.size
        if width < 120 or height < 120:
            return f"Résolution d'image trop faible ({width}x{height}px)."

        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 22.0:
            return f"Image trop sombre (luminosité : {mean_brightness:.1f})."

        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if laplacian_var < 25.0:
            return f"Image trop floue (netteté : {laplacian_var:.1f})."

        return None

    def _has_prominent_face(self, image: Image.Image) -> bool:
        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        img_area = float(gray.shape[0] * gray.shape[1])
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.15, minNeighbors=5, minSize=(60, 60)
        )
        return any((float(w * h) / img_area) >= 0.12 for (_, _, w, h) in faces) if img_area > 0 else False

    def _extract_tensor(self, raw_output: object, projection_attr: str) -> torch.Tensor:
        if isinstance(raw_output, torch.Tensor):
            tensor = raw_output
        elif hasattr(raw_output, "image_embeds") and raw_output.image_embeds is not None:
            tensor = raw_output.image_embeds
        elif hasattr(raw_output, "text_embeds") and raw_output.text_embeds is not None:
            tensor = raw_output.text_embeds
        elif hasattr(raw_output, "pooler_output") and raw_output.pooler_output is not None:
            tensor = raw_output.pooler_output
            projection = getattr(self.model, projection_attr, None)
            if projection is not None and tensor.shape[-1] == projection.in_features:
                tensor = projection(tensor)
        else:
            raise RuntimeError(f"Format de sortie CLIP inattendu : {type(raw_output)}")

        norm = tensor.norm(p=2, dim=-1, keepdim=True)
        return tensor / norm.clamp(min=1e-12)

    def _compute_image_embedding(self, image: Image.Image) -> List[float]:
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            raw_features = self.model.get_image_features(**inputs)
            norm_features = self._extract_tensor(raw_features, "visual_projection")
        return norm_features[0].cpu().numpy().tolist()

    def _evaluate_category_and_spam(
        self, image: Image.Image, declared_category: str
    ) -> tuple[bool, str, float, float, float]:
        """
        Retourne : (is_spam, predicted_category, best_cat_score, spam_score, declared_score)
        """
        prompts: List[str] = []
        owners: List[str] = []

        for cat_name, cat_prompts in CATEGORY_PROMPTS.items():
            for p in cat_prompts:
                prompts.append(p)
                owners.append(cat_name)

        for p in SPAM_PROMPTS:
            prompts.append(p)
            owners.append("SPAM")

        inputs = self.processor(text=prompts, images=image, return_tensors="pt", padding=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            probs = self.model(**inputs).logits_per_image.softmax(dim=-1)[0].cpu().numpy()

        scores_by_label: Dict[str, float] = {k: 0.0 for k in list(CATEGORY_PROMPTS.keys()) + ["SPAM"]}
        for owner, prob in zip(owners, probs):
            scores_by_label[owner] = max(scores_by_label[owner], float(prob))

        spam_score = scores_by_label["SPAM"]
        cat_scores = {k: v for k, v in scores_by_label.items() if k != "SPAM"}
        predicted_category = max(cat_scores, key=cat_scores.get)
        best_cat_score = cat_scores[predicted_category]

        normalized_declared = (declared_category or "").strip().upper()
        declared_score = cat_scores.get(normalized_declared, best_cat_score)

        is_spam = spam_score > best_cat_score and spam_score >= 0.42
        return is_spam, predicted_category, best_cat_score, spam_score, declared_score

    def _estimate_severity(self, image: Image.Image) -> str:
        prompts: List[str] = []
        owners: List[str] = []
        for sev_label, sev_prompts in SEVERITY_PROMPTS.items():
            for p in sev_prompts:
                prompts.append(p)
                owners.append(sev_label)

        inputs = self.processor(text=prompts, images=image, return_tensors="pt", padding=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            probs = self.model(**inputs).logits_per_image.softmax(dim=-1)[0].cpu().numpy()

        sev_scores = {"URGENTE": 0.0, "MOYENNE": 0.0, "FAIBLE": 0.0}
        for owner, prob in zip(owners, probs):
            sev_scores[owner] = max(sev_scores[owner], float(prob))

        return max(sev_scores, key=sev_scores.get)

    def _find_duplicate(
        self,
        embedding: List[float],
        latitude: Optional[float],
        longitude: Optional[float],
        candidates: List[NearbyIncidentCandidate],
    ) -> Optional[tuple[NearbyIncidentCandidate, float, float]]:
        if latitude is None or longitude is None or not candidates:
            return None

        best_match: Optional[tuple[NearbyIncidentCandidate, float, float]] = None
        for cand in candidates:
            if not cand.embedding:
                continue
            dist_m = self._haversine_meters(latitude, longitude, cand.latitude, cand.longitude)
            if dist_m <= 60.0 and cand.hours_ago <= 72.0:
                sim = self._cosine_similarity(embedding, cand.embedding)
                if sim >= 0.88:
                    if best_match is None or sim > best_match[1]:
                        best_match = (cand, sim, dist_m)
        return best_match

    def analyze(
        self,
        image: Image.Image,
        category: str = "",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        nearby_incidents: Optional[List[NearbyIncidentCandidate]] = None,
    ) -> VisionAnalysisResult:
        # 1. Qualité & Anti-selfie
        quality_issue = self._check_image_quality(image)
        if quality_issue is not None:
            return VisionAnalysisResult(
                ai_status="SPAM",
                confidence=0.92,
                is_valid=False,
                category_consistent=False,
                predicted_category="INCONNU",
                severity="FAIBLE",
                priority_score=0,
                is_duplicate=False,
                duplicate_of_id=None,
                merged_report_count=1,
                reason=quality_issue,
                embedding=[],
            )

        if self._has_prominent_face(image):
            return VisionAnalysisResult(
                ai_status="SPAM",
                confidence=0.94,
                is_valid=False,
                category_consistent=False,
                predicted_category="INCONNU",
                severity="FAIBLE",
                priority_score=0,
                is_duplicate=False,
                duplicate_of_id=None,
                merged_report_count=1,
                reason="Selfie ou visage proéminent détecté sur la photo.",
                embedding=[],
            )

        # 2. Embedding + Détection de doublon (< 60m & similarité cosinus >= 0.88)
        embedding = self._compute_image_embedding(image)
        dup_match = self._find_duplicate(embedding, latitude, longitude, nearby_incidents or [])
        if dup_match is not None:
            parent_cand, sim, dist_m = dup_match
            new_merged_count = max(1, parent_cand.duplicate_count) + 1
            severity = self._estimate_severity(image)
            boosted_priority = self.compute_priority_score(severity, new_merged_count)
            return VisionAnalysisResult(
                ai_status="DOUBLON",
                confidence=round(min(0.99, sim), 3),
                is_valid=False,
                category_consistent=True,
                predicted_category=(category or "").strip().upper() or "VOIRIE",
                severity=severity,
                priority_score=boosted_priority,
                is_duplicate=True,
                duplicate_of_id=parent_cand.incident_id,
                merged_report_count=new_merged_count,
                reason=(
                    f"Doublon détecté à {dist_m:.1f}m de l'incident #{parent_cand.incident_id} "
                    f"(similarité : {sim:.2f}). {new_merged_count} citoyens ont signalé ce problème."
                ),
                embedding=embedding,
            )

        # 3. Vérification de cohérence catégorie/photo & estimation de gravité
        is_spam, predicted_cat, best_cat_score, spam_score, declared_score = (
            self._evaluate_category_and_spam(image, category)
        )
        if is_spam:
            return VisionAnalysisResult(
                ai_status="SPAM",
                confidence=round(min(0.99, spam_score), 3),
                is_valid=False,
                category_consistent=False,
                predicted_category="SPAM",
                severity="FAIBLE",
                priority_score=0,
                is_duplicate=False,
                duplicate_of_id=None,
                merged_report_count=1,
                reason=f"Photo hors sujet détectée (score anti-spam : {spam_score:.2f}).",
                embedding=embedding,
            )

        severity = self._estimate_severity(image)
        priority_score = self.compute_priority_score(severity, 1)

        normalized_declared = (category or "").strip().upper()
        category_consistent = (
            not normalized_declared
            or normalized_declared == predicted_cat
            or declared_score >= 0.25
        )

        if best_cat_score >= 0.30 and category_consistent:
            return VisionAnalysisResult(
                ai_status="VALIDATED",
                confidence=round(min(0.99, best_cat_score), 3),
                is_valid=True,
                category_consistent=True,
                predicted_category=predicted_cat,
                severity=severity,
                priority_score=priority_score,
                is_duplicate=False,
                duplicate_of_id=None,
                merged_report_count=1,
                reason=(
                    f"Incident confirmé ({predicted_cat}, confiance {best_cat_score:.2f}) • "
                    f"Urgence {severity} (priorité {priority_score})."
                ),
                embedding=embedding,
            )

        mismatch_note = (
            f"Catégorie déclarée ({normalized_declared}) différente de la détection visuelle ({predicted_cat})."
            if not category_consistent
            else f"Confiance modérée ({best_cat_score:.2f})."
        )
        return VisionAnalysisResult(
            ai_status="A_VERIFIER",
            confidence=round(min(0.95, max(best_cat_score, 0.35)), 3),
            is_valid=False,
            category_consistent=category_consistent,
            predicted_category=predicted_cat,
            severity=severity,
            priority_score=priority_score,
            is_duplicate=False,
            duplicate_of_id=None,
            merged_report_count=1,
            reason=f"{mismatch_note} Urgence estimée : {severity} — revue manuelle recommandée.",
            embedding=embedding,
        )