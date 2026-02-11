"use client";

import "@/src/styles/classic/wxyc.css";
import Navigation from "../../Navigation";

export default function Main({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="centerWidth" style={{ margin: "0 auto" }}>
      <Navigation />
      {children}
    </div>
  );
}
