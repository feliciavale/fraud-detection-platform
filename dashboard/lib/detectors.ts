// Everything the dashboard says about each detector lives here: names, colours, form defaults,
// help text, and the test results shown on Model performance. Pages only display it.
// All numbers come from the offline test results in the project notes and README.

export type DetectorId = "mobile_money" | "ecommerce";

type Group = { title: string; fields: string[] };
type Compared = { model: string; prauc: string; recall: string; final?: boolean };

/** One plain-language test result, e.g. "caught 1,263 of 1,264 frauds". */
export type PlainResult = {
  label: string;      // what is being measured, in everyday words
  part: number;
  whole: number;
  sentence: string;   // the result written out
  good: "high" | "low"; // whether a high share is good (caught) or bad (false alarms)
};

export type DetectorConfig = {
  id: DetectorId;
  name: string;
  plainName: string;
  model: string;
  summary: string;
  accent: string;
  soft: string;
  threshold: number;
  defaults: Record<string, string>;
  example?: Record<string, string>;
  groups?: Group[];
  formHint: string;
  help: Record<string, string>;
  caveat: string;
  explainNote?: string;
  notes: Record<string, string>;
  verdict: { rating: string; text: string };
  plain: PlainResult[];
  testSize: string;
  metrics: { label: string; value: string; hint?: string }[];
  facts: [string, string][];
  compared: Compared[];
  limits: string[];
};

export const FEATURE_LABELS: Record<string, string> = {
  type: "Transaction type",
  amount: "Transaction amount",
  drainRatio: "Share of sender's balance moved",
  destOldZero: "Receiver account was empty before",
  isTransfer: "Transaction is a TRANSFER",
  amt_cents: "Cents part of the amount",
  email_match: "Email-domain code comparison",
};

