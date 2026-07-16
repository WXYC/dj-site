import { describe, it, expect } from "vitest";
import {
  defaultLiveUpdatesState,
  liveUpdatesSlice,
  type LiveUpdatesConnectionStatus,
} from "@/lib/features/flowsheet/live-updates-slice";
import { describeSlice } from "@/tests/helpers";

describeSlice(liveUpdatesSlice, defaultLiveUpdatesState, ({ harness, actions }) => {
  describe("connection ref-count", () => {
    it("increments refCount on each connectionRequested", () => {
      const result = harness().chain(
        actions.liveUpdatesConnectionRequested(),
        actions.liveUpdatesConnectionRequested(),
        actions.liveUpdatesConnectionRequested()
      );
      expect(result.refCount).toBe(3);
    });

    it("decrements refCount on each connectionReleased", () => {
      const result = harness().chain(
        actions.liveUpdatesConnectionRequested(),
        actions.liveUpdatesConnectionRequested(),
        actions.liveUpdatesConnectionReleased()
      );
      expect(result.refCount).toBe(1);
    });

    it("clamps refCount at 0 on extra releases", () => {
      const result = harness().chain(
        actions.liveUpdatesConnectionReleased(),
        actions.liveUpdatesConnectionReleased()
      );
      expect(result.refCount).toBe(0);
    });
  });

  describe("connection status", () => {
    it.each<LiveUpdatesConnectionStatus>([
      "closed",
      "connecting",
      "connected",
      "reconnecting",
    ])("records status %s", (status) => {
      const result = harness().reduce(
        actions.liveUpdatesConnectionStateChanged(status)
      );
      expect(result.connectionStatus).toBe(status);
    });
  });

  describe("lastEventAt", () => {
    it("records the most recent event timestamp", () => {
      const result = harness().chain(
        actions.liveUpdatesLastEventAtUpdated(1_700_000_000_000),
        actions.liveUpdatesLastEventAtUpdated(1_700_000_005_000)
      );
      expect(result.lastEventAt).toBe(1_700_000_005_000);
    });
  });

  describe("selectors", () => {
    it("selectLiveUpdatesIsConnected is true only when status === 'connected'", () => {
      const { dispatch, select } = harness().withStore();

      expect(
        select(liveUpdatesSlice.selectors.selectLiveUpdatesIsConnected)
      ).toBe(false);

      dispatch(actions.liveUpdatesConnectionStateChanged("connecting"));
      expect(
        select(liveUpdatesSlice.selectors.selectLiveUpdatesIsConnected)
      ).toBe(false);

      dispatch(actions.liveUpdatesConnectionStateChanged("connected"));
      expect(
        select(liveUpdatesSlice.selectors.selectLiveUpdatesIsConnected)
      ).toBe(true);

      dispatch(actions.liveUpdatesConnectionStateChanged("reconnecting"));
      expect(
        select(liveUpdatesSlice.selectors.selectLiveUpdatesIsConnected)
      ).toBe(false);
    });
  });
});
