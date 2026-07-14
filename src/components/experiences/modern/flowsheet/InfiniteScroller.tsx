"use client";

import {
  FLOWSHEET_DRAG_GUTTER_NARROW_PX,
  FLOWSHEET_DRAG_GUTTER_PX,
  FLOWSHEET_DRAG_GUTTER_VAR,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import { useFlowsheetPagination } from "@/src/hooks/flowsheetHooks";
import { Sheet } from "@mui/joy";
import { useEffect, useRef } from "react";

export default function InfiniteScroller({
  children,
}: {
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { loading, isFetching, hasNextPage, fetchNextPage } =
    useFlowsheetPagination();

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const scrolledToBottom =
        scroller.scrollHeight ===
        scroller.scrollTop + scroller.clientHeight;

      if (scrolledToBottom && !loading && !isFetching && hasNextPage) {
        fetchNextPage();
      }
    };

    scroller.addEventListener("scroll", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [loading, isFetching, hasNextPage, fetchNextPage]);

  return (
    <Sheet
      ref={scrollRef}
      sx={{
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
        background: "transparent",
        mt: 2,
        // Left bleed for the drag grips: `overflow-y: auto` forces horizontal
        // clipping at the padding box, so negative margin + equal padding
        // extends that box into the page gutter without moving the content.
        // Narrower below md, where Main's px can't absorb the full bleed.
        [FLOWSHEET_DRAG_GUTTER_VAR]: {
          xs: `${FLOWSHEET_DRAG_GUTTER_NARROW_PX}px`,
          md: `${FLOWSHEET_DRAG_GUTTER_PX}px`,
        },
        ml: `calc(-1 * var(${FLOWSHEET_DRAG_GUTTER_VAR}))`,
        pl: `var(${FLOWSHEET_DRAG_GUTTER_VAR})`,
      }}
    >
      {children}
    </Sheet>
  );
}
