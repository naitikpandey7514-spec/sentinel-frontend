from dataclasses import dataclass
from datetime import datetime


@dataclass
class DetectionResult:
    object_type: str
    confidence: float

    x1: int
    y1: int
    x2: int
    y2: int

    tracking_id: int | None = None
    timestamp: datetime | None = None