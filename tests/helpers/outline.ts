import { screen } from "@testing-library/react";

/** The screen's headings in document order as "h<rank> <name>", hidden ones included, so a spec can assert the whole outline: one h2, then h3 sections, no skipped rank. */
export const outline = () => screen.queryAllByRole("heading").map((h) => `${h.tagName.toLowerCase()} ${h.textContent}`);
