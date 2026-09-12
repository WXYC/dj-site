import { fireEvent } from "@testing-library/react";

/**
 * Puts a value in a field in one event rather than a keystroke per character.
 *
 * Fires a single `change` event and replaces the field's value outright — no
 * key events, so a typeahead or debounce that reacts to keydown/keyup never
 * sees this; no focus, so a focus-driven suggestion list never opens; and it
 * writes straight through `disabled`, `readOnly`, and `maxLength`, none of
 * which `user.type` would. That last point costs something: an assertion
 * about a field being uneditable cannot be made through this helper, since
 * it will write the value regardless. Reach for it when the value is
 * *arrange*, not *subject*: a spec asserting on keystroke-driven behavior (a
 * typeahead opening its listbox, a diacritic round-trip, an append onto an
 * already-typed value) needs `user.type` instead, with a comment saying why.
 */
export function setFieldValue(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}
