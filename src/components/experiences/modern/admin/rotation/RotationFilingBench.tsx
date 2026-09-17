"use client";

import { useState, type JSX } from "react";
import {
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import type { LibraryFilingConflictError, LibraryFilingResponse } from "@wxyc/shared";
import {
  useFileReleaseMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
  useLazyGetDiscogsPrefillQuery,
} from "@/lib/features/catalog/api";
import {
  ARTIST_NAME_MAX_LENGTH,
  suggestCodeLetters,
  validateNewArtistFields,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import {
  discogsPrefillErrorMessage,
  withDefinitiveDiscogsUrl,
} from "@/lib/features/catalog/discogsPrefill";
import {
  buildLibraryFilingRequest,
  type FilingArtistInput,
} from "@/lib/features/catalog/filingRequest";
import { isLibraryFilingConflict } from "@/lib/features/catalog/fileReleaseConflict";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import { isCompilationReleaseArtistName } from "@/lib/features/catalog/is-compilation-artist";
import {
  VARIOUS_ARTISTS_CODE_LETTERS,
  VARIOUS_ARTISTS_CODE_NUMBER,
} from "@/lib/features/catalog/libraryCode";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";
import { ROTATION_BIN_LABELS, type Rotation, RotationBin } from "@/lib/features/rotation/types";
import { useArtistDedupCheck } from "@/src/hooks/catalogHooks";
import { useCompilationBucketResolution } from "@/src/hooks/useCompilationBucketResolution";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import NewArtistFields, {
  type CodeLettersField,
  type NewArtistConflict,
} from "@/src/components/shared/inputs/NewArtistFields";
import CardPicker from "@/src/components/shared/inputs/CardPicker";
import UrlListInput from "@/src/components/shared/inputs/UrlListInput";
import CatalogRotationBinPicker from "@/src/components/experiences/modern/catalog/CatalogRotationBinPicker";
import CompilationBucketPanel from "./CompilationBucketPanel";
import FiledThisSession from "./FiledThisSession";

/**
 * The name a genre's first compilation bucket is created under. The plain
 * spelling, never a sub-bucket: the lettered shelves (`Various Artists - Rock
 * - S`, `Soundtracks - K`) are a Rock/Soundtracks subdivision the librarian
 * maintains, and a genre that has no bucket at all is not starting one.
 */
const COMPILATION_BUCKET_NAME = "Various Artists";

/**
 * A refused filing, snapshotted with the values the server actually rejected
 * so the message keeps naming them while the MD edits. Cleared per reason by
 * the one edit that could change the outcome: the artist reasons by their
 * fields' handlers, the card/bin mismatch by a bin or card change. While it
 * stands, the fields it names are exactly what was refused, so resubmitting
 * unchanged could only reach the same 409 — the submit gate blocks on it.
 */
type FilingConflict = {
  data: LibraryFilingConflictError;
  /** The create-panel values the refused request carried, for the banner to name. */
  typed: { code_letters: string; code_number: string; name: string };
};

/**
 * The Rotation Admin filing bench: one form, one submit — match-or-create the
 * artist, file the release, and (unless the bin is deselected) add the
 * rotation entry to a bin and card, all through the transactional
 * `POST /library/filings`.
 *
 * A Various Artists compilation files here too, through an explicit checkbox
 * rather than a recognized name: the shelf is resolved from the genre's
 * compilation code, so the MD never types an artist, and no filing can mint a
 * second bucket beside the one a genre already has. Per-track credits are not
 * collected at filing time — the LML is the primary source of that truth, and
 * the album card's credits control is where an MD adds it by hand.
 */
export default function RotationFilingBench(): JSX.Element {
  const genresQuery = useGetGenresQuery();
  const formatsQuery = useGetFormatsQuery();
  const [fileRelease, { isLoading: isFiling }] = useFileReleaseMutation();
  const [triggerPrefill, { isFetching: isAutofilling }] = useLazyGetDiscogsPrefillQuery();

  const [discogsUrl, setDiscogsUrl] = useState("");
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [genreId, setGenreId] = useState<number | null>(null);
  const [artistText, setArtistText] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<ArtistInGenreOption | null>(null);
  // The typeahead's CREATE_HIGHLIGHT row expanded the inline panel: the
  // typeahead text is the new artist's name, and the panel holds its filing
  // fields. A later pick from the panel's suggestions collapses it again.
  const [creating, setCreating] = useState(false);
  const [codeLettersField, setCodeLettersField] = useState<CodeLettersField>({
    value: "",
    caret: null,
  });
  const [codeNumberRaw, setCodeNumberRaw] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [albumTitle, setAlbumTitle] = useState("");
  const [label, setLabel] = useState("");
  const [formatId, setFormatId] = useState<number | null>(null);
  const [bin, setBin] = useState<Rotation | null>(RotationBin.H);
  const [cardId, setCardId] = useState<number | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [conflict, setConflict] = useState<FilingConflict | null>(null);
  const [failed, setFailed] = useState(false);
  const [filings, setFilings] = useState<LibraryFilingResponse[]>([]);
  // Written by the checkbox handler and by a Discogs resolve. The mode survives
  // a filing the way genre, label, format and bin do — an MD files compilations
  // in stacks.
  const [vaChecked, setVaChecked] = useState(false);
  // Who Discogs credited the last resolved release to. Not a copy of the artist
  // field: that field also holds names the MD typed, and only a resolved credit
  // can contradict the checkbox. Cleared the moment it stops describing what is
  // on screen.
  const [prefillArtistName, setPrefillArtistName] = useState<string | null>(null);

  // A checked box always has a genre to resolve against: the checkbox is
  // disabled until one is selected, and the genre Select offers no way back to
  // none. Were that ever to change, this falls to the typed arm rather than
  // leaving the Artist section with no control at all.
  const compilationActive = vaChecked && genreId !== null;
  const compilation = useCompilationBucketResolution({
    active: compilationActive,
    genreId,
    albumTitle,
  });
  const selectedGenreName =
    (genresQuery.data ?? []).find((genre) => genre.id === genreId)?.genre_name ?? null;

  const trimmedArtist = artistText.trim();
  const artistTooLong = trimmedArtist.length > ARTIST_NAME_MAX_LENGTH;
  const dedup = useArtistDedupCheck(trimmedArtist);
  const {
    trimmedCodeLetters,
    codeLettersTooLong,
    alphabeticalNameTooLong,
    codeNumberInvalid,
  } = validateNewArtistFields(
    {
      alphabeticalName,
      codeLetters: codeLettersField.value,
      codeNumberRaw,
    },
    // The bench files compilations at code_number 0, so a deliberate 0 is a
    // legal number here rather than an invalid one.
    { allowZeroCodeNumber: true },
  );

  // See isGenresUnavailable for why this reads absence-of-list rather than
  // isError. The predicate is shape-generic despite its name, and the format
  // list fails the same way for the same reasons, so both gates share it.
  const genresUnavailable = isGenresUnavailable(genresQuery);
  const formatsUnavailable = isGenresUnavailable(formatsQuery);
  const listsUnavailable = genresUnavailable || formatsUnavailable;

  const cardConflict = conflict?.data.reason === "rotation_card_bin_mismatch";
  // The two artist reasons render through NewArtistFields' banner, which
  // points at the fields the server rejected; the snapshot it reads is the
  // conflicted values, not the live drafts, so an edit does not make the
  // banner report the new, unsubmitted value as taken.
  const artistConflict: NewArtistConflict | null =
    conflict !== null && conflict.data.reason !== "rotation_card_bin_mismatch"
      ? {
          code_letters: conflict.typed.code_letters,
          code_number: conflict.typed.code_number,
          name: conflict.typed.name,
          response: conflict.data.artist
            ? {
                artist: {
                  artist_id: conflict.data.artist.id,
                  artist_name: conflict.data.artist.artist_name,
                  code_letters: conflict.data.artist.code_letters,
                },
                ...(conflict.data.reason === "artist_name_conflict"
                  ? { reason: "artist_name_conflict" as const }
                  : {}),
              }
            : null,
        }
      : null;

  // A refused compilation filing renders in the shelf panel: the create
  // panel's banner is not mounted in compilation state, and the bench's
  // named-reason fallback only speaks for a refusal that carried no artist.
  // The panel owns both shapes, so neither goes unstated and neither doubles.
  //
  // The code pair is interpolated from the constants, not from the conflict
  // snapshot: on the `existing` arm the snapshot holds the create-panel
  // drafts, which are empty in compilation state. Every compilation files at
  // the one pair, so the constants are right on both arms.
  const compilationConflict =
    compilationActive && artistConflict !== null
      ? {
          message:
            conflict?.data.reason === "artist_name_conflict"
              ? `${COMPILATION_BUCKET_NAME} already exists in this genre — file under that shelf instead.`
              : artistConflict.response
                ? `${artistConflict.response.artist.artist_name} already holds ${VARIOUS_ARTISTS_CODE_LETTERS} ${VARIOUS_ARTISTS_CODE_NUMBER} in this genre — file under that shelf instead.`
                : `${VARIOUS_ARTISTS_CODE_LETTERS} ${VARIOUS_ARTISTS_CODE_NUMBER} is already taken in this genre.`,
        }
      : null;

  // Discogs resolved a release credited to one artist while the box is checked.
  // Stated rather than acted on: auto-checking follows a fact where nothing was
  // decided, but auto-unchecking would silently undo a decision the MD made —
  // the same line the shelf suggestion holds against an overruled pick. The
  // submit is held because filing this to the V/A shelf is the misfile.
  //
  // Overrulable, because the name is only a heuristic: a DJ mix or an "X
  // Presents" compilation is credited to a person and is still a compilation.
  // Editing the link retracts the credit, which is the remedy the notice names.
  const compilationArtistMismatch =
    compilationActive &&
    prefillArtistName !== null &&
    !isCompilationReleaseArtistName(prefillArtistName);

  // The render guard, not a backstop: entering compilation state leaves
  // `creating` alone, so unchecking restores a half-filled create panel rather
  // than discarding what the MD typed into it.
  const showCreatePanel = creating && selectedArtist === null && !compilationActive;
  const compilationSynonym = isCompilationReleaseArtistName(trimmedArtist);
  const createFieldsReady =
    showCreatePanel &&
    trimmedArtist.length > 0 &&
    // Creating an artist under a compilation synonym would file a near-duplicate
    // of the genre's real shelf, under whatever code letters were suggested for
    // it. The checkbox is the path that resolves the shelf instead.
    !compilationSynonym &&
    trimmedCodeLetters.length > 0 &&
    !codeLettersTooLong &&
    !alphabeticalNameTooLong &&
    // A clean (empty) code number defers to the server's assignment; a dirty
    // draft has to parse and fit the column before it may travel.
    !codeNumberInvalid &&
    // Same duplicate guard as the artist-add form: a name the current genre
    // already files, or one unchecked since the genre moved, must not create.
    dedup.existingArtist === null &&
    !dedup.dedupCheckStale;

  // At least one of `label`/`label_id` is contractually required on the
  // release (AlbumCreateFields); the bench only ever sends `label`, so a blank
  // one is a guaranteed 400 the bench could not name a reason for. Surfaced
  // inline once the rest of the form is ready, so the red field is the one
  // thing between the MD and a submit rather than noise on an empty form.
  const labelMissing = label.trim().length === 0;
  // A settled shelf: the genre's sole bucket, the picked one, or the create
  // arm for a genre with none. `resolving`, `genre-missing` and `unavailable`
  // hold the submit shut — the same fail-closed posture as the card
  // precondition, and for the same reason: acting on an unsettled answer is
  // what files a row nobody can find, or a bucket that already exists.
  const compilationReady =
    compilationActive &&
    !compilationArtistMismatch &&
    (compilation.resolvedArtistId !== null || compilation.outcome === "create");
  const readyExceptLabel =
    !isFiling &&
    conflict === null &&
    genreId !== null &&
    formatId !== null &&
    !listsUnavailable &&
    albumTitle.trim().length > 0 &&
    // The typed name is no part of a compilation filing, so retained or
    // prefilled text over the column's width must not hold the submit shut
    // with nothing on screen to fix.
    (!artistTooLong || compilationActive) &&
    // Scoped, not OR'd: in compilation state the submit builds the compilation
    // arm regardless, so a lingering `selectedArtist` opening this gate would
    // arm a filing on an unsettled lookup — which is the create branch, and so
    // a second bucket beside the one the genre already has.
    (compilationActive
      ? compilationReady
      : selectedArtist !== null || createFieldsReady);

  // A rotation entry has to land on a card. CardPicker resolves the bin's
  // default only after the cards read returns and pushes it up, so `cardId` is
  // null for the whole load window and permanently if that read fails. A write
  // precondition fails closed: submit stays disabled until the card is on hand
  // (the picker's Retry row is the recovery path), never filing a cardless row
  // that would be physically unfindable.
  const cardMissing = bin !== null && cardId === null;

  const canSubmit = readyExceptLabel && !labelMissing && !cardMissing;

  // Editing or replacing the artist reopens either artist-scoped conflict. A
  // name conflict is keyed on the name being edited; a code conflict is
  // cleared here too because in the bench the remedy the contract prescribes —
  // pick the existing artist instead of creating one — begins with editing
  // this field, and `handleArtistSelected` finishing that gesture must not
  // find a code conflict still holding the submit shut. A card mismatch has
  // nothing to do with the artist, so it survives.
  const clearArtistConflict = () => {
    setConflict((current) =>
      current?.data.reason === "rotation_card_bin_mismatch" ? current : null,
    );
  };

  const handleArtistTextChange = (value: string) => {
    setArtistText(value);
    dedup.onNameChange(value);
    clearArtistConflict();
    // Typing over the resolved name ends the resolve's claim on this record.
    setPrefillArtistName(null);
  };

  const handleArtistSelected = (artist: ArtistInGenreOption) => {
    setSelectedArtist(artist);
    setCreating(false);
    // Resolving an artist 409 by picking the existing artist unmounts the
    // create panel and its banner; without clearing the conflict the submit
    // would stay disabled with nothing on screen explaining why.
    clearArtistConflict();
    dedup.onArtistSelected(artist);
  };

  const handleVaCheckedChange = (checked: boolean) => {
    setVaChecked(checked);
    // A pick outlives the box, since the hook keys it on genre alone and the
    // genre does not change here. Left standing, it would outrank the next
    // record's suggestion and arm a filing on the previous record's shelf.
    compilation.clearPick();
    // Unchecking is the answer to a mismatch notice, so the notice goes with
    // it. Checking is not: a resolved single-artist credit still contradicts a
    // box the MD has just ticked, and that is exactly when saying so matters.
    if (!checked) setPrefillArtistName(null);
    if (checked) {
      // The two artist arms never coexist: entering compilation state drops a
      // held selection. `creating` is left alone — the render guard hides the
      // panel, so unchecking gives the MD their typed drafts back.
      setSelectedArtist(null);
      dedup.onSelectionCleared();
    }
    // Either direction unmounts whichever surface owns the artist banner, so a
    // standing refusal has to go with it or the submit locks with nothing on
    // screen explaining why.
    clearArtistConflict();
  };

  const handleSelectionCleared = () => {
    setSelectedArtist(null);
    dedup.onSelectionCleared();
  };

  const handleCompilationRetry = () => {
    // A failed lookup invalidates nothing, so the retry is manual. After a
    // refusal it also has to reopen the submit gate: none of the field
    // handlers that clear a conflict can be reached from inside the panel.
    clearArtistConflict();
    compilation.refetch();
  };

  const handleCreateNew = (searchTerm: string) => {
    setCreating(true);
    setSelectedArtist(null);
    // Seed, don't own: a fresh create intent re-suggests from the current
    // term, and the MD edits freely from there.
    setCodeLettersField({ value: suggestCodeLetters(searchTerm), caret: null });
    dedup.onCreateNewSelected();
  };

  const clearCodeConflict = () => {
    setConflict((current) =>
      current?.data.reason === "artist_code_conflict" ? null : current,
    );
  };

  const handleCodeLettersFieldChange = (next: CodeLettersField) => {
    setCodeLettersField(next);
    clearCodeConflict();
  };

  const handleCodeNumberChange = (value: string) => {
    setCodeNumberRaw(value);
    clearCodeConflict();
  };

  const handleGenreChange = (value: number | null) => {
    setGenreId(value);
    // Every conflict reason that names an artist is genre-scoped, so a genre
    // change reopens the question whatever the reason was.
    setConflict(null);
    dedup.onGenreChange();
  };

  const clearCardConflict = () => {
    setConflict((current) =>
      current?.data.reason === "rotation_card_bin_mismatch" ? null : current,
    );
  };

  const handleBinChange = (nextBin: Rotation | null) => {
    setBin(nextBin);
    // A held card names a card in the previous bin; explicit null hands the
    // picker a cleared selection to re-default rather than a stale one.
    setCardId(null);
    clearCardConflict();
  };

  const handleCardChange = (nextCardId: number | null) => {
    setCardId(nextCardId);
    clearCardConflict();
  };

  const handleAutopopulate = async () => {
    const pasted = discogsUrl.trim();
    if (pasted.length === 0 || isAutofilling || isFiling) {
      return;
    }
    setAutofillError(null);
    try {
      const prefill = await triggerPrefill(pasted).unwrap();
      // Guard the unwrapped payload before touching any state. The endpoint
      // opts out of the base query's non-JSON soft-fail, so today a hard
      // failure rejects rather than resolving `null`; this keeps that true by
      // construction if a future change ever soft-fails again. A nullish
      // payload takes the inline, non-blocking failure path and changes
      // nothing — the destructive success path below (which clears the
      // selected artist and dedup state) must never run on absent data.
      if (prefill == null) {
        setAutofillError(discogsPrefillErrorMessage(null));
        return;
      }
      // The resolved Discogs record is authoritative, so drop any prior
      // typeahead pick and re-key the artist field on the resolved name — the
      // MD then matches-or-creates it the same way a typed name flows.
      setSelectedArtist(null);
      dedup.onSelectionCleared();
      setArtistText(prefill.artist_name);
      dedup.onNameChange(prefill.artist_name);
      clearArtistConflict();
      setAlbumTitle(prefill.album_title);
      setLabel(prefill.label ?? "");
      // A blank credit names nobody, so it can contradict nothing: stored as
      // absent, it cannot latch a notice with an empty name in it.
      setPrefillArtistName(prefill.artist_name.trim() || null);
      // Each resolve is a different record. A pick made for the previous one
      // would outrank this title's suggestion and arm the filing with no
      // gesture — the same hazard the post-filing reset and the checkbox
      // handler already clear, reached by a third route.
      compilation.clearPick();
      // A Discogs credit of "Various" is a fact about the release, not a guess
      // about it, and an unchecked box is the absence of a decision rather than
      // a decision — so this overrules nothing. The reverse is not symmetric:
      // see the mismatch notice, which states the contradiction instead of
      // undoing a choice the MD made.
      if (isCompilationReleaseArtistName(prefill.artist_name)) {
        setVaChecked(true);
      }
      // Record the definitive Discogs link on the release. `urls` is the one
      // release-scoped links channel the composite already carries, so this
      // needs no submission-wiring change; it surfaces in Additional links.
      setUrls((current) => withDefinitiveDiscogsUrl(current, prefill.discogs_release_id));
    } catch (err) {
      // A named 4xx (bad/unresolvable link) is inline and non-blocking: the
      // rest of the form stays exactly as typed and manual entry is unaffected.
      setAutofillError(discogsPrefillErrorMessage(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || genreId === null || formatId === null) {
      return;
    }

    // The compilation arm precedes the typed ones deliberately: in compilation
    // state the create-panel drafts are empty, so falling through to them
    // would file `artist_name: ""`.
    const artist: FilingArtistInput = compilationActive
      ? compilation.resolvedArtistId !== null
        ? { mode: "existing", artistId: compilation.resolvedArtistId }
        : {
            mode: "create",
            artistName: COMPILATION_BUCKET_NAME,
            codeLetters: VARIOUS_ARTISTS_CODE_LETTERS,
            codeNumberRaw: String(VARIOUS_ARTISTS_CODE_NUMBER),
            alphabeticalName: "",
          }
      : selectedArtist !== null
        ? { mode: "existing", artistId: selectedArtist.id }
        : {
            mode: "create",
            artistName: trimmedArtist,
            codeLetters: trimmedCodeLetters,
            codeNumberRaw,
            alphabeticalName,
          };

    const request = buildLibraryFilingRequest({
      artist,
      genreId,
      formatId,
      albumTitle,
      label,
      rotationBin: bin,
      cardId,
      urls,
    });

    setFailed(false);
    try {
      const filed = await fileRelease(request).unwrap();
      setFilings((previous) => [...previous, filed]);
      // Ready for the next record of the batch: the artist and its release
      // clear; genre, label, format, bin and card persist, since an MD files
      // a stack of same-shaped records in one sitting.
      setArtistText("");
      setSelectedArtist(null);
      setCreating(false);
      setCodeLettersField({ value: "", caret: null });
      setCodeNumberRaw("");
      setAlphabeticalName("");
      setAlbumTitle("");
      setUrls([]);
      dedup.reset();
      // The filed record's credit says nothing about the next one.
      setPrefillArtistName(null);
      // The mode persists for the batch, but each record chooses its own
      // shelf: the reset keeps the genre, so a surviving pick would arm the
      // next filing with no gesture. The held answer refreshes itself — the
      // filing invalidates the by-code cache entry this subscription reads.
      compilation.clearPick();
    } catch (err) {
      // fileRelease nests its rejection under `fileReleaseError` to stay out
      // of the shared toast middleware; unwrap the nest before reading it.
      const wrapped =
        err && typeof err === "object" && "fileReleaseError" in err
          ? (err as { fileReleaseError: unknown }).fileReleaseError
          : err;
      if (isLibraryFilingConflict(wrapped)) {
        setConflict({
          data: wrapped.data,
          // The snapshot records what the request actually carried, so a
          // compilation refusal names the canonical literals rather than the
          // empty create-panel drafts.
          typed:
            artist.mode === "create"
              ? {
                  code_letters: artist.codeLetters,
                  code_number: artist.codeNumberRaw.trim(),
                  name: artist.artistName,
                }
              : {
                  code_letters: trimmedCodeLetters,
                  code_number: codeNumberRaw.trim(),
                  name: trimmedArtist,
                },
        });
      } else {
        setFailed(true);
      }
    }
  };

  return (
    <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="flex-start">
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md", flex: 1, maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5}>
            <Sheet variant="soft" sx={{ p: 1.5, borderRadius: "md" }}>
              <FormControl error={autofillError !== null}>
                <FormLabel>Autopopulate with Discogs link</FormLabel>
                <Stack direction="row" spacing={1}>
                  <Input
                    value={discogsUrl}
                    placeholder="https://www.discogs.com/release/…"
                    disabled={isFiling}
                    onChange={(e) => {
                      setDiscogsUrl(e.target.value);
                      if (autofillError !== null) setAutofillError(null);
                      // The resolved credit describes the link that produced
                      // it. Editing the link retracts that claim — which is
                      // what lets an MD overrule the mismatch notice for a
                      // compilation credited to a person.
                      setPrefillArtistName(null);
                    }}
                    sx={{ flexGrow: 1 }}
                  />
                  {/* An untyped button inside a form submits it. */}
                  <Button
                    type="button"
                    variant="solid"
                    loading={isAutofilling}
                    disabled={isFiling || discogsUrl.trim().length === 0}
                    onClick={handleAutopopulate}
                  >
                    Autopopulate
                  </Button>
                </Stack>
                {autofillError !== null ? (
                  <FormHelperText role="alert">{autofillError}</FormHelperText>
                ) : (
                  // A library-only filing (no bin) carries no rotation member, and
                  // buildLibraryFilingRequest drops `urls` with it, so the link is
                  // only actually recorded when a rotation bin is selected — the copy
                  // promises it only then.
                  <FormHelperText>
                    {bin !== null
                      ? "Pulls artist, title, and label from Discogs and records the link on the release."
                      : "Pulls artist, title, and label from Discogs."}{" "}
                    Discogs release links only — other services are follow-ups.
                  </FormHelperText>
                )}
              </FormControl>
            </Sheet>

            <FormControl error={listsUnavailable}>
              <FormLabel>Genre</FormLabel>
              <Select
                placeholder="Select genre..."
                value={genreId}
                disabled={isFiling || genresUnavailable}
                onChange={(_, value) => handleGenreChange(value)}
              >
                {(genresQuery.data ?? []).map((genre) => (
                  <Option key={genre.id} value={genre.id}>
                    {genre.genre_name}
                  </Option>
                ))}
              </Select>
              {listsUnavailable && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} role="alert">
                  <Typography level="body-sm" color="danger">
                    {genresUnavailable ? "Genres" : "Formats"} are unavailable, so nothing
                    can be filed right now.
                  </Typography>
                  {/* An untyped button inside a form submits it. */}
                  <Button
                    type="button"
                    size="sm"
                    variant="plain"
                    loading={genresQuery.isFetching || formatsQuery.isFetching}
                    onClick={() => {
                      genresQuery.refetch();
                      formatsQuery.refetch();
                    }}
                    sx={{ px: 0 }}
                  >
                    Try again
                  </Button>
                </Stack>
              )}
            </FormControl>

            {/* Its own FormControl: a FormControl carries exactly one control,
                and sharing the Artist one hands the checkbox that field's
                label and its error state — so an over-long typed name would
                paint the checkbox red and the label would stop naming the
                field it sits above. */}
            <FormControl>
              <Checkbox
                label="Various Artists compilation"
                checked={vaChecked}
                // Disabled until there is a genre to resolve the shelf against,
                // mirroring the typeahead's own gate.
                disabled={genreId === null || isFiling}
                onChange={(e) => handleVaCheckedChange(e.target.checked)}
              />
            </FormControl>

            <FormControl error={artistTooLong && !compilationActive}>
              <FormLabel>Artist</FormLabel>
              {/* The shelf itself is chosen below the album title, since which
                  shelf a compilation files onto follows from that title. */}
              {!compilationActive && (
                <ArtistSearchTypeahead
                  genreId={genreId ?? -1}
                  value={artistText}
                  onChange={handleArtistTextChange}
                  onSelect={handleArtistSelected}
                  onCreateNew={handleCreateNew}
                  onSelectionCleared={handleSelectionCleared}
                  disabled={genreId === null || isFiling}
                />
              )}
              {compilationArtistMismatch ? (
                <FormHelperText sx={{ color: "danger.500" }} role="alert">
                  Discogs credits this release to {prefillArtistName} — uncheck to
                  file under that artist, or clear the link if this really is a
                  compilation.
                </FormHelperText>
              ) : compilationActive ? (
                <FormHelperText>
                  Filing as a Various Artists compilation — per-track credits are
                  optional and can be added later on the album.
                </FormHelperText>
              ) : artistTooLong ? (
                <FormHelperText>At most {ARTIST_NAME_MAX_LENGTH} characters</FormHelperText>
              ) : showCreatePanel && compilationSynonym ? (
                <FormHelperText sx={{ color: "danger.500" }}>
                  Compilations file through the Various Artists compilation checkbox
                  — check it instead of creating an artist.
                </FormHelperText>
              ) : selectedArtist ? (
                <FormHelperText>
                  Filing under {selectedArtist.artist_name} ({selectedArtist.code_letters}{" "}
                  {selectedArtist.code_number})
                </FormHelperText>
              ) : showCreatePanel && dedup.existingArtist ? (
                <FormHelperText sx={{ color: "danger.500" }}>
                  {dedup.existingArtist.artist_name} already exists in this genre — pick
                  it from the suggestions instead of creating a duplicate.
                </FormHelperText>
              ) : showCreatePanel && dedup.dedupCheckStale ? (
                <FormHelperText sx={{ color: "warning.500" }}>
                  Re-check this name under the new genre: pick the existing artist from
                  the suggestions, or choose &quot;Create new artist&quot;.
                </FormHelperText>
              ) : null}
            </FormControl>

            {showCreatePanel && (
              <Sheet variant="soft" sx={{ p: 1.5, borderRadius: "md" }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  New artist{trimmedArtist ? ` “${trimmedArtist}”` : ""}
                </Typography>
                <NewArtistFields
                  alphabeticalName={alphabeticalName}
                  codeNumberRaw={codeNumberRaw}
                  codeLettersField={codeLettersField}
                  onCodeLettersFieldChange={handleCodeLettersFieldChange}
                  onCodeNumberChange={handleCodeNumberChange}
                  onAlphabeticalNameChange={setAlphabeticalName}
                  genreId={genreId}
                  disabled={isFiling}
                  conflict={artistConflict}
                  autoFillCodeNumber
                  allowZeroCodeNumber
                />
              </Sheet>
            )}

            <FormControl>
              <FormLabel>Album title</FormLabel>
              <Input
                value={albumTitle}
                disabled={isFiling}
                onChange={(e) => setAlbumTitle(e.target.value)}
              />
            </FormControl>

            {compilationActive && (
              <FormControl>
                <FormLabel>Compilation shelf</FormLabel>
                <CompilationBucketPanel
                  outcome={compilation.outcome}
                  owners={compilation.owners}
                  genreName={selectedGenreName}
                  resolvedArtistId={compilation.resolvedArtistId}
                  suggestedArtistId={compilation.suggestedArtistId}
                  onPick={compilation.pick}
                  onRetry={handleCompilationRetry}
                  conflict={compilationConflict}
                  disabled={isFiling}
                />
              </FormControl>
            )}

            <Stack direction="row" spacing={1.5}>
              <FormControl sx={{ flex: 1 }} error={readyExceptLabel && labelMissing}>
                <FormLabel>Label</FormLabel>
                <Input
                  value={label}
                  disabled={isFiling}
                  onChange={(e) => setLabel(e.target.value)}
                />
                {readyExceptLabel && labelMissing && (
                  <FormHelperText>Missing the label</FormHelperText>
                )}
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Format</FormLabel>
                <Select
                  placeholder="Select format..."
                  value={formatId}
                  disabled={isFiling || formatsUnavailable}
                  onChange={(_, value) => setFormatId(value)}
                >
                  {(formatsQuery.data ?? []).map((format) => (
                    <Option key={format.id} value={format.id}>
                      {format.format_name}
                    </Option>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <CatalogRotationBinPicker
              selectedBin={bin}
              onSelectBin={handleBinChange}
              disabled={isFiling}
            />
            {bin === null && (
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Library-only filing — no rotation entry will be created.
              </Typography>
            )}

            {bin !== null && (
              <FormControl error={cardConflict}>
                <FormLabel>Card within {ROTATION_BIN_LABELS[bin]}</FormLabel>
                <CardPicker bin={bin} value={cardId} onChange={handleCardChange} />
                {cardConflict && (
                  <Typography level="body-sm" color="danger" role="alert">
                    That card belongs to a different bin — pick one of the{" "}
                    {ROTATION_BIN_LABELS[bin]} cards.
                  </Typography>
                )}
              </FormControl>
            )}

            {bin !== null && (
              <FormControl>
                <FormLabel>Additional links</FormLabel>
                <UrlListInput value={urls} onChange={setUrls} />
              </FormControl>
            )}

            {/* The named-reason fallback for an artist 409 whose body carried
                no artist to name — NewArtistFields' banner has nobody to
                report, but the refusal still has to be stated. */}
            {artistConflict !== null && artistConflict.response === null && !compilationActive && (
              <Typography level="body-sm" color="danger" role="alert">
                {conflict?.data.reason === "artist_name_conflict"
                  ? "That artist name is already taken in this genre."
                  : "That artist code is already taken in this genre."}
              </Typography>
            )}

            {failed && (
              <Typography level="body-sm" color="danger" role="alert">
                Filing failed — nothing was saved. The filing is all-or-nothing, so
                every field above is still exactly what you typed.
              </Typography>
            )}

            <Button color="success" type="submit" loading={isFiling} disabled={!canSubmit}>
              {bin !== null ? "Add to rotation" : "File to library"}
            </Button>
          </Stack>
        </form>
      </Sheet>

      <FiledThisSession filings={filings} />
    </Stack>
  );
}
