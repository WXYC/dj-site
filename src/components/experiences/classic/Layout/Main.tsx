"use client";

import "@/src/styles/classic/wxyc.css";
import Navigation from "../Navigation";

// Shared shell for the classic card-catalog and librarian screens. Tubafrenzy
// renders those pages (searchCardCatalogLive.jsp, missingReleases.jsp) full
// width with centered content — no 800px .centerWidth cap.
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
