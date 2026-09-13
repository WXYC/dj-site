"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  useAddAlbumMutation,
  useAddArtistMutation,
  useGetArtistReleasesQuery,
  useGetFormatsQuery,
  useGetGenresQuery,
  useSearchLibraryArtistsQuery,
} from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { formatEntireLibraryCode } from "@/lib/features/catalog/libraryCode";
import type { AddAlbumRequestBody, ArtistSearchMatch } from "@/lib/features/catalog/types";
import {
  useGetRotationRowQuery,
  useLazyGetRotationRowQuery,
  useLinkRotationToAlbumMutation,
} from "@/lib/features/rotation/api";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { artistShelfCode, suggestCallLetters } from "@/lib/features/rotation/importSuggestions";
import {
  FORMAT_REQUIRED_MESSAGE,
  PRESENTATION_NAME_REQUIRED_MESSAGE,
  TITLE_REQUIRED_MESSAGE,
} from "@/lib/features/rotation/releaseFormValidation";
import {
  runRotationImport,
  type ImportOutcome,
  type ImportRequest,
} from "@/lib/features/rotation/importSubmit";
import { ROTATION_BIN_LABELS } from "@/lib/features/rotation/types";
import RotationImportArtistMatch from "./RotationImportArtistMatch";
import {
  RotationImportNewArtistForm,
  RotationImportReleaseForm,
  type NewArtistFormState,
} from "./RotationImportForms";
import {
  RotationImportCreatedNotLinked,
  RotationImportLinkConflict,
} from "./RotationImportRecovery";
import type { ReleaseFormState } from "./RotationImportReleaseFields";

const IMPORT_QUEUE_HREF = "/dashboard/rotation?status=uncataloged";

/**
 * The widest window `GET /library/artists/search` will open. The service
 * clamps into 1..20, but only for values it reads as numbers — a zero or a
 * negative falls back to the default of 10 — so there is no arg here that
 * means "fewer". Rows are per (artist, genre) membership, so a many-genre
 * artist can still crowd the window; accepted at this catalog's size.
 */
const ARTIST_MATCH_LIMIT = 20;

/** The page size the release table is walked in, matching Backend's own ceiling. */
const RELEASE_PAGE_LIMIT = 100;

const EMPTY_RELEASE: ReleaseFormState = {
  codeNumber: null,
  volumeLetters: "",
  title: "",
  formatId: null,
  label: "",
  labelId: null,
  alternateArtistName: "",
};

function ImportNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
      {children}
    </p>
  );
}

function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/**
 * Reproduces `rotationReleaseImport.jsp` and the
 * `rotationReleaseImportNewArtist.jsp` it includes: the rotation release's own
 * snapshot, the library artists whose names match it, and the form that
 * catalogs the release under one of them — or under a library code this
 * screen mints.
 *
 * Three divergences from the JSP, none in layout:
 *
 * - The summary's label column is `<th scope="row">` where the JSP uses a
 *   bolded `<td>`. Same rendering, and it is what makes each value announce
 *   with the field it belongs to.
 * - Format shows a name resolved client-side from the formats list, and shows
 *   nothing when that list cannot name it. The rotation row carries
 *   `format_id` and no name: the read is join-free by design, because these
 *   are the row's own pre-catalog fields rather than a linked release's, and
 *   printing the raw id would read as a format called "3".
 * - The CMJ genre flags the JSP seeds its genre select from have no column on
 *   Backend's `rotation`, so the select opens unchosen rather than defaulting
 *   to Rock on no evidence.
 */
