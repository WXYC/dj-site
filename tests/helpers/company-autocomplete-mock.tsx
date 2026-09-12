/** The label the stand-in resolves to, and the only id its callers may assert on. */
export const COMPANY_AUTOCOMPLETE_MATCH = { id: 17, label_name: "Sonamos" };

/**
 * Replacement module for the classic rotation screens'
 * `CompanyAutocomplete`, which has its own dedicated coverage: a bare labelled
 * input plus a button standing in for the moment its search confirms the typed
 * text names an existing label. A spec that mounts it exercises the form's own
 * diff and submit logic rather than the label-search widget.
 *
 * `vi.mock` factories cannot close over imports, so pull this in from inside
 * the factory:
 *
 * ```tsx
 * vi.mock("@/src/components/experiences/classic/rotation/CompanyAutocomplete", async () => {
 *   const { createCompanyAutocompleteMock } = await import(
 *     "@/tests/helpers/company-autocomplete-mock"
 *   );
 *   return createCompanyAutocompleteMock();
 * });
 * ```
 *
 * Import it by path, never through `@/tests/helpers`: the barrel pulls in the
 * Redux store, and a component module has no business in a mock factory's
 * dependency graph.
 */
export function createCompanyAutocompleteMock(match = COMPANY_AUTOCOMPLETE_MATCH) {
  return {
    default: ({
      value,
      onChange,
      onSelect,
      disabled,
    }: {
      value: string;
      onChange: (value: string) => void;
      onSelect: (label: { id: number; label_name: string }) => void;
      disabled?: boolean;
    }) => (
      <>
        <input
          aria-label="Record Label"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" onClick={() => onSelect(match)}>
          match an existing label
        </button>
      </>
    ),
  };
}
