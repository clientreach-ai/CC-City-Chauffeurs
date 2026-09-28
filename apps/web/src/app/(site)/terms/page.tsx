import { LegalPage } from "@/components/site/legal-page";
import { termsOfService } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const generateMetadata = () =>
  pageMetadata({
    title: "Terms of Service | CC City Chauffeurs",
    description: termsOfService.summary,
    path: "/terms",
  });

export default function Page() {
  return <LegalPage document={termsOfService} />;
}
