"use client";

import "@/src/styles/classic/wxyc.css";
import Navigation from "../../Navigation";

export default function Main({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tubafrenzy's live catalog page (searchCardCatalogLive.jsp) renders
  // full-width with centered content — no 800px .centerWidth cap.
  return (
    <div style={{ textAlign: "center" }}>
      <Navigation />
      {children}
    </div>
  );
}
