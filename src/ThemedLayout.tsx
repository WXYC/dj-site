import { createServerSideProps } from "@/lib/features/session";
import { ReactNode, Suspense } from "react";
import LoadingFallback from "./components/LoadingFallback";

export type ThemedLayoutProps = {
  classic: ReactNode;
  modern: ReactNode;
  // The dashboard's `@information` parallel slot renders the permalinkable
  // album-detail modal over the active experience (WXYC/dj-site#979). Optional
  // because the login layout shares this shape and has no such slot.
  information?: ReactNode;
};

export default async function ThemedLayout(
  props: ThemedLayoutProps
) {
  const serverSideProps = await createServerSideProps();
  const isClassic = serverSideProps.application.experience === "classic";

  const { classic, modern, information } = props;

  return (
    // Portal-free fallback on purpose: a Joy Modal here SSR-crashes in
    // @mui/base's useModal when this boundary suspends during streaming, and
    // an open Modal would scroll-lock and focus-trap the app on every slow
    // navigation besides.
    <Suspense fallback={<LoadingFallback />}>
      {information}
      {classic && modern && isClassic ? (
        <div id="classic-container">{classic}</div>
      ) : (
        <div id="modern-container">{modern}</div>
      )}
    </Suspense>
  );
}
