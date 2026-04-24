import { createServerSideProps } from "@/lib/features/session";
import { ReactNode, Suspense } from "react";
import { LoadingPage } from "./components/LoadingPage";

export type ThemedLayoutProps = {
  classic: ReactNode;
  modern: ReactNode;
};

/** @deprecated Use ThemedLayoutProps — dashboard and login layouts now share the same shape. */
export type DashboardLayoutProps = ThemedLayoutProps;

/** @deprecated Use ThemedLayoutProps — dashboard and login layouts now share the same shape. */
export type LoginLayoutProps = ThemedLayoutProps;

export default async function ThemedLayout(
  props: ThemedLayoutProps
) {
  const serverSideProps = await createServerSideProps();
  const isClassic = serverSideProps.application.experience === "classic";

  const { classic, modern } = props;

  return (
    <Suspense fallback={<LoadingPage />}>
      {classic && modern && isClassic ? (
        <div id="classic-container">{classic}</div>
      ) : (
        <div id="modern-container">{modern}</div>
      )}
    </Suspense>
  );
}
