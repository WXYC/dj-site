"use client";

import "@/src/styles/classic/wxyc.css";
import Navigation from "../../Navigation";

// Shared shell for /dashboard/library/** screens (missingReleases.jsp today;
// the artist/release/rotation screens in the same URL family reuse this).
// Full-width centered content, no 800px .centerWidth cap — matches wxycdb's
// own admin pages.
export default function Main({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <Navigation />
      {children}
    </div>
  );
}
