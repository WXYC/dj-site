"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import type { Label } from "@/lib/features/labels/types";
import { useGetRotationRowQuery, useUpdateRotationRowMutation } from "@/lib/features/rotation/api";
import { dateOptions, killDateOptions } from "@/lib/features/rotation/classicList";
import {
  LABEL_NOT_CLEARABLE_MESSAGE,
  NOTHING_CHANGED_MESSAGE,
  rotationReleaseRefusal,
} from "@/lib/features/rotation/releaseFormValidation";
import {
  ROTATION_BIN_LABELS,
  type RotationRowSummary,
  type UpdateRotationArgs,
} from "@/lib/features/rotation/types";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import CompanyAutocomplete from "./CompanyAutocomplete";

type RotationEdits = Omit<UpdateRotationArgs, "rotation_id">;

type FormState = {
  artistName: string;
  title: string;
  formatId: number | null;
  recordLabel: string;
  /** The label the typed text resolved to, when it resolved to one at all. */
  recordLabelId: number | null;
  addDate: string;
  /** `""` is the JSP's NONE option — no kill date. */
  killDate: string;
};

/**
 * `baseline` is the snapshot the form was seeded from, and the only thing the
 * diff below compares against — never the live query result, which moves under
 * a form someone still has open: a librarian correcting an add date while a
 * second one kills the row would otherwise send `kill_date: null` for a field
 * he never touched. A successful save advances it to what it just wrote.
 */
type Editing = {
  baseline: FormState;
  form: FormState;
  message: { kind: "status" | "error"; text: string } | null;
};

function seedFrom(row: RotationRowSummary): FormState {
  return {
    artistName: row.artist_name ?? "",
    title: row.album_title ?? "",
    formatId: row.format_id ?? null,
    recordLabel: row.record_label ?? "",
    recordLabelId: row.label_id ?? null,
    addDate: row.add_date,
    killDate: row.kill_date ?? "",
  };
}

/**
 * A patch that changes nothing returns the same state, so React bails out
 * rather than re-rendering: the label autocomplete resolves a search from an
 * effect keyed on the callback this screen hands it, and a re-render recreates
 * that callback, which re-runs the effect.
 */
function applyPatch(state: Editing, patch: Partial<FormState>): Editing {
  const changed = (Object.keys(patch) as (keyof FormState)[]).some(
    (key) => patch[key] !== state.form[key],
  );
  if (!changed) return state;
  return { ...state, form: { ...state.form, ...patch }, message: null };
}

/**
 * The keys whose value the form now disagrees with its baseline about — the
 * whole body, since the endpoint SETs only the keys it receives. Sending the
 * unchanged fields too would refuse the whole edit on a catalogued row, where
 * the five pre-catalog fields are the library release's to own.
 */
function rotationEdits(baseline: FormState, form: FormState): RotationEdits {
  const edits: RotationEdits = {};
  const artistName = form.artistName.trim();
  const title = form.title.trim();
  const recordLabel = form.recordLabel.trim();
  if (artistName !== baseline.artistName.trim()) edits.artist_name = artistName;
  if (title !== baseline.title.trim()) edits.album_title = title;
  if (recordLabel !== baseline.recordLabel.trim()) edits.record_label = recordLabel;
  if (form.recordLabelId !== baseline.recordLabelId) edits.label_id = form.recordLabelId;
  if (form.formatId !== baseline.formatId) edits.format_id = form.formatId;
  if (form.addDate !== baseline.addDate) edits.add_date = form.addDate;
  if (form.killDate !== baseline.killDate) edits.kill_date = form.killDate || null;
  return edits;
}

/**
 * The shared rules only apply where the field can still be written: the trio
 * arrives empty on a catalogued row by design, so requiring a presentation
 * name there would refuse every date edit.
 */
function refusal(catalogued: boolean, baseline: FormState, form: FormState, edits: RotationEdits) {
  if (!catalogued) {
    const required = rotationReleaseRefusal({
      artistName: form.artistName,
      title: form.title,
      formatId: edits.format_id,
    });
    if (required) return required;
    if (baseline.recordLabel !== "" && form.recordLabel.trim() === "") {
      return LABEL_NOT_CLEARABLE_MESSAGE;
    }
  }
  if (Object.keys(edits).length === 0) return NOTHING_CHANGED_MESSAGE;
  return null;
}

