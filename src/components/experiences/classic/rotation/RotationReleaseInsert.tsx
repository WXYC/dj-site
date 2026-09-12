"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotationBin,
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type FreeTextRotationAddRequest,
} from "@/lib/features/rotation/types";
import { useAddFreeTextRotationEntryMutation } from "@/lib/features/rotation/api";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import { rotationReleaseRefusal } from "@/lib/features/rotation/releaseFormValidation";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import CompanyAutocomplete from "./CompanyAutocomplete";

const DEFAULT_BIN = RotationBin.H;

/**
 * Reproduces `rotationReleaseInsert.jsp` -- free-text rotation add, against
 * Backend's relaxed `POST /library/rotation` for a release with no
 * catalogued album.
 *
 * Six of the JSP's fields have no home on Backend's `rotation` table at all
 * (`shared/database/src/schema.ts`: `id`, `album_id`, `rotation_bin`,
 * `add_date`, `kill_date`, `artist_name`, `album_title`, `record_label`, and
 * a handful of server-derived Discogs/LML columns -- nothing else), and are
 * dropped here rather than rendered inert:
 *
 * - **Artist's Alphabetical Name.** No column. On a catalogued row this
 *   value comes from `artists.alphabetical_name`; on an uncatalogued row
 *   there is no `artists` row to hold it, and `PATCH /library/rotation/:id`
 *   explicitly rejects it (`ROTATION_NO_COLUMN_FIELDS` in
 *   `apps/backend/controllers/library.controller.ts`) for exactly that
 *   reason.
 * - **"Additional size info"** (`FORMAT_SIZE`). No column on `rotation`, and
 *   nothing to carry over: the field is populated on none of the rotation
 *   rows that exist.
 * - **Date Added To Rotation** (the JSP's 23-days-back picker). `add_date`
 *   has a column, but `pickAddRotationFields` never reads it from the
 *   request body on `POST`: the controller's own comment states
 *   `add_date` is "post-creation-only" because `POST` always mints a fresh
 *   row and the server stamps `defaultNow()`. There is no field here that
 *   would do anything if rendered.
 * - **CMJ Genres** (hiphop/jazz/loudrock/newworld/rpm) and **Comments**. No
 *   column of any kind ever existed for these on `rotation` -- they are
 *   tubafrenzy-only fields with nowhere to land.
 *
 * The JSP's two "Clear ... Artist ... Field(s)" links are dropped with the
 * alphabetical-name field they only make sense beside.
 *
 * Everything else matches the JSP verbatim: field order, labels, the V/A
 * shortcut, the rotation-type radios (Heavy default), the record-label
 * autocomplete + self-released link, and the validationMessage div's role as
 * the one place a refusal is shown.
 *
 * On success this lands on the record it just created, which is where
 * `rotationRelease?mode=addRotationRelease` lands too.
 */
