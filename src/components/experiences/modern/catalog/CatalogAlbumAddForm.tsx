"use client";

import {
  useAddAlbumMutation,
  useAddArtistMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
  useLazyPeekArtistCodeQuery,
} from "@/lib/features/catalog/api";
import type { AddAlbumRequestBody } from "@/lib/features/catalog/types";
import { parseRequiredPositiveInt } from "@/lib/features/catalog/adminCreateArtistValidation";
import { catalogAlbumPath } from "@/lib/features/catalog/libraryCode";
import { useCatalogEntryForm } from "../admin/catalog/useCatalogEntryForm";
import { useCatalogRotationMarking } from "@/src/hooks/useCatalogRotationMarking";
import type { Rotation } from "@/lib/features/rotation/types";
import Add from "@mui/icons-material/Add";
import { Button } from "@mui/joy";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import CatalogEntryModalShell from "./CatalogEntryModalShell";
import CatalogEntryFormCard from "./form/CatalogEntryFormCard";
import CatalogFormCodePreviewRow from "./form/CatalogFormCodePreviewRow";
import CatalogFormStepStage from "./form/CatalogFormStepStage";
import { CatalogAddWizardNav } from "./form/CatalogEntryFormWizard";
import type { CatalogAddWizardStep } from "./form/CatalogEntryFormWizard";
import { catalogFormFieldGroupsStackSx } from "./form/catalogFormLayout";
import CatalogEntryArtistSection from "./form/sections/CatalogEntryArtistSection";
import CatalogEntryAlbumSection from "./form/sections/CatalogEntryAlbumSection";
import CatalogEntryRotationSection from "./form/sections/CatalogEntryRotationSection";
import { Box } from "@mui/joy";

const STEP_SUBTITLES: Record<CatalogAddWizardStep, string> = {
  artist: "Choose a genre, then find or create an artist.",
  album: "Album fields unlock after the artist exists.",
  rotation: "Optional — rotation is applied when you add the album.",
};

