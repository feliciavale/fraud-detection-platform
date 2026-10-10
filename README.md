# Fraud Detection Platform

![CI](https://github.com/feliciavale/fraud-detection-platform/actions/workflows/ci.yml/badge.svg)

A multi-type fraud detection platform. Each fraud type has its own dataset, features and model, loaded through a common detector interface and served by one API. A transaction goes in; a fraud probability, an approve/review decision and the top reasons come out.

## Status

| Module | Status |
|---|---|
| Mobile money fraud (PaySim) | Done: model, API, tests, CI |
| E-commerce fraud (IEEE-CIS) | Planned |
| Web frontend (Next.js) | Planned |
| Docker Compose, PostgreSQL, deployment | Planned |

## Mobile money detector

**Data:** [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) (Kaggle, CC-BY-SA-4.0): 6,362,620 simulated mobile money transactions, 8,213 frauds (0.129%). The dataset is not included in this repo.

**What the data showed**
- Fraud only occurs in TRANSFER (4,097) and CASH_OUT (4,116). Other types have none, so the detector approves them without running the model.
- 97.6% of frauds empty the sender's account.
- When the receiver's balance stays at 0 after receiving money, about 25% of transactions are fraud (about 0.15% otherwise).

**Method**
- Time-based split on the `step` column: train steps 1-520, validation 521-630, test 631 and later. The model is trained on the past and tested on the future.
- Metrics: PR-AUC, recall at 1% false-positive rate, confusion matrix. Accuracy is not used, because always predicting "not fraud" already scores 99.87%.
- Model: XGBoost, with class weighting for imbalance.
- Explanations: SHAP values, returned by the API as the top 3 reasons.

**Data leakage check.** The first XGBoost scored a perfect 1.0000 using fields recorded after the transaction (`errorOrig`, `emptied`, `newbalanceOrig`). A live system would not have them at approval time, so they were removed. `drainRatio` (amount divided by the sender's balance before) expresses the same "drains the whole account" pattern using only pre-transaction information. The `hour` feature was also dropped because it looked like a simulator artifact (PR-AUC changed from 0.9962 to 0.9940).

**Results** (test set: 37,991 transactions, 1,264 frauds)

| Model | PR-AUC | Recall @ 1% FPR | Caught | False alarms | Missed |
|---|---|---|---|---|---|
| Logistic regression (baseline) | 0.9395 | 0.9106 | 1,213 | 1,106 | 51 |
| XGBoost, post-transaction fields (leaky, not deployable) | 1.0000 | 1.0000 | 1,263 | 1 | 1 |
| XGBoost, pre-transaction, with `hour` | 0.9962 | 1.0000 | 1,263 | 71 | 1 |
| **XGBoost, pre-transaction, no `hour` (final)** | **0.9940** | **0.9992** | **1,263** | **72** | **1** |

The final model catches 1,263 of 1,264 frauds, with 72 false alarms among 36,727 normal transactions (about 0.2%). Compared with the baseline, false alarms drop about 15 times.

**Limitations**
- PaySim is synthetic and its fraud follows a simple script, so these scores will not transfer to real data.
- The test set is 3.3% fraud (train is about 0.2%), far above the overall rate. At a realistic rate, the same false-alarm rate gives a precision of roughly 60%, not the 94.6% seen on this test set (rough estimate).
- The cost values used to check thresholds (100 per missed fraud, 5 per false alarm) are assumptions.
- Almost every sender appears once, so account-history features were not possible.
- The model was trained in `notebooks/01_paysim_eda.ipynb`. A reusable training script is still to do.

## API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check |
| `GET /types` | Available fraud types |
| `GET /schema/{type}` | Input fields for that type (used to build forms) |
| `POST /score/{type}` | Score one record |

Example request to `POST /score/mobile_money`:

```json
{"type": "TRANSFER", "amount": 696575.46, "oldbalanceOrg": 696575.46, "oldbalanceDest": 0}
```

Response (shortened): `fraud_probability` 0.9999, `decision` "review", and `top_reasons` led by `drainRatio`.

## Project structure

```
detectors/        Detector interface, registry, one folder per fraud type
api/              FastAPI app
models/           Saved model and metadata files
notebooks/        EDA and model development
tests/            pytest tests
.github/workflows CI
```

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn api.main:app --reload     # then open http://127.0.0.1:8000/docs
pytest -v
```

To retrain or explore, download PaySim into `data/paysim/` (`kaggle datasets download -d ealaxi/paysim1 -p data/paysim --unzip`) and open the notebook.

## Roadmap

1. E-commerce detector on IEEE-CIS (messy data, about 3.5% fraud, many missing values).
2. Next.js frontend with a fraud type selector and forms generated from `/schema/{type}`.
3. PostgreSQL storage for scores and analyst decisions, Docker Compose, deployment.
4. Training scripts and experiment tracking.
