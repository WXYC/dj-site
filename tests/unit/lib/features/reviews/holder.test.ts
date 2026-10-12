import { describe, it, expect } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { itemHolder, type Holder } from "@/lib/features/reviews/holder";
import { heldBy, intakeItem, removedHolder, requestedFor } from "@/tests/fakes/reviews";

const NONE: Holder = { kind: "none" };
const REMOVED: Holder = { kind: "removed" };

describe("itemHolder", () => {
  it.each<[string, Partial<IntakeItem>, Holder]>([
    ["a record on the review shelf", { effective_state: "pool" }, NONE],
    ["a stale request read as the shelf, even with the old request fields set", { effective_state: "pool", ...requestedFor("dj-pat", "DJ Pat") }, NONE],
    ["a live request names the requested DJ", { effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat") }, { kind: "requested", id: "dj-pat", name: "DJ Pat" }],
    ["a live request with no account id still names who it is held for", { effective_state: "requested", ...requestedFor(null, "DJ Pat") }, { kind: "requested", id: null, name: "DJ Pat" }],
    ["a live request ignores a holder left on the row", { effective_state: "requested", ...requestedFor("dj-pat", "DJ Pat"), ...heldBy("dj-sam", "DJ Sam") }, { kind: "requested", id: "dj-pat", name: "DJ Pat" }],
    ["a checked out record names who checked it out", { effective_state: "checked_out", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a checked out record whose holder's account was removed", { effective_state: "checked_out", ...removedHolder }, REMOVED],
    ["a reviewed record still with its holder", { effective_state: "reviewed", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a reviewed record whose holder's account was removed", { effective_state: "reviewed", ...removedHolder }, REMOVED],
    ["a reviewed record that was returned", { effective_state: "reviewed" }, NONE],
    ["a filed record still naming its holder", { effective_state: "filed", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a finalized record still naming its holder", { effective_state: "finalized", ...heldBy("dj-sam", "DJ Sam") }, { kind: "checked_out", id: "dj-sam", name: "DJ Sam" }],
    ["a filed record with a removed holder reads as nobody", { effective_state: "filed", ...removedHolder }, NONE],
    ["a filed record with no holder", { effective_state: "filed" }, NONE],
  ])("%s", (_label, overrides, expected) => {
    expect(itemHolder(intakeItem(overrides))).toEqual(expected);
  });
});