export default function RotationReleaseInsert() {
  const router = useRouter();
  const presentationNameId = useId();
  const titleId = useId();
  const formatId = useId();

  const [artistPresentationName, setArtistPresentationName] = useState("");
  const [title, setTitle] = useState("");
  const [rotationBin, setRotationBin] = useState<RotationBin>(DEFAULT_BIN);
  const [recordLabel, setRecordLabel] = useState("");
  // The label the typed text resolved to, when it resolved to one at all.
  // Separate from the text because the two can disagree: editing the box
  // after a match un-names the label it matched, and carrying the stale id
  // would file the row under a label whose name is no longer on screen.
  const [recordLabelId, setRecordLabelId] = useState<number | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<number | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const [addFreeTextRotationEntry, { isLoading }] = useAddFreeTextRotationEntryMutation();
  const { data: formats } = useGetFormatsQuery();

  const resetFields = () => {
    setArtistPresentationName("");
    setTitle("");
    setRotationBin(DEFAULT_BIN);
    setRecordLabel("");
    setRecordLabelId(null);
    setSelectedFormatId(null);
    setValidationMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const refusal = rotationReleaseRefusal({
      artistName: artistPresentationName,
      title,
      formatId: selectedFormatId,
    });
    // The second clause is the compiler's, not the rule's: the refusal above
    // has already turned a null format away, but it says so in a sentence
    // rather than in the type, and the body below needs the narrowing.
    if (refusal || selectedFormatId == null) {
      setValidationMessage(refusal);
      return;
    }

    setValidationMessage(null);

    const trimmedLabel = recordLabel.trim();
    const body: FreeTextRotationAddRequest = {
      rotation_bin: rotationBin,
      artist_name: artistPresentationName.trim(),
      album_title: title.trim(),
      // Omitted, not sent as "" -- `pickAddRotationFields` only skips a
      // NULL/absent record_label; an empty string would be picked and
      // written as a blank label rather than leaving the row unlabeled,
      // which is what "self-released" (an empty field) means.
      ...(trimmedLabel !== "" ? { record_label: trimmedLabel } : {}),
      format_id: selectedFormatId,
      // Omitted rather than sent as null: Backend picks this field with
      // `!= null`, so a null would be dropped anyway -- and sending one
      // states a value the form does not have.
      ...(recordLabelId != null ? { label_id: recordLabelId } : {}),
    };

    try {
      const created = await addFreeTextRotationEntry(body).unwrap();
      router.push(`/dashboard/rotation/${created.id}`);
    } catch (err) {
      setValidationMessage(rotationWriteErrorMessage(err, "Failed to add rotation release."));
    }
  };

  return (
    <div>
      <div className="label" style={{ textAlign: "center" }}>
        <Link href="/dashboard/rotation">Rotation Release List</Link>
      </div>

      <form name="recordInfo" onSubmit={handleSubmit}>
        <table cellPadding={5}>
          <tbody>
            <tr>
              <td />
              <td className="title">
                <h3>Add a Release to the rotation database:</h3>
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <span style={{ fontSize: "x-small" }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setArtistPresentationName("Various Artists");
                    }}
                  >
                    Click here to input &apos;Various Artists&apos;
                  </a>
                </span>
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <label htmlFor={presentationNameId}>Artist&apos;s Presentation Name:</label>
              </td>
              <td colSpan={3}>
                <input
                  id={presentationNameId}
                  type="text"
                  value={artistPresentationName}
                  disabled={isLoading}
                  onChange={(e) => setArtistPresentationName(e.target.value)}
                  size={50}
                />
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <label htmlFor={titleId}>Title of Release:</label>
              </td>
              <td colSpan={3}>
                <input
                  id={titleId}
                  type="text"
                  value={title}
                  disabled={isLoading}
                  onChange={(e) => setTitle(e.target.value)}
                  size={100}
                />
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <label htmlFor={formatId}>
                  <b>Format:</b>
                </label>
              </td>
              <td colSpan={3} className="label">
                <select
                  id={formatId}
                  aria-label="Format"
                  value={selectedFormatId ?? ""}
                  disabled={isLoading}
                  onChange={(e) => setSelectedFormatId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- Choose a format --</option>
                  {(formats ?? []).map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.format_name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <b>Rotation:</b>
              </td>
              <td colSpan={3}>
                {ROTATION_BINS.map((bin) => (
                  <span key={bin}>
                    <input
                      type="radio"
                      name="rotationType"
                      value={bin}
                      aria-label={ROTATION_BIN_LABELS[bin]}
                      checked={rotationBin === bin}
                      disabled={isLoading}
                      onChange={() => setRotationBin(bin)}
                    />
                    &nbsp;&nbsp;{ROTATION_BIN_LABELS[bin]}&nbsp;&nbsp;
                  </span>
                ))}
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                Record Label:
              </td>
              <td className="label">
                <CompanyAutocomplete
                  value={recordLabel}
                  onChange={(next) => {
                    setRecordLabel(next);
                    setRecordLabelId(null);
                  }}
                  // Typing a name an existing label already has canonicalizes
                  // to that label's own spelling, so "sonamos" and "Sonamos"
                  // do not become two different `record_label` strings -- and
                  // carries the label's id, so the row normalizes upstream
                  // instead of leaving the text to be matched again later.
                  onSelect={(label) => {
                    setRecordLabel(label.label_name);
                    setRecordLabelId(label.id);
                  }}
                  disabled={isLoading}
                />
                <span style={{ fontSize: "x-small" }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setRecordLabel("");
                      setRecordLabelId(null);
                    }}
                  >
                    self-released
                  </a>
                </span>
              </td>
            </tr>
            <tr>
              <td />
              <td colSpan={2}>
                {/* The live region is always in the DOM, empty until there is
                    something to say. Adding role="alert" at the same moment
                    the text appears is unreliable across screen readers --
                    the region has to exist before its content changes for
                    the change to be announced. */}
                <div
                  className={`validation-message${validationMessage ? " visible" : ""}`}
                  role="alert"
                >
                  {validationMessage}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td colSpan={2}>
                <input type="submit" value="Add this record" disabled={isLoading} />
                <input
                  type="button"
                  value="Reset to default values"
                  onClick={resetFields}
                  disabled={isLoading}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
}
