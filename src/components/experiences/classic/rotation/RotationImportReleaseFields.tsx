"use client";

import { useId } from "react";
import type { LibraryFormatRow } from "@/lib/features/catalog/types";
import CompanyAutocomplete from "./CompanyAutocomplete";

/** Everything both import forms collect about the release itself. */
export type ReleaseFormState = {
  /**
   * `null` until the librarian types one, which is what lets the field show
   * the next free number the moment the artist's shelf loads without
   * overwriting a number typed while it was still loading.
   */
  codeNumber: string | null;
  volumeLetters: string;
  title: string;
  formatId: number | null;
  /** Only used when the rotation row carries no `label_id` of its own. */
  label: string;
  labelId: number | null;
  alternateArtistName: string;
};

/**
 * `rotationReleaseImport.jsp`'s release rows, shared by the existing-artist
 * form and the create-an-artist one. The JSP repeats them verbatim across its
 * two forms; one component keeps the two from drifting, which matters most
 * for the fields Backend validates differently from how they look here.
 *
 * Two rows are not in the JSP, and each is here for a reason the JSP did not
 * have:
 *
 * - **The in-use advisory under the call number.** The JSP's number is
 *   server-suggested and editable, and nothing checks it. Re-using a lost
 *   record's slot is a deliberate move a single librarian makes, so this
 *   states what it knows and does not refuse: no client-side collision block,
 *   and the eventual enforcement is the database's.
 * - **The Label row, rendered only when the rotation row carries no
 *   `label_id`.** `/wxycdb` normalizes the label at rotation-add and carries
 *   its id through the import, so its form has nothing to ask. dj-site's
 *   rotation rows only started carrying one recently, so the backlog needs
 *   somewhere to supply it — and `POST /library` requires a label one way or
 *   the other.
 */
export default function RotationImportReleaseFields({
  value,
  onChange,
  formats,
  /** `Electronic CHU 12/` — the artist half of the shelf code, when it is known. */
  codePrefix,
  defaultCodeNumber,
  codeInUse,
  needsLabel,
  disabled,
}: {
  value: ReleaseFormState;
  onChange: (patch: Partial<ReleaseFormState>) => void;
  formats: LibraryFormatRow[];
  codePrefix?: string;
  /** Shown until the librarian types a number of their own. */
  defaultCodeNumber: string;
  codeInUse: boolean;
  needsLabel: boolean;
  disabled?: boolean;
}) {
  const codeNumberId = useId();
  const volumeLettersId = useId();
  const titleId = useId();
  const formatFieldId = useId();
  const altArtistId = useId();

  return (
    <>
      <tr>
        <td className="label" style={{ textAlign: "right" }}>
          <label htmlFor={codeNumberId}>{codePrefix ? "Library Code:" : "Release Call Number:"}</label>
        </td>
        <td>
          {codePrefix}
          <input
            id={codeNumberId}
            type="text"
            size={3}
            value={value.codeNumber ?? defaultCodeNumber}
            disabled={disabled}
            onChange={(e) => onChange({ codeNumber: e.target.value })}
          />
          {" - "}
          <input
            id={volumeLettersId}
            type="text"
            aria-label="Volume Letters"
            size={3}
            value={value.volumeLetters}
            disabled={disabled}
            onChange={(e) => onChange({ volumeLetters: e.target.value })}
          />
          {codeInUse && (
            <div role="status" className="validation-message visible">
              That call number is already in use on this artist&apos;s shelf. It will be filed there
              anyway.
            </div>
          )}
        </td>
      </tr>
      <tr>
        <td className="redlabel" style={{ textAlign: "right" }}>
          <label htmlFor={titleId}>Title:</label>
        </td>
        <td>
          <input
            id={titleId}
            type="text"
            size={50}
            value={value.title}
            disabled={disabled}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </td>
      </tr>
      <tr>
        <td className="redlabel" style={{ textAlign: "right" }}>
          <label htmlFor={formatFieldId}>Format:</label>
        </td>
        <td>
          <select
            id={formatFieldId}
            value={value.formatId ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ formatId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">-- Choose a format --</option>
            {formats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.format_name}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {needsLabel && (
        <tr>
          <td className="redlabel" style={{ textAlign: "right" }}>
            Label:
          </td>
          <td>
            <CompanyAutocomplete
              value={value.label}
              onChange={(next) => onChange({ label: next, labelId: null })}
              onSelect={(label) => onChange({ label: label.label_name, labelId: label.id })}
              disabled={disabled}
            />
          </td>
        </tr>
      )}
      <tr>
        <td className="label" style={{ textAlign: "right" }}>
          <label htmlFor={altArtistId}>Alternate Artist Name:</label>
        </td>
        <td>
          <input
            id={altArtistId}
            type="text"
            size={50}
            value={value.alternateArtistName}
            disabled={disabled}
            onChange={(e) => onChange({ alternateArtistName: e.target.value })}
          />
        </td>
      </tr>
    </>
  );
}
