import json
from pathlib import Path

import pandas as pd
import shap
import xgboost as xgb

from detectors.base import Detector
from detectors.mobile_money.features import add_features

MODEL_DIR = Path(__file__).resolve().parents[2] / "models"
TYPES = ["PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]
RISKY_TYPES = {"TRANSFER", "CASH_OUT"}   # EDA: all fraud is in these two
REQUIRED = ["type", "amount", "oldbalanceOrg", "oldbalanceDest"]


class MobileMoneyDetector(Detector):
    name = "mobile_money"

    def __init__(self):
        meta = json.load(open(MODEL_DIR / "mobile_money_meta.json"))
        self.features = meta["features"]
        self.threshold = meta["threshold"]
        self.model = xgb.XGBClassifier()
        self.model.load_model(MODEL_DIR / "mobile_money_xgb.json")
        self.explainer = shap.TreeExplainer(self.model)

    def schema(self) -> dict:
        return {
            "fraud_type": self.name,
            "fields": [
                {"name": "type", "kind": "select", "options": TYPES},
                {"name": "amount", "kind": "number"},
                {"name": "oldbalanceOrg", "kind": "number", "label": "Sender balance before"},
                {"name": "oldbalanceDest", "kind": "number", "label": "Receiver balance before"},
            ],
        }

    def predict(self, record: dict) -> dict:
        missing = [f for f in REQUIRED if f not in record]
        if missing:
            raise ValueError(f"Missing fields: {missing}")
        if record["type"] not in TYPES:
            raise ValueError(f"type must be one of {TYPES}")

        if record["type"] not in RISKY_TYPES:
            return {"fraud_probability": 0.0, "decision": "approve",
                    "top_reasons": [{"feature": "type", "note": "No fraud seen in this type in training data"}]}

        X = add_features(pd.DataFrame([record]))[self.features]
        prob = float(self.model.predict_proba(X)[0, 1])
        shap_values = self.explainer(X)[0].values
        ranked = sorted(zip(self.features, shap_values, X.iloc[0]), key=lambda t: -abs(t[1]))[:3]
        return {
            "fraud_probability": round(prob, 4),
            "decision": "review" if prob >= self.threshold else "approve",
            "top_reasons": [{"feature": f, "value": float(v), "impact": round(float(s), 3)} for f, s, v in ranked],
        }