export default function RotationImportScreen({ rotationId }: { rotationId: number }) {
  const router = useRouter();
  const summaryHeadingId = useId();

  const { data: row, isLoading, isError, error } = useGetRotationRowQuery(rotationId);
  const { data: formats } = useGetFormatsQuery();
  const { data: genres } = useGetGenresQuery();

  const artistName = row?.artist_name ?? "";
  const search = useSearchLibraryArtistsQuery(
    { q: artistName, limit: ARTIST_MATCH_LIMIT },
    { skip: artistName.trim().length < 2 },
  );
  const matches = useMemo(() => search.data?.artists ?? [], [search.data]);

  // The JSP auto-selects a lone match and offers "Choose a different artist"
  // to get back to the list; `showAll` is that link's own `showAll=true`.
  const [chosen, setChosen] = useState<ArtistSearchMatch | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selected = chosen ?? (matches.length === 1 && !showAll ? matches[0] : null);

  const [release, setRelease] = useState<ReleaseFormState>(EMPTY_RELEASE);
  const [newArtist, setNewArtist] = useState<NewArtistFormState>({
    genreId: null,
    callLetters: "",
    callNumbers: "",
    presentationName: "",
    alphabeticalName: "",
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [staleRefusal, setStaleRefusal] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const [readRotationRow] = useLazyGetRotationRowQuery();
  const [addArtist] = useAddArtistMutation();
  const [addAlbum] = useAddAlbumMutation();
  const [linkRotationToAlbum] = useLinkRotationToAlbumMutation();

  // The artist's existing shelf, for the next free call number and the
  // in-use advisory. Walked to its last page because the table is ordered by
  // code number ascending, so only the last page carries the maximum.
  const firstPage = useGetArtistReleasesQuery(
    { artistId: selected?.id ?? 0, page: 0, limit: RELEASE_PAGE_LIMIT },
    { skip: selected == null },
  );
  const lastPageIndex = Math.max(0, (firstPage.data?.totalPages ?? 1) - 1);
  const lastPage = useGetArtistReleasesQuery(
    { artistId: selected?.id ?? 0, page: lastPageIndex, limit: RELEASE_PAGE_LIMIT },
    { skip: selected == null || lastPageIndex === 0 },
  );
  const shelf = (lastPageIndex === 0 ? firstPage.data?.releases : lastPage.data?.releases) ?? [];
  const nextCodeNumber = shelf.length
    ? Math.max(...shelf.map((entry) => entry.code_number)) + 1
    : 1;

  // Seeded from the rotation row rather than left blank: these screens are
  // confirmation surfaces, and a librarian re-typing a title the row already
  // holds is the failure mode, not the design. Re-seeded whenever the branch
  // changes, keyed on what was seeded for, so an edit survives a re-render
  // but a different artist choice starts from that artist's own next number.
  const seedKey = `${row?.id ?? ""}:${selected?.id ?? "new"}`;
  if (row != null && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setRelease({
      ...EMPTY_RELEASE,
      title: row.album_title ?? "",
      formatId: row.format_id ?? null,
      label: row.record_label ?? "",
    });
    setNewArtist({
      genreId: null,
      callLetters: suggestCallLetters(row.artist_name),
      callNumbers: "",
      presentationName: row.artist_name ?? "",
      alphabeticalName: row.artist_name ?? "",
    });
    setValidationMessage(null);
  }

  if (isLoading) return <Chrome>{<p style={{ textAlign: "center" }}>Loading...</p>}</Chrome>;

  if (row == null) {
    const status = isError ? (error as { status?: unknown } | undefined)?.status : undefined;
    return (
      <Chrome>
        <ImportNotice>
          {status === 404
            ? "This rotation release is no longer in the queue."
            : "This rotation release is unavailable right now."}
        </ImportNotice>
      </Chrome>
    );
  }

  // Skipped once a submit has been refused for staleness: at that point the
  // screen's job is to explain the refusal with the form still filled in, not
  // to re-render as though the librarian had just arrived at a linked row.
  if (row.album_id != null && !staleRefusal) {
    return (
      <Chrome>
        <ImportNotice>
          This rotation release has already been catalogued.{" "}
          <Link href={IMPORT_QUEUE_HREF}>Back to Import Queue</Link>
        </ImportNotice>
      </Chrome>
    );
  }

  if (outcome?.kind === "link-failed") {
    return (
      <Chrome>
        <RotationImportCreatedNotLinked
          rotationId={rotationId}
          created={outcome.created}
          linkError={outcome.error}
          onLinked={() => router.push(IMPORT_QUEUE_HREF)}
          onAlreadyLinked={() => setOutcome({ kind: "already-linked", created: outcome.created })}
        />
      </Chrome>
    );
  }

  if (outcome?.kind === "already-linked") {
    return (
      <Chrome>
        <RotationImportLinkConflict
          rotationId={rotationId}
          created={outcome.created}
          onDeleted={() => router.push(IMPORT_QUEUE_HREF)}
        />
      </Chrome>
    );
  }

  const formatName = formats?.find((format) => format.id === row.format_id)?.format_name ?? "";
  const needsLabel = row.label_id == null;
  const defaultCodeNumber = String(selected ? nextCodeNumber : 1);
  const codeNumberValue = parsePositiveInt(release.codeNumber ?? defaultCodeNumber);
  const codeInUse =
    codeNumberValue != null && shelf.some((entry) => entry.code_number === codeNumberValue);

  const validateRelease = (): string | null => {
    if (release.title.trim() === "") return TITLE_REQUIRED_MESSAGE;
    if (release.formatId == null) return FORMAT_REQUIRED_MESSAGE;
    if (codeNumberValue == null) return "Please enter a call number.";
    if (needsLabel && release.label.trim() === "" && release.labelId == null) {
      return "Please enter a record label name, or click 'self-released'.";
    }
    return null;
  };

  /**
   * The label half of `POST /library`. Three states, and they are not
   * interchangeable: the rotation row's own `label_id` is carried silently
   * when it has one, a label the autocomplete resolved is sent as its id, and
   * anything else is sent as text under `label` — `POST /library`'s own field
   * name. `record_label` belongs to the rotation-add endpoint and would 400
   * here. Nothing ever sends `label_id: null`: Backend reads a null as absent
   * on this path, so it would state a value the form does not have.
   */
  const labelFields = (): Pick<AddAlbumRequestBody, "label" | "label_id"> => {
    if (row.label_id != null) return { label_id: row.label_id };
    if (release.labelId != null) return { label_id: release.labelId };
    return { label: release.label.trim() };
  };

  const submit = async (request: ImportRequest) => {
    setSubmitting(true);
    setValidationMessage(null);
    try {
      const result = await runRotationImport(request, {
        readRotationRow: (id) => readRotationRow(id).unwrap(),
        createArtist: (body) => addArtist(body).unwrap(),
        createAlbum: (body) => addAlbum(body).unwrap(),
        linkRotation: (args) => linkRotationToAlbum(args).unwrap(),
        composeLibraryCode: ({ codeNumber, codeVolumeLetters }) =>
          formatEntireLibraryCode({
            genreName: request.newArtist
              ? genres?.find((genre) => genre.id === request.newArtist?.genre_id)?.genre_name
              : (selected?.genre_name ?? undefined),
            code_letters: request.codeLetters,
            code_artist_number: request.newArtist?.code_number ?? selected?.code_number ?? null,
            genre_id: request.album.genre_id,
            code_number: codeNumber ?? 0,
            code_volume_letters: codeVolumeLetters ?? null,
          }),
      });

      if (result.kind === "linked") {
        router.push(
          `${artistCardHref({ id: result.artistId, code_letters: result.codeLetters })}` +
            `?imported=${result.rotationId}` +
            (result.codeNumber != null ? `&code=${result.codeNumber}` : "") +
            (result.codeVolumeLetters ? `&vol=${encodeURIComponent(result.codeVolumeLetters)}` : ""),
        );
        return;
      }
      if (result.kind === "stale") {
        setStaleRefusal(true);
        setValidationMessage(
          "This rotation release was catalogued while this form was open, so nothing was created. Reload to see where it was filed.",
        );
        return;
      }
      if (result.kind === "unchecked") {
        setValidationMessage(
          "Could not check whether this rotation release has already been catalogued, so nothing was created. Try again.",
        );
        return;
      }
      if (result.kind === "artist-failed") {
        setValidationMessage(addArtistFailureMessage(result.error));
        return;
      }
      if (result.kind === "album-failed") {
        setValidationMessage(
          result.createdArtist
            ? "The library code was created, but the release was not. Choose that artist above and add the release to it — do not create the artist again."
            : "The release could not be created, so nothing was changed.",
        );
        return;
      }
      setOutcome(result);
    } finally {
      setSubmitting(false);
    }
  };

  const submitExisting = () => {
    const message = validateRelease();
    if (message) {
      setValidationMessage(message);
      return;
    }
    if (!selected) return;
    void submit({
      rotationId,
      artistName: selected.artist_name,
      albumTitle: release.title.trim(),
      artistId: selected.id,
      codeLetters: selected.code_letters,
      album: {
        genre_id: selected.genre_id ?? 0,
        format_id: release.formatId as number,
        code_number: codeNumberValue as number,
        ...(release.volumeLetters.trim() !== ""
          ? { code_volume_letters: release.volumeLetters.trim() }
          : {}),
        ...(release.alternateArtistName.trim() !== ""
          ? { alternate_artist_name: release.alternateArtistName.trim() }
          : {}),
        ...labelFields(),
      },
    });
  };

  const submitNewArtist = () => {
    if (newArtist.presentationName.trim() === "") {
      setValidationMessage(PRESENTATION_NAME_REQUIRED_MESSAGE);
      return;
    }
    if (newArtist.genreId == null) {
      setValidationMessage("You must select a genre.");
      return;
    }
    if (newArtist.callLetters.trim() === "") {
      setValidationMessage("You must enter call letters.");
      return;
    }
    const artistCodeNumber = parsePositiveInt(newArtist.callNumbers);
    if (artistCodeNumber == null) {
      setValidationMessage("You must enter a code number.");
      return;
    }
    const message = validateRelease();
    if (message) {
      setValidationMessage(message);
      return;
    }
    void submit({
      rotationId,
      artistName: newArtist.presentationName.trim(),
      albumTitle: release.title.trim(),
      codeLetters: newArtist.callLetters.trim(),
      newArtist: {
        artist_name: newArtist.presentationName.trim(),
        alphabetical_name: newArtist.alphabeticalName.trim() || newArtist.presentationName.trim(),
        code_letters: newArtist.callLetters.trim(),
        genre_id: newArtist.genreId,
        code_number: artistCodeNumber,
      },
      album: {
        genre_id: newArtist.genreId,
        format_id: release.formatId as number,
        code_number: codeNumberValue as number,
        ...(release.volumeLetters.trim() !== ""
          ? { code_volume_letters: release.volumeLetters.trim() }
          : {}),
        ...(release.alternateArtistName.trim() !== ""
          ? { alternate_artist_name: release.alternateArtistName.trim() }
          : {}),
        ...labelFields(),
      },
    });
  };

  return (
    <Chrome>
      <table
        className="entry-table"
        style={{ maxWidth: 500, margin: "0 auto" }}
        aria-labelledby={summaryHeadingId}
      >
        <tbody>
          <tr className="entry-header">
            <th colSpan={2} id={summaryHeadingId} style={{ textAlign: "center" }}>
              Rotation Release
            </th>
          </tr>
          {(
            [
              ["Artist:", row.artist_name ?? ""],
              ["Title:", row.album_title ?? ""],
              ["Label:", row.record_label ?? ""],
              ["Format:", formatName],
              ["Rotation:", ROTATION_BIN_LABELS[row.rotation_bin]],
              ["Added:", formatRotationDate(row.add_date)],
              ["Killed:", formatRotationDate(row.kill_date)],
            ] as const
          ).map(([label, value], index) => (
            <tr key={label} className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}>
              <th scope="row" style={{ textAlign: "right", width: 100 }}>
                {label}
              </th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected ? (
        <RotationImportReleaseForm
          artistLabel={`${artistShelfCode(selected)} — ${selected.artist_name}`}
          codePrefix={artistShelfCode(selected)}
          release={release}
          onReleaseChange={(patch) => setRelease((prev) => ({ ...prev, ...patch }))}
          formats={formats ?? []}
          defaultCodeNumber={defaultCodeNumber}
          codeInUse={codeInUse}
          needsLabel={needsLabel}
          validationMessage={validationMessage}
          submitting={submitting}
          onChooseDifferentArtist={() => {
            setChosen(null);
            setShowAll(true);
          }}
          onSubmit={submitExisting}
        />
      ) : (
        <>
          <RotationImportArtistMatch
            artistName={artistName}
            matches={matches}
            isLoading={search.isLoading}
            isError={search.isError && search.data == null}
            onRetry={() => search.refetch()}
            onSelect={setChosen}
          />
          <RotationImportNewArtistForm
            artist={newArtist}
            onArtistChange={(patch) => setNewArtist((prev) => ({ ...prev, ...patch }))}
            release={release}
            onReleaseChange={(patch) => setRelease((prev) => ({ ...prev, ...patch }))}
            genres={genres ?? []}
            formats={formats ?? []}
            defaultCodeNumber={defaultCodeNumber}
            codeInUse={codeInUse}
            needsLabel={needsLabel}
            validationMessage={validationMessage}
            submitting={submitting}
            onSubmit={submitNewArtist}
          />
        </>
      )}
    </Chrome>
  );
}

/** `rotationReleaseImport.jsp`'s header links and heading. */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="label" style={{ textAlign: "center", padding: "10px 0" }}>
        <Link href={IMPORT_QUEUE_HREF}>Back to Import Queue</Link>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <Link href="/dashboard/rotation">All Rotation Releases</Link>
      </div>

      <h3 style={{ textAlign: "center", margin: "5px 0 15px 0" }}>Import Rotation Release to Library</h3>

      {children}
    </div>
  );
}

/**
 * The artist step's refusal, reusing the discrimination the classic
 * new-artist form already owns: a taken code triple is fixed by picking a
 * different one, but a genre-scoped name match means the artist is already in
 * the library and the remedy is to file under it — which this screen offers
 * directly, in its match table above.
 */
function addArtistFailureMessage(err: unknown): string {
  const data = (err as { data?: { artist?: { artist_name?: string }; reason?: string } } | undefined)
    ?.data;
  const name = data?.artist?.artist_name;
  if (!name) return "The library code could not be created, so nothing was changed.";
  return data?.reason === "artist_name_conflict"
    ? `${name} already exists in this genre. Choose it above and file the release under it instead of creating a second library code.`
    : `${name} already holds that library code. Pick a different call number.`;
}
