import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import Main from "@/src/components/experiences/classic/flowsheet/Layout/Main";
import SSESubscription from "@/src/components/shared/SSESubscription";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export const metadata: Metadata = {
  title: getPageTitle("Flowsheet"),
};

export default function ClassicFlowsheetPage() {
  return (
    <>
      <SSESubscription surface="dashboard" />
      <Main />
    </>
  );
}