export const DETECTORS: Record<DetectorId, DetectorConfig> = {
  mobile_money: {
    id: "mobile_money",
    name: "Mobile money",
    plainName: "Phone wallet transfers",
    model: "PaySim · XGBoost",
    summary: "Checks money sent between phone wallets and cash withdrawals, using the amount and the balances before the transaction.",
    accent: "#0F766E",
    soft: "#E3F1EF",
    threshold: 0.5,
    defaults: { type: "TRANSFER" },
    example: { type: "TRANSFER", amount: "696575.46", oldbalanceOrg: "696575.46", oldbalanceDest: "0" },
    formHint: "Enter the balances as they were before the transaction. In a real system these would be looked up automatically.",
    help: {
      type: "TRANSFER sends money to another wallet. CASH_OUT withdraws it. Other types are approved without running the model.",
      amount: "How much money is being moved.",
      oldbalanceOrg: "How much the sender had before this transaction.",
      oldbalanceDest: "How much the receiver had before this transaction. Enter 0 if the account was empty.",
    },
    caveat:
      "Trained on simulated data whose fraud follows a simple pattern. Scores look near-perfect here and should not be expected on real traffic.",
    notes: {
      drainRatio: "Values near 1 mean the transfer empties the sender's account, the main fraud pattern in this dataset.",
      destOldZero: "1 means the receiving account held nothing before the transaction.",
    },
    verdict: {
      rating: "Very accurate, on simulated data",
      text:
        "In testing it caught almost every fraud and rarely bothered normal customers. The test data is simulated, and its fraud follows one simple pattern (emptying the sender's account), so real-world results would be lower.",
    },
    plain: [
      { label: "Frauds it caught", part: 1263, whole: 1264, sentence: "Caught 1,263 of 1,264 frauds.", good: "high" },
      { label: "Normal transactions it wrongly flagged", part: 72, whole: 36727, sentence: "Flagged 72 of 36,727 normal transactions, about 2 in every 1,000.", good: "low" },
      { label: "Flagged transactions that really were fraud", part: 1263, whole: 1335, sentence: "Of 1,335 flagged transactions, 1,263 were fraud, about 19 in 20.", good: "high" },
    ],
    testSize: "37,991 transactions it had never seen, from later in time than its training data.",
    metrics: [
      { label: "PR-AUC", value: "0.9940", hint: "ranking quality, 1.0 is perfect" },
      { label: "Recall at 1% false alarms", value: "0.9992" },
      { label: "Frauds caught", value: "1,263 of 1,264" },
      { label: "False alarms", value: "72", hint: "of 36,727 normal transactions" },
    ],
    facts: [
      ["Dataset", "PaySim: 6,362,620 simulated mobile money transactions"],
      ["Test set", "37,991 transactions, 1,264 frauds (3.3%), later in time than the training data"],
      ["Decision rule", "Review if score is at least 0.5"],
      ["Types the model sees", "TRANSFER and CASH_OUT only; other types are approved by rule"],
    ],
    compared: [
      { model: "Logistic regression (uses post-transaction fields)", prauc: "0.9395", recall: "0.9106" },
      { model: "XGBoost with post-transaction fields (leaky, not deployable)", prauc: "1.0000", recall: "1.0000" },
      { model: "XGBoost, pre-transaction, with hour", prauc: "0.9962", recall: "1.0000" },
      { model: "XGBoost, pre-transaction, no hour", prauc: "0.9940", recall: "0.9992", final: true },
    ],
    limits: [
      "The data is simulated, and its fraud follows a simple script.",
      "The test set is 3.3% fraud against about 0.13% in the full data, so the share of flags that are real fraud is higher here than it would be in practice.",
      "The costs used to choose the threshold (100 per missed fraud, 5 per false alarm) are assumptions.",
      "Almost every sender appears only once, so the model cannot use a customer's past behaviour.",
    ],
  },
  ecommerce: {
    id: "ecommerce",
    name: "E-commerce",
    plainName: "Online card payments",
    model: "IEEE-CIS · XGBoost (form fields)",
    summary: "Checks online card payments using details a checkout form can collect: amount, card, address, email and device.",
    accent: "#1D4ED8",
    soft: "#E6ECFB",
    threshold: 0.5,
    defaults: {
      ProductCD: "W", card1: "7919", card2: "321", card3: "150", card4: "visa", card5: "226",
      card6: "debit", addr1: "299", addr2: "87", P_emaildomain: "gmail.com",
    },
    groups: [
      { title: "Payment", fields: ["TransactionAmt", "ProductCD"] },
      { title: "Card", fields: ["card1", "card2", "card3", "card4", "card5", "card6"] },
      { title: "Address", fields: ["addr1", "addr2", "dist1"] },
      { title: "Contact and device", fields: ["P_emaildomain", "R_emaildomain", "DeviceType"] },
    ],
    formHint:
      "Card and address fields start with the most common values in the training data. If you do not know a value, keep the pre-filled one: empty fields make the score less reliable.",
    help: {
      TransactionAmt: "The payment amount in US dollars.",
      ProductCD: "Product category from the dataset. What each letter stands for was never published.",
      card1: "A coded card detail from the dataset. Keep the pre-filled value if you do not know it.",
      card2: "A coded card detail from the dataset. Keep the pre-filled value if you do not know it.",
      card3: "A coded card detail from the dataset. Keep the pre-filled value if you do not know it.",
      card4: "The card network, for example Visa or Mastercard.",
      card5: "A coded card detail from the dataset. Keep the pre-filled value if you do not know it.",
      card6: "Whether it is a debit or a credit card.",
      addr1: "A coded billing region. The real places were not published.",
      addr2: "A coded billing country. The real countries were not published.",
      dist1: "A distance value from the dataset whose exact meaning was not published. Leave empty if unknown.",
      P_emaildomain: "The buyer's email provider, for example gmail.com.",
      R_emaildomain: "The recipient's email provider, if there is one. Leave empty if unknown.",
      DeviceType: "Whether the payment was made on a phone or a computer.",
    },
    caveat:
      "A weak model (PR-AUC 0.22): use it to decide which payments to check first, not to decide on its own. Most of the payments it flags are normal.",
    explainNote:
      "These show which inputs the model leaned on, not what caused fraud. Many card and address fields are coded, so they cannot be explained in plain language.",
    notes: {},
    verdict: {
      rating: "Limited, use as a first filter only",
      text:
        "It catches about 6 in 10 frauds, but most of the payments it flags turn out to be normal. It works with real payment data, which is much harder than simulated data. Treat its flags as a list of payments to look at first, not as proof of fraud.",
    },
    plain: [
      { label: "Frauds it caught", part: 1894, whole: 3083, sentence: "Caught 1,894 of 3,083 frauds, about 6 in 10. The other 1,189 got through.", good: "high" },
      { label: "Normal payments it wrongly flagged", part: 11289, whole: 85498, sentence: "Flagged 11,289 of 85,498 normal payments, about 13 in every 100.", good: "low" },
      { label: "Flagged payments that really were fraud", part: 1894, whole: 13183, sentence: "Of 13,183 flagged payments, 1,894 were fraud, about 1 in 7.", good: "high" },
    ],
    testSize: "88,581 real card payments it had never seen, from later in time than its training data.",
    metrics: [
      { label: "PR-AUC", value: "0.2187", hint: "random guessing is about 0.035" },
      { label: "Recall at 1% false alarms", value: "0.1576" },
      { label: "Frauds caught at 0.5", value: "1,894 of 3,083" },
      { label: "False alarms at 0.5", value: "11,289", hint: "about 6 per fraud caught" },
    ],
    facts: [
      ["Dataset", "IEEE-CIS Fraud Detection: 590,540 transactions, 3.5% fraud"],
      ["Test set", "88,581 transactions, 3,083 frauds (3.5%), later in time than the training data"],
      ["Decision rule", "Review if score is at least 0.5 (flags about 14.9% of transactions, precision 14.4%)"],
      ["Inputs", "16 fields a form can supply; the 431-feature benchmark cannot be served through a form"],
    ],
    compared: [
      { model: "Logistic regression, 7 features", prauc: "0.1091", recall: "0.0720" },
      { model: "XGBoost, all 431 features (benchmark, not deployable)", prauc: "0.5155", recall: "0.4450" },
      { model: "XGBoost, form fields, first attempt", prauc: "0.1906", recall: "0.1482" },
      { model: "XGBoost, form fields, regularised", prauc: "0.2187", recall: "0.1576", final: true },
    ],
    limits: [
      "Most of the useful information is in coded columns from the payment processor that a checkout form cannot collect. A test model that used those columns scored more than twice as high, but it cannot be used with a form.",
      "About 4 in 10 frauds are still missed at the chosen threshold.",
      "The score ranks payments; it is not a percentage chance of fraud. Missing details make it less reliable.",
      "The email check compares two coded columns, so it is not a true check that both emails use the same provider.",
    ],
  },
};
