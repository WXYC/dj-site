import { useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { IntakeSlip } from "@wxyc/shared";
import { useMounted } from "@/src/hooks/useRowWrite";
import { formatSlipDate } from "./slipDate";
import SlipPreview from "./SlipPreview";

// Prints the slip alone: the app chrome is hidden, the slip is laid at the page's corner.
const PRINT_CSS = `@media print {
  body * { visibility: hidden; }
  .review-slip-print, .review-slip-print * { visibility: visible; }
  .review-slip-print { position: absolute; left: 0; top: 0; }
}`;

/**
 * The print half of every slip page: the print-only stylesheet, the slip as
 * returned, and the press-then-print sequence. A page calls `showAndPrint` with
 * the slip its print request answered and renders `sheet` anywhere in its tree.
 * What the page says around the print stays with the page.
 */
export function useSlipPrint(): { showAndPrint: (printed: IntakeSlip) => void; clear: () => void; sheet: ReactNode } {
  const mounted = useMounted();
  const [slip, setSlip] = useState<IntakeSlip | null>(null);

  const showAndPrint = (printed: IntakeSlip) => {
    // The print is logged either way; a page that has gone has no slip to show and must not open the dialog.
    if (!mounted.current) return;
    // The slip must be in the document before the browser snapshots it.
    flushSync(() => setSlip(printed));
    window.print();
  };

  const clear = () => {
    if (mounted.current) setSlip(null);
  };

  const sheet = (
    <>
      <style>{PRINT_CSS}</style>
      {slip && (
        <div className="review-slip-print">
          <SlipPreview
            artist={slip.artist_name}
            album={slip.album_title}
            label={slip.record_label ?? ""}
            reviewer={slip.author ?? ""}
            date={slip.submitted_at ? formatSlipDate(slip.submitted_at) : ""}
            fields={slip}
            fccNotes={slip.fcc_notes.map((n) => `${n.track}: ${n.note}`)}
          />
        </div>
      )}
    </>
  );

  return { showAndPrint, clear, sheet };
}
