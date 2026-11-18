import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms and conditions" };

const REPO = "https://github.com/feliciavale/fraud-detection-platform";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and conditions"
      updated="18 November 2026"
      sections={[
        {
          heading: "Purpose",
          body: (
            <p>
              Sentinel is a portfolio demonstration of fraud scoring. It is provided for learning and evaluation only. By using
              it you agree to these terms.
            </p>
          ),
        },
        {
          heading: "Not for real decisions",
          body: (
            <p>
              Scores and decisions shown here must not be used to approve, decline or investigate real payments or real
              people. The models were trained on public research datasets, one of them simulated, and their known limits are
              listed on the Model performance page.
            </p>
          ),
        },
        {
          heading: "No warranty",
          body: (
            <p>
              The site is provided as is, without any warranty. It may be unavailable, change or stop at any time. The author
              is not liable for any loss arising from its use.
            </p>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <p>
              Do not submit personal or confidential data, attempt to overload or break the service, or use automated tools to
              send large numbers of requests.
            </p>
          ),
        },
        {
          heading: "Your account",
          body: (
            <p>
              Keep your password to yourself. You are responsible for what is done with your account. Accounts may be removed if
              they are used against these terms, and the service may be reset during development, which can delete saved
              history.
            </p>
          ),
        },
        {
          heading: "Data sources",
          body: (
            <p>
              The models were trained on the PaySim dataset and the IEEE-CIS Fraud Detection dataset. Those datasets remain
              under their own terms and are not redistributed by this site.
            </p>
          ),
        },
        {
          heading: "Changes and contact",
          body: (
            <p>
              These terms may be updated, and the date above will change with them. Questions can be raised as an issue on the{" "}
              <a href={REPO} className="underline underline-offset-2">
                project repository
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
