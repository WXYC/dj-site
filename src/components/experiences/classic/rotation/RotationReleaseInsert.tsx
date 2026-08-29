"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotationBin, ROTATION_BIN_LABELS, type FreeTextRotationAddRequest } from "@/lib/features/rotation/types";
import { useAddFreeTextRotationEntryMutation } from "@/lib/features/rotation/api";
import { rotationAddErrorMessage } from "@/lib/features/rotation/addErrorMessage";
import CompanyAutocomplete from "./CompanyAutocomplete";

const ROTATION_BINS: RotationBin[] = [RotationBin.H, RotationBin.M, RotationBin.L, RotationBin.S];
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
 * - **Format + "Additional size info".** No column -- format lives on
 *   `library.format_id`, which only exists once a release is catalogued.
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
 * On success there is nowhere JSP-faithful to land: `rotationRelease?mode=
 * addRotationRelease`'s own destination is the record it just created, and
 * that screen (`rotationReleaseModify.jsp`) is a later classic rotation
 * slice, not yet built. This redirects to the list instead.
 */
export default function RotationReleaseInsert() {
  const router = useRouter();
  const presentationNameId = useId();
  const titleId = useId();

  const [artistPresentationName, setArtistPresentationName] = useState("");
  const [title, setTitle] = useState("");
  const [rotationBin, setRotationBin] = useState<RotationBin>(DEFAULT_BIN);
  const [recordLabel, setRecordLabel] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const [addFreeTextRotationEntry, { isLoading }] = useAddFreeTextRotationEntryMutation();

  const resetFields = () => {
    setArtistPresentationName("");
    setTitle("");
    setRotationBin(DEFAULT_BIN);
    setRecordLabel("");
    setValidationMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (artistPresentationName.trim() === "") {
      setValidationMessage("Please enter a presentation name.");
      return;
    }
    if (title.trim() === "") {
      setValidationMessage("Please enter a title.");
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
    };

    try {
      await addFreeTextRotationEntry(body).unwrap();
      router.push("/dashboard/rotation");
    } catch (err) {
      // `addFreeTextRotationEntry`'s `transformErrorResponse` nests the real
      // error under `rotationAddError` (mirroring `labelsApi.searchLabels`)
      // so the shared rejected-query middleware's `payload.data.message`
      // lookup does not find it and double-toast; `.unwrap()` throws exactly
      // that transformed shape, so it is unwrapped one level here before
      // `rotationAddErrorMessage` reads the server's actual message back out.
      const original =
        err && typeof err === "object" && "rotationAddError" in err
          ? (err as { rotationAddError?: unknown }).rotationAddError
          : err;
      setValidationMessage(rotationAddErrorMessage(original));
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
                  onChange={setRecordLabel}
                  onSelect={(label) => setRecordLabel(label.label_name)}
                  onSelectionCleared={() => {
                    // The JSP resets the hidden companyID to its "no id"
                    // sentinel here; this form submits no id at all, so
                    // there is nothing to reset -- the typed text is
                    // already the value that will be sent.
                  }}
                  disabled={isLoading}
                />
                <span style={{ fontSize: "x-small" }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setRecordLabel("");
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
                <div
                  className={`validation-message${validationMessage ? " visible" : ""}`}
                  role={validationMessage ? "alert" : undefined}
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
