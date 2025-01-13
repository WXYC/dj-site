import React from "react";
import ClassicHeader from "../components/Header/Classic/ClassicHeader";

export default function ClassicDashboard({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <div>
    <ClassicHeader />
    <main>{children}</main>
  </div>;
}
