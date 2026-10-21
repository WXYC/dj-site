import { describe, it, expect } from "vitest";
import { programsForStart } from "@/lib/features/specialty/slot-match";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

// Sunday 2026-10-18 is EDT (UTC-4); Sunday 2026-11-08 is EST (UTC-5).
// Spring forward was 2026-03-08, fall back 2026-11-01.
const cases: Array<[label: string, startedAt: string, programs: string[]]> = [
  ["inside a slot", "2026-10-18T16:30:00Z", ["Orange County Special"]],
  ["at the slot start", "2026-10-18T16:00:00Z", ["Orange County Special"]],
  ["within the lead before the slot", "2026-10-18T15:55:00Z", ["Orange County Special"]],
  ["before the lead window", "2026-10-18T15:30:00Z", []],
  ["just after the slot ends", "2026-10-18T18:00:00Z", []],
  ["the last minute of the slot", "2026-10-18T17:59:00Z", ["Orange County Special"]],
  ["outside every slot", "2026-10-20T03:00:00Z", []],
  ["a shared slot", "2026-10-18T20:15:00Z", ["HyperLocal", "Backyard BBQ"]],
  ["another shared slot", "2026-10-18T23:00:00Z", ["Sunset Soundtrack", "The Sunday Punk Radio"]],
  ["a Thursday evening slot, which is Friday in UTC", "2026-10-23T01:30:00Z", ["Thursday Night Feature"]],
  ["noon Eastern after spring forward", "2026-03-08T16:00:00Z", ["Orange County Special"]],
  ["noon Eastern before spring forward", "2026-03-01T17:00:00Z", ["Orange County Special"]],
  ["noon Eastern after fall back", "2026-11-08T17:00:00Z", ["Orange County Special"]],
  ["noon Eastern before fall back", "2026-10-25T16:00:00Z", ["Orange County Special"]],
  ["one hour off across fall back", "2026-11-08T16:00:00Z", []],
];

describe("programsForStart", () => {
  it.each(cases)("%s", (_label, startedAt, expected) => {
    expect(
      programsForStart(startedAt, SEED_CATALOG).map(({ program }) => program.name)
    ).toEqual(expected);
  });

  it("never matches a retired program", () => {
    const names = programsForStart("2026-10-18T16:30:00Z", SEED_CATALOG).map(
      ({ program }) => program.name
    );
    expect(names).not.toContain("Retired Hour");
  });

  it("reports the slot that matched", () => {
    const [match] = programsForStart("2026-10-18T16:30:00Z", SEED_CATALOG);
    expect(match.slot).toMatchObject({ day: 6, start_time: "12:00" });
  });

  it("returns nothing for an unparseable start", () => {
    expect(programsForStart("not a date", SEED_CATALOG)).toEqual([]);
  });
});
