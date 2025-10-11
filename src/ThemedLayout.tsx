import { createServerSideProps } from "@/lib/features/session";
import { ReactNode, Suspense } from "react";
import { LoadingPage } from "./components/LoadingPage";

// Dashboard layout props (includes information slot)
export type DashboardLayoutProps = {
  classic: ReactNode;
  modern: ReactNode;
  information: ReactNode;
};

// Login layout props (no information slot)
export type LoginLayoutProps = {
  classic: ReactNode;
  modern: ReactNode;
};

// Unified props type
export type ThemedLayoutProps = DashboardLayoutProps | LoginLayoutProps;

export default async function ThemedLayout(
  props: ThemedLayoutProps
) {
  const serverSideProps = await createServerSideProps();
  const isClassic = serverSideProps.application.experience === "classic";
  
  const { classic, modern } = props;
  const information = "information" in props ? props.information : null;

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
