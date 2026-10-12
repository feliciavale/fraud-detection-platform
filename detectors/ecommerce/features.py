import numpy as np
import pandas as pd

DERIVED = ["amt_cents", "email_match"]


def add_form_features(d: pd.DataFrame) -> pd.DataFrame:
    """Same derived features as the training notebook."""
    d = d.copy()
    d["amt_cents"] = (d["TransactionAmt"] * 100).round() % 100
    d["email_match"] = ((d["P_emaildomain"] == d["R_emaildomain"]) & (d["P_emaildomain"] != -1)).astype(int)
    return d


def build_row(record: dict, meta: dict) -> pd.DataFrame:
    """Turn one user record into the exact feature row the model was trained on."""
    cats = meta["categorical"]
    base = [f for f in meta["features"] if f not in DERIVED]
    row = {}
    for f in base:
        v = record.get(f)
        if f in cats:
            row[f] = cats[f].get(v, -1) if v is not None else -1    # unseen or missing -> -1, as in training
        else:
            row[f] = np.nan if v is None else v
    df = pd.DataFrame([row])
    for f in base:
        if f not in cats:
            df[f] = df[f].astype("float32")
    return add_form_features(df)[meta["features"]]