export default function CatalogAlbumAddForm() {
  const router = useRouter();
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();
  const [addArtist, { isLoading: addingArtist }] = useAddArtistMutation();
  const [addAlbum, { isLoading: addingAlbum }] = useAddAlbumMutation();
  const [peekTrigger] = useLazyPeekArtistCodeQuery();

  const form = useCatalogEntryForm();
  const [step, setStep] = useState<CatalogAddWizardStep>("artist");
  const [pendingRotationBin, setPendingRotationBin] = useState<Rotation | null>(
    null,
  );
  const rotation = useCatalogRotationMarking(form.previewAlbumId);

  const genreDisplay = useMemo(() => {
    if (form.genreIdNum === null) return null;
    return genres?.find((g) => g.id === form.genreIdNum)?.genre_name ?? null;
  }, [form.genreIdNum, genres]);

  const formatDisplay = useMemo(() => {
    if (form.formatIdNum === null) return null;
    return formats?.find((f) => f.id === form.formatIdNum)?.format_name ?? null;
  }, [form.formatIdNum, formats]);

  const codeSummary = useMemo(() => {
    const artist =
      form.artistInputValue.trim() ||
      (form.artistOption?.type === "create" ? form.artistOption.inputValue : "");
    const album = form.albumTitle.trim();
    if (artist && album) return `${artist} — ${album}`;
    if (artist) return artist;
    if (album) return album;
    return null;
  }, [form.artistInputValue, form.artistOption, form.albumTitle]);

  const previewRotationBin =
    form.previewAlbumId !== null ? rotation.selectedBin : pendingRotationBin;

  const onSuggestArtistCode = async () => {
    if (form.genreIdNum === null) return;
    const letters = form.codeLetters.trim().toUpperCase();
    if (!letters) {
      toast.error("Enter code letters first.");
      return;
    }
    try {
      const res = await peekTrigger({
        code_letters: letters,
        genre_id: form.genreIdNum,
      }).unwrap();
      form.setCodeNumber(String(res.next_code_number));
      toast.success(`Suggested artist #${res.next_code_number}`);
    } catch {
      toast.error("Could not peek next artist code.");
    }
  };

  const onCreateArtist = async () => {
    if (form.genreIdNum === null || !form.canCreateArtist) return;
    const num = parseRequiredPositiveInt(form.codeNumber);
    const letters = form.codeLetters.trim().toUpperCase();
    const name = form.newArtistName;
    if (!name || !letters || num === null) return;

    try {
      const res = await addArtist({
        artist_name: name,
        alphabetical_name: form.alphabeticalName.trim() || undefined,
        code_letters: letters,
        genre_id: form.genreIdNum,
        code_number: num,
      }).unwrap();
      const id = (res as { id?: number }).id;
      if (typeof id === "number") {
        form.markArtistCreated(id);
        toast.success("Artist created. Continue to album details.");
        setStep("album");
      }
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        data?: { message?: string; artist?: { artist_id: number } };
      };
      if (e?.status === 409 && e?.data?.artist?.artist_id) {
        form.markArtistCreated(e.data.artist.artist_id);
        toast.info(
          "That artist code already exists — using the existing artist record.",
        );
        setStep("album");
        return;
      }
      toast.error(e?.data?.message || "Could not create artist.");
    }
  };

  const onAddAlbum = useCallback(async () => {
    if (
      form.genreIdNum === null ||
      form.formatIdNum === null ||
      form.artistId === null ||
      !form.canAddAlbum
    ) {
      return;
    }
    const title = form.albumTitle.trim();
    const lab = form.label.trim();
    const dq = Math.max(1, parseInt(form.discQuantity, 10) || 1);

    try {
      const body: AddAlbumRequestBody = {
        album_title: title,
        label: lab,
        genre_id: form.genreIdNum,
        format_id: form.formatIdNum,
        artist_id: form.artistId,
        disc_quantity: dq,
      };
      if (form.alternateArtist.trim()) {
        body.alternate_artist_name = form.alternateArtist.trim();
      }

      const inserted = await addAlbum(body).unwrap();
      const aid = (inserted as { id?: number }).id;
      if (typeof aid === "number") {
        form.setPreviewAlbumId(aid);
        if (pendingRotationBin !== null) {
          const rotationOk = await rotation.applyRotation(pendingRotationBin, aid);
          if (!rotationOk) {
            toast.error("Album saved, but rotation could not be updated.");
          }
        }
        setPendingRotationBin(null);
        toast.success("Album added to the catalog.");
        router.replace(catalogAlbumPath(aid), { scroll: false });
      }
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e?.data?.message || "Could not add album.");
    }
  }, [
    addAlbum,
    form,
    pendingRotationBin,
    rotation,
    router,
  ]);

  const handleRotationSelect = async (bin: Rotation | null) => {
    if (form.previewAlbumId !== null) {
      rotation.setSelectedBin(bin);
      const ok = await rotation.applyRotation(bin, form.previewAlbumId);
      if (ok) {
        toast.success(
          bin ? `Marked for ${bin} rotation.` : "Removed from rotation.",
        );
      } else {
        toast.error("Could not update rotation.");
      }
    } else {
      setPendingRotationBin(bin);
    }
  };

  const footerActions = (
    <>
      {step !== "artist" ? (
        <Button
          variant="plain"
          color="neutral"
          onClick={() =>
            setStep(step === "rotation" ? "album" : "artist")
          }
          data-testid="catalog-add-wizard-back"
        >
          Back
        </Button>
      ) : null}
      {step === "artist" ? (
        <Button
          onClick={() => setStep("album")}
          disabled={!form.albumSectionUnlocked}
          data-testid="catalog-add-wizard-next"
        >
          Next
        </Button>
      ) : null}
      {step === "album" ? (
        <>
          <Button
            variant="outlined"
            color="neutral"
            onClick={() => setStep("rotation")}
            disabled={!form.albumSectionUnlocked}
            data-testid="catalog-add-wizard-rotation-step"
          >
            Set rotation
          </Button>
          <Button
            loading={addingAlbum}
            onClick={onAddAlbum}
            disabled={!form.canAddAlbum || addingAlbum}
            data-testid="catalog-add-wizard-submit"
          >
            Add to catalog
          </Button>
        </>
      ) : null}
      {step === "rotation" ? (
        <Button
          loading={addingAlbum}
          onClick={onAddAlbum}
          disabled={!form.canAddAlbum || addingAlbum}
          data-testid="catalog-add-wizard-submit"
        >
          Add to catalog
        </Button>
      ) : null}
    </>
  );

  return (
    <CatalogEntryModalShell variant="add" showCopyLink={false} size="form">
      <CatalogEntryFormCard
        title="Add catalog entry"
        titleDecorator={<Add />}
        subtitle={STEP_SUBTITLES[step]}
        headerExtra={
          <CatalogFormCodePreviewRow
            genreName={genreDisplay}
            codeLetters={form.codeLetters}
            artistNumber={form.codeNumber || null}
            albumEntry="?"
            formatLabel={formatDisplay}
            rotation={previewRotationBin ?? undefined}
            summary={codeSummary}
            data-testid="catalog-add-code-strip"
          />
        }
        navigation={<CatalogAddWizardNav step={step} />}
        actions={footerActions}
      >
        <Box sx={catalogFormFieldGroupsStackSx}>
          <CatalogFormStepStage
            activeStep={step}
            data-testid={`catalog-add-wizard-panel-${step}`}
            steps={{
              artist: (
                <CatalogEntryArtistSection
                  form={form}
                  genres={genres}
                  genresLoading={genresLoading}
                  showNewArtistFields={form.showNewArtistFields}
                  onSuggestArtistCode={onSuggestArtistCode}
                  onCreateArtist={onCreateArtist}
                  creatingArtist={addingArtist}
                  data-testid="catalog-add-artist-card"
                />
              ),
              album: (
                <CatalogEntryAlbumSection
                  disabled={!form.albumSectionUnlocked}
                  formatId={form.formatId}
                  onFormatIdChange={form.setFormatId}
                  formats={formats}
                  formatsLoading={formatsLoading}
                  albumTitle={form.albumTitle}
                  onAlbumTitleChange={form.setAlbumTitle}
                  label={form.label}
                  onLabelChange={form.setLabel}
                  alternateArtist={form.alternateArtist}
                  onAlternateArtistChange={form.setAlternateArtist}
                  discQuantity={form.discQuantity}
                  onDiscQuantityChange={form.setDiscQuantity}
                  onAddAlbum={onAddAlbum}
                  adding={addingAlbum}
                  canAdd={form.canAddAlbum}
                  hideSubmitButton
                  pairAlternateAndDisc
                  data-testid="catalog-add-album-card"
                />
              ),
              rotation: (
                <CatalogEntryRotationSection
                  selectedBin={previewRotationBin}
                  onSelectBin={handleRotationSelect}
                  disabled={!form.albumSectionUnlocked || rotation.loading}
                  data-testid="catalog-add-rotation-card"
                />
              ),
            }}
          />
        </Box>
      </CatalogEntryFormCard>
    </CatalogEntryModalShell>
  );
}
