import { createServerSideProps } from "@/lib/features/session";
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
  const serverSideProps = await createServerSideProps();
  const isClassic = serverSideProps.application.experience === "classic";

  return (
    <Suspense fallback={<LoadingPage />}>
      {information}
      {classic && modern && isClassic ? (
        <div id="classic-container">{classic}</div>
      ) : (
        <div id="modern-container">{modern}</div>
      )}
    </Suspense>
  );
}
