import { describe, it, expect } from "vitest";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import { describeSlice } from "@/tests/helpers";

describeSlice(
  playlistSearchSlice,
  playlistSearchSlice.getInitialState(),
  ({ harness, actions }) => {
    describe("default state", () => {
      it("lists the newest plays first", () => {
        expect(harness().initialState).toMatchObject({
          sortBy: "date",
          sortOrder: "desc",
        });
      });
    });

    describe("setSort", () => {
      it("applies both halves of the pair it is given", () => {
        const state = harness().reduce(
          actions.setSort({ sortBy: "artist", sortOrder: "asc" }),
        );

        expect(state).toMatchObject({ sortBy: "artist", sortOrder: "asc" });
      });

      it("is idempotent when the pair is already the active one", () => {
        const state = harness().chain(
          actions.setSort({ sortBy: "date", sortOrder: "desc" }),
          actions.setSort({ sortBy: "date", sortOrder: "desc" }),
        );

        expect(state).toMatchObject({ sortBy: "date", sortOrder: "desc" });
      });

      it("takes the direction from the pair rather than from the outgoing field", () => {
        const state = harness().chain(
          actions.setSort({ sortBy: "artist", sortOrder: "asc" }),
          actions.setSort({ sortBy: "date", sortOrder: "desc" }),
        );

        expect(state).toMatchObject({ sortBy: "date", sortOrder: "desc" });
      });
    });

    describe("toggleSort", () => {
      it("reverses the direction of the already-active field", () => {
        const state = harness().reduce(actions.toggleSort("date"));

        expect(state).toMatchObject({ sortBy: "date", sortOrder: "asc" });
      });

      it("reverses back on a second toggle of the same field", () => {
        const state = harness().chain(
          actions.toggleSort("date"),
          actions.toggleSort("date"),
        );

        expect(state).toMatchObject({ sortBy: "date", sortOrder: "desc" });
      });

      it("starts a newly chosen field descending", () => {
        const state = harness().chain(
          actions.toggleSort("date"),
          actions.toggleSort("artist"),
        );

        expect(state).toMatchObject({ sortBy: "artist", sortOrder: "desc" });
      });
    });
  },
);
