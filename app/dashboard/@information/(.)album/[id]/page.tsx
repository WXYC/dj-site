"use client";

import { Modal, ModalDialog, ModalClose } from "@mui/joy";
import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import AlbumCard from "@/src/components/experiences/modern/catalog/album/AlbumCard";
import AlbumErrorCard from "@/src/components/experiences/modern/catalog/album/AlbumErrorCard";
import AlbumLoadingCard from "@/src/components/experiences/modern/catalog/album/AlbumLoadingCard";

/**
 * Album detail as a permalinkable modal via the App Router intercepting-route
 * pattern. Reached three ways, all resolving `/dashboard/album/[id]` (the
 * Backend-Service serial `library.id`):
 *
 *   - soft (client) navigation      → this file intercepts and overlays the modal
 *   - hard navigation / permalink   → `@information/album/[id]/page.tsx` (re-export)
 *   - the routable page itself      → `app/dashboard/album/[id]/page.tsx` (re-export)
 *
 * Escape / backdrop / close-button all dismiss. For the intercepted (soft-nav)
 * case, dismissal is `router.back()`, which restores the underlying page. A cold
 * permalink load in a fresh tab has no in-app history, so `router.back()` would
 * dead-end (a stuck modal, or navigating out of the app) — the exact permalink
 * path this route exists to serve — so we fall back to the dashboard home there.
 * The close affordance is a real `ModalClose` above the backdrop so tests (and
 * assistive tech) can click it directly.
 *
 * This modal is the only album-detail surface: every in-app album click
 * navigates here, and the rightbar stays reserved for its resident content.
 */
export default function AlbumPopup() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();

  // Closing is tracked locally per album — the router doesn't reliably re-render this slot after navigating away.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const dismissed = dismissedFor === params.id;

  // The browser's back/forward buttons skip the dismiss handler but must also close the dialog.
  useEffect(() => {
    const onPopState = () => {
      if (!window.location.pathname.includes("/album/")) {
        setDismissedFor(params.id);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [params.id]);

  // With in-app history, back() restores the page underneath; a cold permalink load has none, so go home instead.
  const dismiss = () => {
    setDismissedFor(params.id);
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  const { data, isLoading, isError } = useGetInformationQuery(
    { album_id: Number(params.id) },
    { skip: params.id === undefined || params.id === null || Number.isNaN(Number(params.id)) },
  );

  const {
    artworkUrl,
    isLoading: metadataLoading,
    metadata,
  } = useAlbumArtwork(data?.artist.name, data?.title, data?.discogsUnavailable === true);

  const { artistMetadata, bioTokens } = useArtistMetadata(metadata?.discogsArtistId);

  // Gone when dismissed, after browser back, or once the URL leaves the album route.
  if (dismissed || (pathname && !pathname.includes("/album/"))) {
    return null;
  }

  return (
    <Modal
      open={true}
      onClose={dismiss}
      sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <ModalDialog
        aria-label="Album detail"
        layout="center"
        sx={{ maxWidth: "min(560px, 96vw)", width: "100%", p: 0, overflow: "auto" }}
      >
        {/* Sits above the card content (Joy gives it z-index 1) so the card can't swallow clicks on this corner. */}
        <ModalClose aria-label="Close album detail" sx={{ zIndex: 2 }} />
        {isLoading ? (
          <AlbumLoadingCard />
        ) : isError || !data ? (
          <AlbumErrorCard />
        ) : (
          <AlbumCard
            album={data as AlbumEntry}
            artworkUrl={artworkUrl}
            metadata={metadata}
            metadataLoading={metadataLoading}
            artistBio={artistMetadata?.bio ?? metadata?.artistBio ?? null}
            bioTokens={bioTokens}
            artistWikipediaUrl={
              artistMetadata?.wikipediaUrl ?? metadata?.artistWikipediaUrl ?? null
            }
          />
        )}
      </ModalDialog>
    </Modal>
  );
}
