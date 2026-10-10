from abc import ABC, abstractmethod

class Detector(ABC):
    name: str

    @abstractmethod
    def schema(self) -> dict:
        """Input fields the frontend uses to build its form."""

    @abstractmethod
    def predict(self, record: dict) -> dict:
        """Return {fraud_probability, decision, top_reasons}."""