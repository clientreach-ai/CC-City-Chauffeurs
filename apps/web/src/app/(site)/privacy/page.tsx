import { LegalPage } from "@/components/site/legal-page";
import { privacyNotice } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const generateMetadata = () =>
  pageMetadata({
    title: "Privacy Notice | CC City Chauffeurs",
    description: privacyNotice.summary,
    path: "/privacy",
  });

export default function Page() {
  return <LegalPage document={privacyNotice} />;
}
