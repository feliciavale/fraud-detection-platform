import pandas as pd

FEATURES = ["amount", "oldbalanceOrg", "oldbalanceDest", "drainRatio", "destOldZero", "isTransfer"]

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["drainRatio"] = df["amount"] / (df["oldbalanceOrg"] + 1)
    df["destOldZero"] = (df["oldbalanceDest"] == 0).astype(int)
    df["isTransfer"] = (df["type"] == "TRANSFER").astype(int)
    return df