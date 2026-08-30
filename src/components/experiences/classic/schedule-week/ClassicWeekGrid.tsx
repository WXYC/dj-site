"use client";

import type { DayColumn } from "@/lib/features/schedule-week/layout";
import { STATION_TIME_ZONE } from "@/src/utilities/stationTime";
import "@/src/styles/classic/schedule-week.css";

export const CLASSIC_SHOW_PANEL_ID = "classic-schedule-week-entries";

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

// Below this a block cannot hold legible text, so the name moves to the
// accessible name rather than disappearing. The source JSP simply printed
// nothing under 44 minutes, leaving an unreachable sliver.
const LABEL_THRESHOLD_FRACTION = 30 / (24 * 60);

const dayHeading = (dayStartMs: number) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    weekday: "long",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(dayStartMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), date: `${get("month")}/${get("day")}/${get("year")}` };
};

const hourLabel = (h: number) =>
  h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`;

export default function ClassicWeekGrid({
  columns,
  selectedShowId,
  onSelectShow,
}: {
  columns: DayColumn[];
  selectedShowId: number | null;
  onSelectShow: (showId: number) => void;
}) {
  return (
    <div className="classic-schedule-week-scroll">
      <div className="classic-schedule-week-grid">
        <div />
        {columns.map((column) => {
          const { weekday, date } = dayHeading(column.dayStartMs);
          return (
            <div key={column.dayStartMs} className="radioDayHeader">
              {weekday}
              <br />
              {date}
            </div>
          );
        })}

        <div className="classic-schedule-week-ruler">
          {HOURS.map((hour) => (
            <span
              key={hour}
              className="classic-schedule-week-hour"
              style={{ top: `${(hour / 24) * 100}%` }}
            >
              {hourLabel(hour)}
            </span>
          ))}
        </div>

        {columns.map((column) => (
          <div key={column.dayStartMs} className="classic-schedule-week-day">
            {column.gaps.map((gap) => (
              <div
                key={`gap-${gap.topFraction}`}
                aria-hidden
                className="radioDayNonshow"
                style={{
                  top: `${gap.topFraction * 100}%`,
                  height: `${gap.heightFraction * 100}%`,
                }}
              />
            ))}

            {column.blocks.map((block) => {
              const name = block.showName ?? block.djName ?? "Unattributed";
              const label = `${name} — ${block.timeRangeLabel}`;
              return (
                <div key={`line-${block.showId}`}>
                  <div
                    aria-hidden
                    className="radioDayLine"
                    style={{ top: `${block.topFraction * 100}%` }}
                  />
                  <button
                    type="button"
                    className={`radioShowDisplayBlock${
                      block.endIsInferred ? " is-open-ended" : ""
                    }`}
                    // Offset by the rule's own height, as the source did
                    // (`top + 1`, `height - 1`). Sharing the line's `top`
                    // paints the block straight over it and the separator
                    // between consecutive shows disappears. `min-height`
                    // covers the case where subtracting the pixel would
                    // leave nothing.
                    style={{
                      top: `calc(${block.topFraction * 100}% + 1px)`,
                      height: `calc(${block.heightFraction * 100}% - 1px)`,
                    }}
                    aria-expanded={block.showId === selectedShowId}
                    // The panel belongs to whichever block is expanded; a
                    // collapsed one pointing at it names either nothing or
                    // another show's entries.
                    aria-controls={
                      block.showId === selectedShowId
                        ? CLASSIC_SHOW_PANEL_ID
                        : undefined
                    }
                    aria-label={label}
                    title={
                      block.endIsInferred
                        ? `${label} (no sign-off recorded)`
                        : label
                    }
                    onClick={() => onSelectShow(block.showId)}
                  >
                    {block.heightFraction >= LABEL_THRESHOLD_FRACTION && (
                      <>
                        {name}
                        <br />
                        {block.timeRangeLabel}
                      </>
                    )}
                  </button>
                </div>
              );
            })}

            <div aria-hidden className="endOfDay" />
          </div>
        ))}
      </div>
    </div>
  );
}
