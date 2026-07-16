"use client";

import InitColorSchemeScript from "@mui/joy/InitColorSchemeScript";
import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

/**
 * Injected through useServerInsertedHTML rather than rendered in the tree:
 * React 19's client reconciler never executes an inline <script> it re-creates
 * during hydration and errors on encountering one, while the server-inserted
 * copy still parses in <head> before first paint. Emitted exactly once — the
 * insertion callback runs per flush.
 */
export default function InitColorScheme() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <InitColorSchemeScript />;
  });
  return null;
}
