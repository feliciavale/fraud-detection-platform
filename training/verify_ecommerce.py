import json

import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score

from detectors.ecommerce.detector import EcommerceDetector
from detectors.ecommerce.features import DERIVED, add_form_features

meta = json.load(open("models/ecommerce_meta.json"))
cats, feats = meta["categorical"], meta["features"]
base = [f for f in feats if f not in DERIVED]

cols = ["TransactionID", "TransactionDT", "isFraud"] + [f for f in base if f != "DeviceType"]
idn = pd.read_csv("data/ieee/train_identity.csv", usecols=["TransactionID", "DeviceType"])
df = pd.read_csv("data/ieee/train_transaction.csv", usecols=cols).merge(idn, on="TransactionID", how="left")
df = df.sort_values("TransactionDT").reset_index(drop=True)
test_idx = df.index[int(len(df) * 0.85):]

# 1) reproduce the reported test PR-AUC from the saved artifacts
test = df.loc[test_idx].copy()
for c, m in cats.items():
    test[c] = test[c].map(m).fillna(-1).astype(int)
for c in base:
    if c not in cats:
        test[c] = test[c].astype("float32")
test = add_form_features(test)
model = xgb.XGBClassifier()
model.load_model("models/ecommerce_xgb.ubj")
p = pd.Series(model.predict_proba(test[feats])[:, 1], index=test_idx)
print("Test PR-AUC from saved model:", round(average_precision_score(test["isFraud"], p), 4), "(notebook reported 0.2187)")

# 2) API path vs saved model on 100 real test rows
det = EcommerceDetector()
diffs = []
for i, row in df.loc[test_idx].sample(100, random_state=0).iterrows():
    rec = {f: (row[f].item() if hasattr(row[f], "item") else row[f]) for f in base if pd.notna(row[f])}
    diffs.append(abs(det.predict(rec)["risk_score"] - p[i]))
print("Max |API score - saved model score| over 100 rows:", round(max(diffs), 4))

# 3) most common values, usable as form defaults
for f in base:
    if f != "TransactionAmt":
        print(f, "->", df[f].mode().iloc[0])