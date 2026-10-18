import { describe, it, expect } from "vitest";
import { editorBack, editorHref, parseEditorOrigin } from "@/lib/features/reviews/paths";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

const MINE = { href: "/dashboard/reviews/mine", label: REVIEW_COPY.editorBack.myReviews };
const SHELF = { href: "/dashboard/reviews", label: REVIEW_COPY.editorBack.shelf };

describe("editorBack", () => {
  it.each([
    ["mine with the open stage", { from: "mine", stage: "open" }, { ...MINE, href: "/dashboard/reviews/mine?stage=open" }],
    ["mine with the submitted stage", { from: "mine", stage: "submitted" }, { ...MINE, href: "/dashboard/reviews/mine?stage=submitted" }],
    ["mine with the published stage", { from: "mine", stage: "published" }, { ...MINE, href: "/dashboard/reviews/mine?stage=published" }],
    ["mine with an unknown stage", { from: "mine", stage: "elsewhere" }, MINE],
    ["mine with no stage", { from: "mine" }, MINE],
    ["shelf", { from: "shelf" }, SHELF],
    ["record with an id", { from: "record", record: "12" }, { href: "/dashboard/admin/intake/12", label: REVIEW_COPY.editorBack.record }],
    ["record with 0", { from: "record", record: "0" }, SHELF],
    ["record with text for an id", { from: "record", record: "abc" }, SHELF],
    ["record with no id", { from: "record" }, SHELF],
    ["no origin", {}, SHELF],
    ["an unknown word", { from: "elsewhere" }, SHELF],
    ["a full URL", { from: "https://example.com" }, SHELF],
  ])("%s", (_name, params, expected) => {
    expect(editorBack(parseEditorOrigin(params))).toEqual(expected);
  });
});

describe("editorHref", () => {
  it.each([
    ["no origin", null, undefined, "/dashboard/reviews/45"],
    ["mine", { from: "mine" } as const, undefined, "/dashboard/reviews/45?from=mine"],
    ["mine with the stage left undefined", { from: "mine", stage: undefined } as const, undefined, "/dashboard/reviews/45?from=mine"],
    ["mine with a stage", { from: "mine", stage: "submitted" } as const, undefined, "/dashboard/reviews/45?from=mine&stage=submitted"],
    ["mine arriving from a request", { from: "mine", stage: "open" } as const, { arrived: "request" }, "/dashboard/reviews/45?from=mine&stage=open&arrived=request"],
    ["shelf", { from: "shelf" } as const, undefined, "/dashboard/reviews/45?from=shelf"],
    ["record", { from: "record", record: 12 } as const, undefined, "/dashboard/reviews/45?from=record&record=12"],
  ])("%s", (_name, origin, extra, href) => {
    expect(editorHref(45, origin, extra)).toBe(href);
  });
});
