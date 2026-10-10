from detectors.base import Detector
from detectors.mobile_money.detector import MobileMoneyDetector

REGISTRY: dict[str, Detector] = {}

def load_all() -> None:
    REGISTRY["mobile_money"] = MobileMoneyDetector()
    # later: REGISTRY["ecommerce"] = EcommerceDetector()