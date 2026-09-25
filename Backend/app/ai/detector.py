from abc import ABC, abstractmethod
from typing import Any

from .types import DetectionResult


class Detector(ABC):

    @abstractmethod
    def detect(self, frame: Any) -> list[DetectionResult]:
        raise NotImplementedError