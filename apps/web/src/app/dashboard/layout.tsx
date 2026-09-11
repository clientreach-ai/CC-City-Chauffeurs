import Header from "@/components/header";

/**
 * The app shell that previously lived in the root layout. The marketing site
 * renders its own navigation, so the header now sits with the app routes.
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid h-svh grid-rows-[auto_1fr]">
      <Header />
      {children}
    </div>
  );
}
