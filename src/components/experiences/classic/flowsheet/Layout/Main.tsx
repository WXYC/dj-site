"use client";

import "@/src/styles/classic/wxyc.css";
import "@/src/styles/classic/flowsheet.css";
import Image from "next/image";
import { useFlowsheet, useShowControl } from "@/src/hooks/flowsheetHooks";
import { useLogout } from "@/src/hooks/authenticationHooks";
import EntryForm from "../EntryForm";
import EntryTable from "../EntryTable";
import Navigation from "../../Navigation";
import StartShow from "../StartShow";
import { UpdateRequestBody } from "@/lib/features/flowsheet/types";
import { useSwitchEntriesMutation } from "@/lib/features/flowsheet/api";

export default function Main() {
  const { entries, removeFromFlowsheet, updateFlowsheet, loading } =
    useFlowsheet();
  const { live, leave } = useShowControl();
  const { handleLogout } = useLogout();
  const [switchEntries] = useSwitchEntriesMutation();

  const currentShowEntries = entries.current;
  const previousEntries = entries.previous;

  // Ports tubafrenzy's EndShowServlet flow: signoff the radio show and
  // invalidate the session in one click. handleLogout owns the session
  // teardown (token cache, signOut, state reset) and the /login redirect.
  const endShow = () => {
    leave();
    handleLogout();
  };

  const handleUpdate = (entryId: number, data: UpdateRequestBody) => {
    updateFlowsheet({ entry_id: entryId, data });
  };

  const handleDelete = (entryId: number) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      removeFromFlowsheet(entryId);
    }
  };

  const handleReorder = async (sourceId: number, targetId: number) => {
    const target = currentShowEntries.find((e) => e.id === targetId);
    if (!target || !("play_order" in target)) return;
    try {
      await switchEntries({
        entry_id: sourceId,
        new_position: target.play_order,
      }).unwrap();
    } catch (error) {
      console.error("Failed to reorder entries:", error);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center" }} className="text">
        <p>Loading flowsheet...</p>
      </div>
    );
  }

  if (!live) {
    return (
      <div style={{ width: "100%", margin: "0 auto" }}>
        <Navigation />
        <StartShow />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", margin: "0 auto" }}>
      <Navigation />
      <div style={{ textAlign: "right", padding: "4px 10px" }}>
        <a
          href="#"
          className="label"
          onClick={(e) => {
            e.preventDefault();
            endShow();
          }}
        >
          End Show
        </a>
      </div>
      <div style={{ textAlign: "center", margin: "12px 0 8px" }}>
        {/* unoptimized: see next.config.mjs images.unoptimized comment */}
        <Image
          src="/img/wxyc-logo-classic.gif"
          alt="WXYC 89.3 FM"
          width={148}
          height={35}
          unoptimized
          priority
          style={{ border: 0 }}
        />
      </div>
      <EntryForm isLive={live} />
      <div className="redlabel" style={{ textAlign: "center" }}></div>
      <div style={{ textAlign: "center" }}>
        <EntryTable
          entries={currentShowEntries}
          previousEntries={previousEntries}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      </div>
    </div>
  );
}
