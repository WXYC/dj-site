import type { SpecialtyShow } from "@wxyc/shared";

const program = (
  id: number,
  name: string,
  short_name: string,
  slots: SpecialtyShow["slots"],
  overrides: Partial<SpecialtyShow> = {}
): SpecialtyShow => ({
  id,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  short_name,
  tagline: `${name}, every week.`,
  logs_playcuts: true,
  artwork: null,
  accent_color: "#7a1f3d",
  active: true,
  slots,
  ...overrides,
});

const SUNDAY = 6;
const THURSDAY = 3;
const FRIDAY = 4;
const slot = (
  day: number,
  start_time: string,
  cadence: SpecialtyShow["slots"][number]["cadence"] = "weekly",
  duration_minutes = 120
) => ({
  day,
  start_time,
  duration_minutes,
  cadence,
});

/** The seed catalog's slots, in catalog order; start times are Eastern wall clock. */
export const SEED_CATALOG: SpecialtyShow[] = [
  program(1, "Orange County Special", "OCS", [slot(SUNDAY, "12:00")]),
  program(2, "HyperLocal", "HL", [slot(SUNDAY, "16:00")]),
  program(3, "Backyard BBQ", "BBQ", [slot(SUNDAY, "16:00", "some_weeks")]),
  program(4, "Sunset Soundtrack", "SS", [slot(SUNDAY, "19:00")]),
  program(5, "The Sunday Punk Radio", "TSPR", [slot(SUNDAY, "19:00", "last_of_month")]),
  program(6, "Thursday Night Feature", "TNF", [slot(THURSDAY, "21:00")]),
  program(8, "Inside Track", "IT", [slot(FRIDAY, "21:00", "weekly", 60)]),
  program(9, "Story Hour", "SH", [slot(FRIDAY, "21:00", "some_weeks", 60)]),
  program(10, "New Science Experience", "NSE", [slot(FRIDAY, "22:00", "weekly", 60)]),
  program(7, "Retired Hour", "RH", [slot(SUNDAY, "12:00")], { active: false }),
];
