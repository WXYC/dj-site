import { getServerSideProps } from "@/lib/features/authentication/session";
import { ReactNode, Suspense } from "react";
import { LoadingPage } from "./components/LoadingPage";

export type ThemedLayoutProps = {
  classic: ReactNode;
  modern: ReactNode;
  information: ReactNode;
};

export default async function ThemedLayout({
  classic,
  modern,
  information,
}: ThemedLayoutProps) {
  const serverSideProps = await getServerSideProps();

  return (
    <Suspense fallback={<LoadingPage />}>
        {information}
      {classic && modern && serverSideProps.application.appSkin === "classic"
        ? <div id="classic-container">{classic}</div>
        : modern}
    </Suspense>
  );
}
