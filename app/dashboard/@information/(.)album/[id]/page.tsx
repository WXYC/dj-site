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

  // Local closed-state, keyed by album id so a later navigation to a
  // different album on a reused slot instance starts un-dismissed. This
  // exists because the navigation that follows a dismissal does not reliably
  // re-render this intercepted slot: the router restores the underlying
  // page's URL while leaving this tree mounted with its stale content, so
  // nothing downstream of the router — not even `usePathname` — can be
  // counted on to clear the dialog.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const dismissed = dismissedFor === params.id;

  // Browser back/forward bypasses the dismiss handler but must clear the
  // dialog the same way; the listener fires regardless of whether the router
  // re-renders this slot.
  useEffect(() => {
    const onPopState = () => {
      if (!window.location.pathname.includes("/album/")) {
        setDismissedFor(params.id);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [params.id]);

  // history.length > 1 means we arrived by an in-app navigation (interception),
  // so back() restores the prior URL. length <= 1 is a cold load with no history
  // to go back to; push the dashboard home instead of dead-ending. The dialog
  // unmounts via local state first, then the URL follows.
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

  // Three ways the dialog must disappear, each with its own signal: a
  // dismissal (local state, immediate), browser back/forward (popstate
  // listener above), and a soft navigation elsewhere while the modal is open
  // (the pathname, when the router does re-render this slot).
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
        <ModalClose aria-label="Close album detail" />
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
