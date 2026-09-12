import { fireEvent } from "@testing-library/react";

/**
 * Puts a value in a field in one event rather than a keystroke per character.
 *
 * Fires a single `change` event and replaces the field's value outright — no
 * key events, so a typeahead or debounce that reacts to keydown/keyup never
 * sees this. Reach for it when the value is *arrange*, not *subject*: a spec
 * asserting on keystroke-driven behavior (a typeahead opening its listbox, a
 * diacritic round-trip, an append onto an already-typed value) needs
 * `user.type` instead, with a comment saying why.
 */
export function setFieldValue(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}
