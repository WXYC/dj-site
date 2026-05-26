import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import Main from "@/src/components/experiences/classic/flowsheet/Layout/Main";
import SSESubscription from "@/src/components/shared/SSESubscription";

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