/**
 * Reproduces `rotationReleaseModify.jsp` — the field-level editor for one
 * rotation release, reached from the Edit link on the rotation list.
 *
 * Six of the JSP's fields have no writable home on `PATCH
 * /library/rotation/:id` and are dropped rather than rendered inert: the
 * artist's alphabetical name and the format's "additional size info" are
 * rejected by name (neither has a `rotation` column, and the alphabetical name
 * on a catalogued row belongs to the `artists` row), the CMJ genre checkboxes
 * and the rotation comment never had a column of any kind, and the Discogs
 * link is a server-derived column no rotation read even publishes. The two
 * "Clear … Artist … Field(s)" links go with the alphabetical-name field they
 * operate on, and "self-released" with the record label's missing clearing
 * value.
 *
 * The **rotation bin** is neither droppable nor offerable — a real column with
 * a real value that no endpoint can write — so it is stated as text in the
 * JSP's own row position rather than as radios that report success and move
 * nothing.
 *
 * The JSP's **second form**, the label/company record's own fields, is out of
 * scope by decision rather than by contract: label administration is not part
 * of the classic librarian surface and `lib/features/labels/api.ts` is
 * search-only. Company *selection* stays.
 */
export default function RotationReleaseModify({ rotationId }: { rotationId: number }) {
  const presentationNameId = useId();
  const titleId = useId();
  const formatFieldId = useId();

  const { data: row, isLoading, isError, error } = useGetRotationRowQuery(rotationId);
  const formatsQuery = useGetFormatsQuery();
  const [updateRotationRow, { isLoading: isSaving }] = useUpdateRotationRowMutation();

  const [editing, setEditing] = useState<Editing | null>(null);

  const update = useCallback((patch: Partial<FormState>) => {
    setEditing((prev) => (prev == null ? prev : applyPatch(prev, patch)));
  }, []);

  // Editing the text un-names whatever label it matched, and carrying the
  // stale id would file the row under a label whose name is no longer on screen.
  const editLabelText = useCallback(
    (next: string) => update({ recordLabel: next, recordLabelId: null }),
    [update],
  );

  // A search that only confirms the text the row arrived with has found
  // nothing to write. Left unguarded, the search this screen runs on mount
  // stages a `label_id` — and, where the labels row is spelled differently, a
  // `record_label` rewrite — that nobody typed, which a later kill-date save
  // would carry along and a catalogued row would refuse outright.
  const resolveLabel = useCallback((label: Label) => {
    setEditing((prev) =>
      prev == null || prev.form.recordLabel === prev.baseline.recordLabel
        ? prev
        : applyPatch(prev, { recordLabel: label.label_name, recordLabelId: label.id }),
    );
  }, []);

  // Rebuilt only when the stored date changes, so "today" cannot move between
  // renders: `recentRotationDates` reads the clock each time it is called.
  const addDateOptions = useMemo(() => dateOptions(row?.add_date), [row?.add_date]);
  const removeDateOptions = useMemo(() => killDateOptions(row?.kill_date), [row?.kill_date]);

  // Seeded from the row rather than left blank: this is a correction surface,
  // and a librarian re-typing what the row already holds is the failure mode.
  // Seeded once, so a later read cannot overwrite the form under the person
  // still looking at it; the route keys this component on the rotation id, so
  // a different row arrives as a fresh mount.
  if (row != null && editing == null) {
    const seeded = seedFrom(row);
    setEditing({ baseline: seeded, form: seeded, message: null });
  }

  if (isLoading) return <Chrome>Loading...</Chrome>;

  if (row == null) {
    const status = isError ? (error as { status?: unknown } | undefined)?.status : undefined;
    return (
      <Chrome>
        <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
          {status === 404
            ? "There is no such rotation release."
            : "This rotation release is unavailable right now."}
        </p>
      </Chrome>
    );
  }

  // The render in which the row first arrives schedules the seed above and
  // re-renders immediately; `editing` is still its pre-seed value in this pass.
  if (editing == null) return <Chrome>Loading...</Chrome>;

  const { baseline, form, message } = editing;
  const catalogued = row.album_id != null;
  // The same absence-of-list predicate the genre selects use: an unissued or
  // failed request would otherwise read as "this release has no format", and
  // no format could be picked from the empty list anyway.
  const formatsUnavailable = isGenresUnavailable(formatsQuery);

  const say = (next: Editing["message"]) =>
    setEditing((prev) => (prev == null ? prev : { ...prev, message: next }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const edits = rotationEdits(baseline, form);
    const refused = refusal(catalogued, baseline, form, edits);
    if (refused) {
      say({ kind: "error", text: refused });
      return;
    }
    try {
      await updateRotationRow({ rotation_id: rotationId, ...edits }).unwrap();
      setEditing({
        baseline: form,
        form,
        message: { kind: "status", text: "This rotation release was modified." },
      });
    } catch (err) {
      say({
        kind: "error",
        text: rotationWriteErrorMessage(err, "Failed to modify this rotation release."),
      });
    }
  };

  return (
    <Chrome>
      {message?.kind === "status" && (
        <div className="label" role="status" style={{ textAlign: "center", margin: "8px 0" }}>
          {message.text}
        </div>
      )}

      <form name="recordInfo" onSubmit={handleSubmit}>
        <table cellPadding={5}>
          <tbody>
            <tr>
              <td />
              <td className="title">
                <h3>Modify a Release in the rotation database:</h3>
              </td>
            </tr>
            {catalogued && (
              <tr>
                <td />
                <td className="smalllabel">
                  <span role="status">
                    This release is already catalogued, so its artist, title, format and label belong
                    to the library release and are edited there. Only the two dates below can be
                    changed here.{" "}
                    <Link href={`/dashboard/library/release/${row.album_id}`}>
                      Edit the library release
                    </Link>
                  </span>
                </td>
              </tr>
            )}
            {/* Withheld on a catalogued row with the field it writes into. */}
            {!catalogued && (
              <tr>
                <td />
                <td>
                  <span style={{ fontSize: "x-small" }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        update({ artistName: "Various Artists" });
                      }}
                    >
                      Click here to input &apos;Various Artists&apos;
                    </a>
                  </span>
                </td>
              </tr>
            )}
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <label htmlFor={presentationNameId}>Artist&apos;s Presentation Name:</label>
              </td>
              <td colSpan={3}>
                <input
                  id={presentationNameId}
                  type="text"
                  value={form.artistName}
                  disabled={isSaving || catalogued}
                  onChange={(e) => update({ artistName: e.target.value })}
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
                  value={form.title}
                  disabled={isSaving || catalogued}
                  onChange={(e) => update({ title: e.target.value })}
                  size={100}
                />
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <label htmlFor={formatFieldId}>
                  <b>Format:</b>
                </label>
              </td>
              <td colSpan={3} className="label">
                <select
                  id={formatFieldId}
                  aria-label="Format"
                  value={form.formatId ?? ""}
                  disabled={isSaving || catalogued || formatsUnavailable}
                  onChange={(e) => update({ formatId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">-- Choose a format --</option>
                  {(formatsQuery.data ?? []).map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.format_name}
                    </option>
                  ))}
                </select>
                {formatsUnavailable && (
                  <span role="alert" className="artist-error-message">
                    Formats are unavailable right now, so this release&apos;s format can&apos;t be
                    shown or changed.
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                <b>Rotation:</b>
              </td>
              <td colSpan={3} className="label">
                {ROTATION_BIN_LABELS[row.rotation_bin]}
                <span style={{ fontSize: "x-small" }}>
                  &nbsp;&nbsp;(the rotation bin cannot be changed here — no endpoint moves a release
                  between bins)
                </span>
              </td>
            </tr>
            <tr>
              <td className="redlabel" style={{ textAlign: "right" }}>
                Record Label:
              </td>
              <td className="label">
                <CompanyAutocomplete
                  value={form.recordLabel}
                  onChange={editLabelText}
                  onSelect={resolveLabel}
                  disabled={isSaving || catalogued}
                />
              </td>
            </tr>
            <tr>
              <td className="label" style={{ textAlign: "right" }}>
                Date Added To Rotation:
              </td>
              <td colSpan={2} className="label">
                <DateSelect
                  label="Date Added To Rotation"
                  value={form.addDate}
                  options={addDateOptions}
                  disabled={isSaving}
                  onChange={(value) => update({ addDate: value })}
                />
              </td>
            </tr>
            <tr>
              <td className="label" style={{ textAlign: "right" }}>
                Date Removed From Rotation:
              </td>
              <td colSpan={2} className="label">
                <DateSelect
                  label="Date Removed From Rotation"
                  value={form.killDate}
                  options={removeDateOptions}
                  disabled={isSaving}
                  onChange={(value) => update({ killDate: value })}
                />
              </td>
            </tr>
            <tr>
              <td />
              <td colSpan={2}>
                {/* The live region is always in the DOM, empty until there is
                    something to say: adding role="alert" at the same moment
                    the text appears is unreliable across screen readers. */}
                <div
                  className={`validation-message${message?.kind === "error" ? " visible" : ""}`}
                  role="alert"
                >
                  {message?.kind === "error" ? message.text : null}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td colSpan={2}>
                <input type="submit" value="Modify this record" disabled={isSaving} />
                <input
                  type="button"
                  value="Reset to current values"
                  disabled={isSaving}
                  onClick={() =>
                    setEditing((prev) =>
                      prev == null ? prev : { ...prev, form: prev.baseline, message: null },
                    )
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <p>
        <Link href="/dashboard/rotation/new">Add a Rotation Release</Link>
      </p>
    </Chrome>
  );
}

/** One of the JSP's two day pickers. */
function DateSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * `rotationReleaseModify.jsp`'s header links. Its "Format Tallysheets" and
 * "Undo Last Change" entries are dropped: no tallysheet screen exists here,
 * and no endpoint reverses a rotation write, so both would be dead controls
 * rather than working ones under a different name.
 */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="label" style={{ textAlign: "center", padding: "10px 0" }}>
        <Link href="/dashboard/rotation">Rotation Release List</Link>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <Link href="/dashboard/rotation/new">Add Rotation Release</Link>
      </div>
      {children}
    </div>
  );
}
