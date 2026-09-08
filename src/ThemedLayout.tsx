import { createServerSideProps } from "@/lib/features/session";
import { ReactNode, Suspense } from "react";
import { Box } from "@mui/joy";
import LoadingOverlay from "./components/LoadingOverlay";

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
    // Floating fallback: an in-flow one pushes the page down, and a Joy Modal here crashes server rendering.
    <Suspense fallback={<LoadingOverlay />}>
      {/* This slot only ever shows the album modal; keeping it out of the page flow stops its loading states from pushing the layout down. */}
      <Box sx={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100 }}>
        {information}
      </Box>
      {classic && modern && isClassic ? (
        <div id="classic-container">{classic}</div>
      ) : (
        <div id="modern-container">{modern}</div>
      )}
    </Suspense>
  );
}
