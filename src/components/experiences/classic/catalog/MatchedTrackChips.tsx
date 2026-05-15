import type { TrackMatchHint } from "@/lib/features/catalog/types";
import "@/src/styles/classic/capsules.css";

const VISIBLE_LIMIT = 3;

export function MatchedTrackChips({
  matched_via,
}: {
  matched_via: TrackMatchHint[] | undefined;
}) {
  if (!matched_via || matched_via.length === 0) {
    return null;
  }

  const visible = matched_via.slice(0, VISIBLE_LIMIT);
  const overflow = matched_via.slice(VISIBLE_LIMIT);

  return (
    <div className="classic-matched-chip-row">
      {visible.map((hint, idx) => {
        const label = `matched on track: ${hint.title}`;
        const tooltipParts = [hint.title];
        if (hint.artist_credit) tooltipParts.push(`by ${hint.artist_credit}`);
        if (hint.position) tooltipParts.push(`(${hint.position})`);
        const tooltip = tooltipParts.join(" ");
        return (
          <span
            key={`${hint.source}:${hint.title}:${idx}`}
            className="classic-matched-chip"
            tabIndex={0}
            title={tooltip}
            aria-label={label}
          >
            {label}
          </span>
        );
      })}
      {overflow.length > 0 && (
        <span
          className="classic-matched-chip classic-matched-chip--more"
          tabIndex={0}
          title={overflow.map((hint) => hint.title).join(", ")}
          aria-label={`${overflow.length} more matched tracks: ${overflow
            .map((hint) => hint.title)
            .join(", ")}`}
        >
          +{overflow.length} more
        </span>
      )}
    </div>
  );
}
