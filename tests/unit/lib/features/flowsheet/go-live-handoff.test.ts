import { describe, it, expect } from "vitest";
import {
  describeOpenShow,
  formatDjNames,
  formatElapsedSince,
  readShowAlreadyOpen,
  takeoverWasHonored,
} from "@/lib/features/flowsheet/go-live-handoff";

const NOW = new Date("2026-08-28T20:00:00.000Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("readShowAlreadyOpen", () => {
  const conflict = {
    status: 409,
    data: {
      message: "A show is already on air",
      code: "show_already_open",
      details: {
        show: {
          id: 1951224,
          dj_name: "dj sue",
          start_time: "2026-08-28T15:00:00.000Z",
        },
      },
    },
  };

  it("reads the open show's id and name off the refusal", () => {
    expect(readShowAlreadyOpen(conflict)).toEqual({
      showId: 1951224,
      djNames: ["dj sue"],
      lastLoggedAt: null,
    });
  });

  // RTK Query rejects with the bare shape from `.unwrap()` and a wrapped one
  // from `queryFulfilled`. Both reach this reader; missing the wrapped form
  // would mis-classify every refusal seen from the cache-patch side.
  it("reads the wrapped rejection queryFulfilled produces", () => {
    expect(readShowAlreadyOpen({ error: conflict, meta: {} })).toEqual({
      showId: 1951224,
      djNames: ["dj sue"],
      lastLoggedAt: null,
    });
  });

  // The status alone is not the discriminant: force-end reports an unrelated
  // refusal with the same 409, and putting the handoff prompt in front of a DJ
  // over that would be worse than saying nothing.
  it("ignores a 409 that is not show_already_open", () => {
    expect(
      readShowAlreadyOpen({
        status: 409,
        data: { message: "…", code: "current_show_requires_force" },
      })
    ).toBeNull();
  });

  it.each([
    ["a non-409 status", { status: 400, data: { code: "show_already_open" } }],
    ["a missing body", { status: 409 }],
    ["a show with no id", { status: 409, data: { code: "show_already_open", details: { show: {} } } }],
    ["a network-shaped rejection", { status: "FETCH_ERROR", error: "boom" }],
    ["a thrown Error", new Error("boom")],
    ["null", null],
  ])("returns null for %s", (_label, err) => {
    expect(readShowAlreadyOpen(err)).toBeNull();
  });

  // A show whose name the chain can't resolve names nobody, and the sentence
  // supplies the placeholder at render: "Someone is on air" beats " is on air".
  it("names nobody when the name is blank, and still reads as a sentence", () => {
    const blank = {
      status: 409,
      data: {
        code: "show_already_open",
        details: { show: { id: 7, dj_name: "   " } },
      },
    };
    const handoff = readShowAlreadyOpen(blank);
    expect(handoff?.djNames).toEqual([]);
    expect(describeOpenShow(handoff!, NOW)).toBe("Someone is on air.");
  });
});

describe("formatDjNames", () => {
  it.each([
    [[], "Someone"],
    [["dj sue"], "dj sue"],
    [["dj sue", "eureka!"], "dj sue and eureka!"],
    [["dj sue", "eureka!", "DJ boy"], "dj sue, eureka! and DJ boy"],
    [["", "  ", "dj sue"], "dj sue"],
  ])("formats %j as %s", (names, expected) => {
    expect(formatDjNames(names)).toBe(expected);
  });
});

describe("formatElapsedSince", () => {
  it.each([
    [0, "just now"],
    [30_000, "just now"],
    [2 * MINUTE, "2m ago"],
    [59 * MINUTE, "59m ago"],
    [HOUR, "1h 0m ago"],
    [5 * HOUR + 12 * MINUTE, "5h 12m ago"],
    [26 * HOUR, "1d 2h ago"],
  ])("renders %dms as %s", (elapsed, expected) => {
    expect(formatElapsedSince(ago(elapsed), NOW)).toBe(expected);
  });

  // Browser and server clocks disagree by seconds routinely; a just-logged
  // entry can read as marginally future. The DJ's answer is the same either
  // way, and a negative duration is noise.
  it("reads a marginally-future timestamp as just now", () => {
    expect(formatElapsedSince(new Date(NOW + 3000).toISOString(), NOW)).toBe(
      "just now"
    );
  });

  it.each([null, "", "not a date"])("returns null for %p", (raw) => {
    expect(formatElapsedSince(raw, NOW)).toBeNull();
  });
});

describe("describeOpenShow", () => {
  it("leads with the elapsed time, which is what the DJ is actually deciding on", () => {
    expect(
      describeOpenShow(
        {
          showId: 1,
          djNames: ["dj sue"],
          lastLoggedAt: ago(5 * HOUR + 12 * MINUTE),
        },
        NOW
      )
    ).toBe("dj sue is on air. Last logged 5h 12m ago.");
  });

  it("reads very differently for a show that is plainly still running", () => {
    expect(
      describeOpenShow(
        { showId: 1, djNames: ["dj sue"], lastLoggedAt: ago(2 * MINUTE) },
        NOW
      )
    ).toBe("dj sue is on air. Last logged 2m ago.");
  });

  // An unknown timestamp is the server-refusal path, which carries none. It is
  // not evidence that nothing was logged, so the sentence drops the clause
  // rather than inventing a reading of it.
  it("drops the elapsed clause rather than guessing when the timestamp is unknown", () => {
    expect(
      describeOpenShow(
        { showId: 1, djNames: ["dj sue"], lastLoggedAt: null },
        NOW
      )
    ).toBe("dj sue is on air.");
  });

  // Subject and verb come from one filtered list. Counting the raw array
  // instead would render "dj sue are on air" for a co-host with a blank handle.
  it("ignores blank handles when choosing the verb", () => {
    expect(
      describeOpenShow(
        { showId: 1, djNames: ["dj sue", "  "], lastLoggedAt: null },
        NOW
      )
    ).toBe("dj sue is on air.");
  });

  // The abandoned show this feature exists for is exactly the one that
  // collects several DJs, so the plural is not a rare path.
  it("agrees with a plural subject", () => {
    expect(
      describeOpenShow(
        {
          showId: 1,
          djNames: ["dj sue", "eureka!", "DJ boy"],
          lastLoggedAt: ago(5 * HOUR),
        },
        NOW
      )
    ).toBe("dj sue, eureka! and DJ boy are on air. Last logged 5h 0m ago.");
  });
});

/**
 * The server may decline a takeover without saying so: while its takeover flag
 * is off it ignores `intent` and co-hosts, answering 200 with the membership
 * row instead of a new show. Only the body's shape separates the two, and
 * reading it wrong is what lets "End Existing Show" attach a DJ to the show
 * they asked to end.
 */
describe("takeoverWasHonored", () => {
  const ENDED = 1951224;

  it("reads a newly started show as honoured", () => {
    expect(takeoverWasHonored({ id: 1951225 }, ENDED)).toBe(true);
  });

  // The day the server answers a co-host join with the joined show, presence
  // of an `id` stops discriminating — but its identity still does.
  it("reads the show it was asked to end as NOT honoured", () => {
    expect(takeoverWasHonored({ id: ENDED }, ENDED)).toBe(false);
  });

  it.each([
    ["a co-host membership row", { show_id: ENDED, dj_id: "dj-eureka" }],
    ["an empty body", {}],
    ["no body at all", undefined],
  ])("reads %s as not honoured", (_label, body) => {
    expect(takeoverWasHonored(body, ENDED)).toBe(false);
  });
});
