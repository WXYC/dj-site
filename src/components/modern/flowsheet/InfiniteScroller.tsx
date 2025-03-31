"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Sheet } from "@mui/joy";
import { useEffect, useRef } from "react";

export default function InfiniteScroller({
  children,
}: {
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const dispatch = useAppDispatch();

  const { loading, entries } = useFlowsheet();
  const pagination = useAppSelector(flowsheetSlice.selectors.getPagination);

  useEffect(() => {
    const scroller = scrollRef.current;

    const onScroll = () => {
      if (!scroller) {
        return;
      }

      const scrolledToBottom =
        scroller.scrollHeight ===
        scroller.scrollTop + scroller.clientHeight;
      if (scrolledToBottom && !loading && entries) {
        console.log(pagination.max + 1);
        dispatch(
          flowsheetSlice.actions.setPagination({
            page: pagination.max + 1,
            limit: 20
          })
        );
      }
    };

    scroller?.addEventListener("scroll", onScroll);

    return () => {
      scroller?.removeEventListener("scroll", onScroll);
    };
  }, [loading, entries, pagination.max]);

  return (
    <Sheet
      ref={scrollRef}
      sx={{
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
        background: "transparent",
        mt: 2,
        overflowX: "visible",
      }}
    >
      {children}
    </Sheet>
  );
}
