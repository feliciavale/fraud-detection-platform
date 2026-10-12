# Fraud Detection Platform

![CI](https://github.com/feliciavale/fraud-detection-platform/actions/workflows/ci.yml/badge.svg)

A multi-type fraud detection platform. Each fraud type has its own dataset, features and model, loaded through a common detector interface and served by one API. A transaction goes in; a risk score, an approve/review decision and the top reasons come out.

## Status

| Module | Status |
|---|---|
| Mobile money fraud (PaySim) | Done: model, API, tests, CI |
| E-commerce fraud (IEEE-CIS) | Done: models, API plugin, tests |
| Web frontend (Next.js) | Planned |
| Docker Compose, PostgreSQL, deployment | Planned |

## Key ideas used in both modules

- **Time-based splits.** Models are trained on the past and tested on the future, never on a random shuffle.
- **Imbalance-aware metrics.** PR-AUC, recall at 1% false-positive rate and confusion matrices. Accuracy is not used, because a model that never flags fraud already scores 96-99%.
- **Leakage checks.** Features recorded after a transaction completes are excluded from deployable models.
- **Explanations.** SHAP values, returned by the API as the top reasons for each score.
- **Honest operating points.** Thresholds are chosen on validation data and reported on test data.
- **Scores are not probabilities.** Class weighting inflates model outputs, so a score of 0.54 does not mean a 54% chance of fraud. Scores rank transactions correctly; calibration is future work.

---

## Module 1: Mobile money fraud (PaySim)

**Data:** [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) (Kaggle, CC-BY-SA-4.0): 6,362,620 simulated mobile money transactions, 8,213 frauds (0.129%). The dataset is not included in this repo.

**What the data showed**
- Fraud only occurs in TRANSFER (4,097) and CASH_OUT (4,116). Other types have none, so the detector approves them without running the model.
- 97.6% of frauds empty the sender's account.
- When the receiver's balance stays at 0 after receiving money, about 25% of transactions are fraud (about 0.15% otherwise).

**Method**
- Time-based split on the `step` column: train steps 1-520 (2,653,729 rows, 5,781 frauds), validation 521-630 (78,689 rows, 1,168 frauds), test 631 and later (37,991 rows, 1,264 frauds).
- Model: XGBoost with class weighting, early stopping on validation PR-AUC.
- Final features: `amount`, `oldbalanceOrg`, `oldbalanceDest`, `drainRatio` (amount divided by the sender's balance before), `destOldZero`, `isTransfer`.

**Data leakage check.** The first XGBoost scored a perfect 1.0000 using fields recorded after the transaction (`errorOrig`, `emptied`, `newbalanceOrig`). A live system would not have them at approval time, so they were removed. `drainRatio` expresses the same "drains the whole account" pattern using only pre-transaction information. The `hour` feature was also dropped because it looked like a simulator artifact (PR-AUC changed from 0.9962 to 0.9940).

**Results** (test set: 37,991 transactions, 1,264 frauds)

| Model | PR-AUC | Recall @ 1% FPR | Caught | False alarms | Missed |
|---|---|---|---|---|---|
| Logistic regression (uses post-transaction fields) | 0.9395 | 0.9106 | 1,213 | 1,106 | 51 |
| XGBoost, post-transaction fields (leaky, not deployable) | 1.0000 | 1.0000 | 1,263 | 1 | 1 |
| XGBoost, pre-transaction, with `hour` | 0.9962 | 1.0000 | 1,263 | 71 | 1 |
| **XGBoost, pre-transaction, no `hour` (final)** | **0.9940** | **0.9992** | **1,263** | **72** | **1** |

The final model catches 1,263 of 1,264 frauds, with 72 false alarms among 36,727 normal transactions (about 0.2%). Removing the leaky fields cost very little (PR-AUC 1.0000 to 0.9940), which shows the fraud signal is real and not just leakage. The logistic regression baseline used the leaky fields, so it is not a like-for-like comparison with the final model.

Decision threshold: 0.5. A cost sweep (assumed cost of 100 per missed fraud and 5 per false alarm) showed almost identical total cost for thresholds from 0.45 to 0.85, so the threshold barely matters on this data.

**Limitations**
- PaySim is synthetic and its fraud follows a simple script, so these scores will not transfer to real data.
- The test set is 3.3% fraud (train is about 0.2%). At the realistic rate of about 0.3% among TRANSFER and CASH_OUT, the same false-alarm rate would give a precision of roughly 60%, not the 94.6% seen on this test set (rough estimate).
- The cost values are assumptions, not measured business costs.
- Almost every sender appears once, so account-history features were not possible.
- The model was trained in `notebooks/01_paysim_eda.ipynb`. A reusable training script is still to do.

---

## Module 2: E-commerce fraud (IEEE-CIS)

**Data:** [IEEE-CIS Fraud Detection](https://www.kaggle.com/c/ieee-fraud-detection) (Kaggle competition data; accept the competition rules to download). Transaction and identity tables merged into 590,540 rows and 434 columns, with a fraud rate of 3.5%. Only 23.8% of transactions have identity information, and 214 columns are more than 50% empty. The dataset is not included in this repo.

**What the data showed**
- Fraud is not one simple rule. It is a mix of weak signals.
- Product code matters: `ProductCD` C has 11.7% fraud, W only 2.0%.
- Credit cards (6.7%) are about 3 times riskier than debit cards (2.4%).
- Mobile devices have 10.2% fraud, desktop 6.5%, and transactions with no identity record 2.1%. Rows with identity data are 24% of the traffic but hold about half of all fraud (calculated from the counts and rates).
- Fraud rate is fairly stable over six months (2.6% to 4.1% per band), so the time-based split gives comparable train, validation and test sets.

**Method**
- Time-based split on `TransactionDT`, 70/15/15: train 413,378 rows (14,538 frauds, 3.52%), validation 88,581 (3,042, 3.43%), test 88,581 (3,083, 3.48%).
- `TransactionID` and `TransactionDT` are not used as features.
- Missing values are left as they are, because XGBoost handles them natively and missingness is often a signal.
- Text columns are converted to integer codes. The code mappings are saved with the model and verified against the training data, so the API encodes categories exactly as training did; unseen values map to -1 (treated as missing).
- Two models are reported: a **benchmark** on all 431 features, and a **deployable form model** on 16 inputs a customer-facing form could supply (amount, product code, card fields, address fields, distance, email domains, device type, plus two derived features: fractional cents and whether payer and recipient email domains match).

**Results** (test set: 88,581 transactions, 3,083 frauds, threshold 0.5)

| Model | PR-AUC | Recall @ 1% FPR | Caught | Missed | False alarms |
|---|---|---|---|---|---|
| Logistic regression, 7 features (baseline) | 0.1091 | 0.0720 | 1,920 | 1,163 | 20,444 |
| XGBoost, all 431 features (benchmark, not deployable) | 0.5155 | 0.4450 | 1,689 | 1,394 | 2,900 |
| XGBoost, all features plus card-history features | 0.5171 | 0.4379 | 1,645 | 1,438 | 2,317 |
| XGBoost, form features, first attempt | 0.1906 | 0.1482 | 1,900 | 1,183 | 14,624 |
| **XGBoost, form features, regularised (final)** | **0.2187** | **0.1576** | **1,894** | **1,189** | **11,289** |

- The benchmark reaches about 15 times the PR-AUC of random guessing (0.035, the fraud rate) and about 5 times the baseline. Time-safe card-history features added no measurable gain (0.5155 to 0.5171), so they were not kept.
- The deployable form model keeps only about 40% of the benchmark's PR-AUC. Most of the signal lives in 400+ anonymised processor features (`V`, `C`, `D` columns) that a customer form cannot supply.
- Regularising the form model (depth 5, minimum child weight 100, L2 penalty) raised test PR-AUC from 0.1906 to 0.2187 and cut false alarms at 0.5 from 14,624 to 11,289.

**Operating points of the final form model**

| Threshold | Caught | Missed | False alarms | Precision | Share flagged | Assumed cost |
|---|---|---|---|---|---|---|
| 0.4 | 2,154 | 929 | 17,106 | 11.2% | 21.7% | 178,430 |
| **0.5 (chosen)** | **1,894** | **1,189** | **11,289** | **14.4%** | **14.9%** | **175,345** |
| 0.6 | 1,629 | 1,454 | 7,297 | 18.3% | 10.1% | 181,885 |

At 0.5 the model catches 61% of fraud and flags 14.9% of transactions, with about 6 false alarms for every fraud caught. Under the assumed costs (100 per missed fraud, 5 per false alarm) 0.5 is the cheapest of the three, and approving everything would cost 308,300. For the benchmark, lowering the threshold to catch 85% of fraud flags about 24% of all transactions with 11.9% precision, which is too much volume for most review teams.

**Limitations**
- The deployable model is weak in absolute terms (PR-AUC 0.22). It is a triage tool: most alerts are false, and about 39% of fraud is still missed at the chosen threshold.
- The `V`, `C` and `D` columns are anonymised by the data provider. Whether they exist at approval time in a real system is an assumption.
- `card1` and `card2` behave like card identifiers, not customer IDs, so true per-customer history features were not possible.
- Test performance (0.2187) is lower than validation (0.244), because early stopping picks the best round on validation data and fraud patterns drift over time.
- The cost values and the threshold choice are assumptions based on alert volume, not measured business costs.
- Scores are risk scores, not calibrated probabilities.
- The model was trained in `notebooks/02_ieee_eda.ipynb`. A reusable training script is still to do.

---

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

Response (shortened): `fraud_probability` 0.9999 (a risk score, see above), `decision` "review", and `top_reasons` led by `drainRatio`, each with its impact and whether it "raises risk" or "lowers risk". The e-commerce detector will be added as a second type (`ecommerce`).

## Project structure

```
detectors/        Detector interface, registry, one folder per fraud type
api/              FastAPI app
models/           Saved models and metadata (feature lists, thresholds, category mappings)
notebooks/        EDA and model development (01 PaySim, 02 IEEE-CIS)
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

To retrain or explore, download the datasets into `data/paysim/` and `data/ieee/` and open the notebooks:

```powershell
kaggle datasets download -d ealaxi/paysim1 -p data/paysim --unzip
kaggle competitions download -c ieee-fraud-detection -p data/ieee   # accept the competition rules first
```

## Roadmap

1. E-commerce detector in the API (features, SHAP reasons, tests).
2. Next.js frontend with a fraud type selector and forms generated from `/schema/{type}`.
3. PostgreSQL storage for scores and analyst decisions, Docker Compose, deployment.
4. Training scripts and experiment tracking; probability calibration.
