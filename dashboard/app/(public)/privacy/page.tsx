import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

const REPO = "https://github.com/feliciavale/fraud-detection-platform";

// Keep this page true. If you add new data (for example names, or analytics tools), update it and change the date.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="18 November 2026"
      sections={[
        {
          heading: "Who runs this site",
          body: (
            <p>
              Sentinel is a portfolio project built by Felicia, a computer science student. It is a demonstration, not a
              commercial service.
            </p>
          ),
        },
        {
          heading: "What you send",
          body: (
            <p>
              When you select Analyze, the values in the form are sent to the scoring API so the model can return a score. Do
              not enter real card numbers, account numbers or other personal data. The form only needs example values.
            </p>
          ),
        },
        {
          heading: "What is stored",
          body: (
            <>
              <p>
                <b>Your account:</b> your email address and your password. The password is stored only as a salted scrypt hash,
                so it cannot be read back, not even by the site owner.
              </p>
              <p>
                <b>Your checks:</b> each transaction you analyze is saved with its result, the time, and any outcome you record
                (fraud or not fraud). Only you can see them; other accounts cannot.
              </p>
              <p>
                <b>Your login session:</b> a random token that keeps you logged in for up to 7 days. Only a hash of it is kept
                on the server.
              </p>
            </>
          ),
        },
        {
          heading: "Deleting your data",
          body: (
            <p>
              You can delete any saved check from your History page at any time. To delete your whole account and everything in
              it, open an issue on the project repository and it will be removed.
            </p>
          ),
        },
        {
          heading: "Cookies and tracking",
          body: (
            <p>
              The site sets one cookie, which keeps you logged in. It is required for the site to work and cannot be read by
              scripts in the page. Your browser also remembers which detector you last selected, on your device only. There are
              no analytics or advertising tools, and fonts are served from this site, not loaded from a third party.
            </p>
          ),
        },
        {
          heading: "Server logs",
          body: (
            <p>
              The hosting provider may keep standard request logs, such as IP address and time of request, for security and
              operations.
            </p>
          ),
        },
        {
          heading: "Changes and contact",
          body: (
            <p>
              If this policy changes, the date above will change with it. Questions can be raised as an issue on the{" "}
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
