import json
from pathlib import Path

import numpy as np
import shap
import xgboost as xgb

from detectors.base import Detector
from detectors.ecommerce.features import DERIVED, build_row

MODEL_DIR = Path(__file__).resolve().parents[2] / "models"

NUMBER_FIELDS = {
    "TransactionAmt": "Transaction amount",
    "card1": "Card ID 1", "card2": "Card ID 2", "card3": "Card ID 3", "card5": "Card ID 5",
    "addr1": "Billing region", "addr2": "Billing country",
    "dist1": "Distance",
}
SELECT_FIELDS = {
    "ProductCD": "Product code", "card4": "Card network", "card6": "Card type",
    "P_emaildomain": "Payer email domain", "R_emaildomain": "Recipient email domain",
    "DeviceType": "Device type",
}


class EcommerceDetector(Detector):
    name = "ecommerce"

    def __init__(self):
        self.meta = json.load(open(MODEL_DIR / "ecommerce_meta.json"))
        self.features = self.meta["features"]
        self.threshold = self.meta["threshold"]
        self.required = self.meta["required"]
        self.model = xgb.XGBClassifier()
        self.model.load_model(MODEL_DIR / "ecommerce_xgb.ubj")
        self.explainer = shap.TreeExplainer(self.model)
        self.labels = {f: {i: v for v, i in m.items()} for f, m in self.meta["categorical"].items()}

    def schema(self) -> dict:
        fields = []
        for f in self.features:
            if f in DERIVED:
                continue
            req = f in self.required
            if f in SELECT_FIELDS:
                fields.append({"name": f, "kind": "select", "label": SELECT_FIELDS[f], "required": req,
                               "options": sorted(self.meta["categorical"][f])})
            else:
                fields.append({"name": f, "kind": "number", "label": NUMBER_FIELDS.get(f, f), "required": req})
        return {"fraud_type": self.name, "fields": fields}

    def _validate(self, record: dict) -> dict:
        missing = [f for f in self.required if record.get(f) is None]
        if missing:
            raise ValueError(f"Missing fields: {missing}")
        clean = dict(record)
        for f in NUMBER_FIELDS:
            if clean.get(f) is not None:
                try:
                    clean[f] = float(clean[f])
                except (TypeError, ValueError):
                    raise ValueError(f"{f} must be a number")
        if clean["TransactionAmt"] <= 0:
            raise ValueError("TransactionAmt must be positive")
        if clean["ProductCD"] not in self.meta["categorical"]["ProductCD"]:
            raise ValueError(f"ProductCD must be one of {sorted(self.meta['categorical']['ProductCD'])}")
        return clean

    def _display(self, feature: str, value):
        if feature in self.labels:
            return self.labels[feature].get(int(value))      # None when the code is -1 (missing)
        if value is None or (isinstance(value, float) and np.isnan(value)):
            return None
        return float(value)

    def predict(self, record: dict) -> dict:
        X = build_row(self._validate(record), self.meta)
        score = float(self.model.predict_proba(X)[0, 1])
        shap_values = self.explainer(X)[0].values
        ranked = sorted(zip(self.features, shap_values, X.iloc[0]), key=lambda t: -abs(t[1]))[:3]
        return {
            "risk_score": round(score, 4),
            "decision": "review" if score >= self.threshold else "approve",
            "top_reasons": [{"feature": f, "value": self._display(f, v), "impact": round(float(s), 3),
                             "direction": "raises risk" if s > 0 else "lowers risk"} for f, s, v in ranked],
        }