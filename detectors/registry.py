from detectors.base import Detector
from detectors.mobile_money.detector import MobileMoneyDetector
from detectors.ecommerce.detector import EcommerceDetector

REGISTRY: dict[str, Detector] = {}

def load_all() -> None:
    REGISTRY["ecommerce"] = EcommerceDetector()
    REGISTRY["mobile_money"] = MobileMoneyDetector()
    # later: REGISTRY["ecommerce"] = EcommerceDetector()