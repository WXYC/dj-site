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
    // Fixed-overlay fallback on purpose: a Joy Modal here SSR-crashes in
    // @mui/base's useModal when this boundary suspends during streaming, and
    // an in-flow fallback pushes the streamed page down until the boundary
    // resolves.
    <Suspense fallback={<LoadingOverlay />}>
      {/* The information slot only ever resolves to a portaled modal, but it
          renders here as a sibling ABOVE the experience container, so any
          in-flow state the router puts in it (a loading fallback, an error
          block) would shove the whole frame down. This layer keeps the slot
          permanently out of flow; pointer events pass through it, and the
          modal itself portals to the body so its interactivity is unaffected. */}
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
