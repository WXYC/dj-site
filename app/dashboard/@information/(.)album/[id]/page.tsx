"use client";

import { Modal, ModalDialog, ModalClose } from "@mui/joy";
import { useParams, useRouter } from "next/navigation";
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

  // history.length > 1 means we arrived by an in-app navigation (interception),
  // so back() restores the prior URL. length <= 1 is a cold load with no history
  // to go back to; push the dashboard home instead of dead-ending.
  const dismiss = () => {
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
